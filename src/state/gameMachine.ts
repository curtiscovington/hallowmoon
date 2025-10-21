import { CardInstance, GameState, Resources, Slot } from './types';
import {
  HERO_TEMPLATE,
  OPPORTUNITY_TEMPLATES,
  SLOT_ACTION_COMPLETION_TOLERANCE_MS,
  SLOT_LOCK_BASE_MS,
  SLOT_LOCK_DURATIONS,
  SLOT_TEMPLATES
} from './content';
import { buildStoryLog } from '../content/storyBeats';
import { formatDurationLabel } from '../utils/time';

import {
  addToHand,
  appendLog,
  applyResources,
  instantiateCard,
  instantiateSlot,
  removeFromHand,
  resolveDeliverCardsAction,
  spawnOpportunity
} from './slots/shared';
import { createEmptyJournal, isDreamCard, isJournalCard } from './slots/dreams';
import { completeManorExploration } from './slots/manor';
import { getSlotBehavior, SlotActionResult, SlotBehaviorContext } from './slots/behaviors';
import { Clock, RandomSource, getClock, getRandomSource, now, random, setClock, setRandomSource } from './runtime';

function getSlotBaseLockDurationMs(
  slot: Slot,
  state?: GameState,
  context?: SlotBehaviorContext
): number {
  const behavior = getSlotBehavior(slot.type);
  if (behavior?.getLockDurationMs) {
    const override = behavior.getLockDurationMs({ slot, state, context });
    if (typeof override === 'number') {
      return override;
    }
  }

  const base = SLOT_LOCK_DURATIONS[slot.type] ?? SLOT_LOCK_BASE_MS;
  if (slot.type === 'manor' && slot.state === 'damaged') {
    return base * 2;
  }
  return base;
}

function getScaledSlotLockDurationMs(
  slot: Slot,
  timeScale: number,
  state?: GameState,
  context?: SlotBehaviorContext
): number {
  const baseDuration = getSlotBaseLockDurationMs(slot, state, context);
  const scale = Math.max(timeScale, 0.25);
  return Math.max(250, Math.round(baseDuration / scale));
}

function baseResources(): Resources {
  return { coin: 0, lore: 0, glimmer: 1 };
}

function initialState(): GameState {
  const hero = instantiateCard(HERO_TEMPLATE);
  const whisper = instantiateCard(OPPORTUNITY_TEMPLATES[0]);
  const slots: Record<string, Slot> = {};
  const manorSlot = instantiateSlot(SLOT_TEMPLATES.manor);

  slots[manorSlot.id] = manorSlot;

  return {
    cycle: 1,
    heroCardId: hero.id,
    cards: {
      [hero.id]: hero,
      [whisper.id]: whisper
    },
    hand: [hero.id, whisper.id],
    slots,
    resources: baseResources(),
    log: buildStoryLog('arrival'),
    discoveries: [],
    timeScale: 1,
    pendingReveals: []
  };
}

export type GameAction =
  | { type: 'MOVE_CARD_TO_SLOT'; cardId: string; slotId: string }
  | { type: 'RECALL_CARD'; cardId: string }
  | { type: 'ACTIVATE_SLOT'; slotId: string }
  | { type: 'UPGRADE_SLOT'; slotId: string }
  | { type: 'ADVANCE_TIME' }
  | { type: 'RESOLVE_PENDING_SLOT_ACTIONS' }
  | { type: 'SET_TIME_SCALE'; scale: number }
  | { type: 'ACKNOWLEDGE_CARD_REVEAL'; cardId: string };

function isCardAllowedInSlot(state: GameState, card: CardInstance, slot: Slot): boolean {
  if (slot.accepted === 'persona-only') {
    return card.type === 'persona';
  }
  if (slot.accepted === 'non-persona') {
    return card.type !== 'persona';
  }
  const behavior = getSlotBehavior(slot.type);
  if (behavior?.acceptsCard) {
    return behavior.acceptsCard({ state, slot, card });
  }
  return true;
}

function calculateUpgradeCost(slot: Slot): number {
  return slot.upgradeCost + (slot.level - 1) * 2;
}

function resolvePendingSlotActions(state: GameState, now: number): GameState {
  let nextState = state;
  const slotIds = Object.keys(state.slots);

  for (const slotId of slotIds) {
    const slot = nextState.slots[slotId];
    if (!slot || !slot.pendingAction) {
      continue;
    }
    if (slot.lockedUntil) {
      const remaining = slot.lockedUntil - now;
      // Allow a small grace window so we don't require another full cycle when the
      // lock expires between timer ticks.
      if (remaining > SLOT_ACTION_COMPLETION_TOLERANCE_MS) {
        continue;
      }
    }

    switch (slot.pendingAction.type) {
      case 'explore-manor': {
        const result = completeManorExploration(nextState, slotId, nextState.log);
        nextState = { ...result.state, log: result.log };
        break;
      }
      case 'deliver-cards': {
        const { cardIds, reveal } = slot.pendingAction;
        const result = resolveDeliverCardsAction({
          state: nextState,
          slot,
          log: nextState.log,
          cardIds,
          reveal
        });
        nextState = { ...result.state, log: result.log };
        break;
      }
      default:
        break;
    }
  }

  return nextState;
}

function activateSlot(state: GameState, slotId: string): SlotActionResult {
  const clock = getClock();
  const randomSource = getRandomSource();
  const context: SlotBehaviorContext = { random: randomSource, now: clock };

  const preparedState = resolvePendingSlotActions(state, clock());
  const slot = preparedState.slots[slotId];
  if (!slot || !slot.unlocked) {
    return {
      state: preparedState,
      log: appendLog(preparedState.log, 'That slot is not yet available.'),
      performed: false
    };
  }

  const currentTime = clock();
  if (slot.lockedUntil && slot.lockedUntil > currentTime) {
    const remaining = slot.lockedUntil - currentTime;
    const message = `${slot.name} is still resolving a previous action. ≈ ${formatDurationLabel(remaining)} remain.`;
    return {
      state: preparedState,
      log: appendLog(preparedState.log, message),
      performed: false
    };
  }

  const behavior = getSlotBehavior(slot.type);
  if (!behavior) {
    const message = `No behavior is registered for slot type ${slot.type}.`;
    return {
      state: preparedState,
      log: appendLog(preparedState.log, message),
      performed: false
    };
  }

  const result = behavior.activate({ state: preparedState, slot, log: preparedState.log, context });
  if (!result.performed) {
    return result;
  }

  const refreshedSlot = result.state.slots[slotId];
  if (!refreshedSlot) {
    return result;
  }

  const lockDuration = getScaledSlotLockDurationMs(refreshedSlot, result.state.timeScale, result.state, context);
  const lockedSlot: Slot = {
    ...refreshedSlot,
    lockedUntil: clock() + lockDuration
  };

  const updatedSlots = {
    ...result.state.slots,
    [slotId]: lockedSlot
  };

  const nextState: GameState = {
    ...result.state,
    slots: updatedSlots
  };

  const nextLog = appendLog(
    result.log,
    `${lockedSlot.name} will be ready again in about ${formatDurationLabel(lockDuration)}.`
  );

  return { state: nextState, log: nextLog, performed: true };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE_CARD_TO_SLOT': {
      const card = state.cards[action.cardId];
      const slot = state.slots[action.slotId];
      if (!card || !slot || !slot.unlocked) {
        return {
          ...state,
          log: appendLog(state.log, 'That move is not possible right now.')
        };
      }

      if (!isCardAllowedInSlot(state, card, slot)) {
        return {
          ...state,
          log: appendLog(state.log, `${card.name} is not suited for ${slot.name}.`)
        };
      }

      if (card.location.area === 'slot' && card.location.slotId === slot.id) {
        return state;
      }

      if (card.location.area === 'slot') {
        const originSlot = state.slots[card.location.slotId];
        if (originSlot && originSlot.lockedUntil && originSlot.lockedUntil > now()) {
          return {
            ...state,
            log: appendLog(
              state.log,
              `${card.name} is still committed to ${originSlot.name}. Wait for the action to resolve before moving them.`
            )
          };
        }
      }

      const updatedSlots: Record<string, Slot> = { ...state.slots };
      let updatedCards: Record<string, CardInstance> = { ...state.cards };
      let updatedHand = [...state.hand];
      let updatedLog = state.log;

      if (card.location.area === 'hand') {
        updatedHand = removeFromHand(updatedHand, card.id);
      } else if (card.location.area === 'slot') {
        const previousSlot = updatedSlots[card.location.slotId];
        if (previousSlot) {
          let nextPreviousSlot: Slot = previousSlot;

          if (previousSlot.occupantId === card.id) {
            const promotedOccupant =
              previousSlot.assistantId && previousSlot.assistantId !== card.id
                ? previousSlot.assistantId
                : null;
            nextPreviousSlot = {
              ...nextPreviousSlot,
              occupantId: promotedOccupant,
              assistantId:
                promotedOccupant && previousSlot.assistantId === promotedOccupant
                  ? null
                  : previousSlot.assistantId === card.id
                  ? null
                  : previousSlot.assistantId
            };
          } else if (previousSlot.assistantId === card.id) {
            nextPreviousSlot = {
              ...nextPreviousSlot,
              assistantId: null
            };
          }

          if (nextPreviousSlot.attachedCardIds.includes(card.id)) {
            nextPreviousSlot = {
              ...nextPreviousSlot,
              attachedCardIds: nextPreviousSlot.attachedCardIds.filter((id) => id !== card.id)
            };
          }

          updatedSlots[previousSlot.id] = nextPreviousSlot;
        }
      }

      const targetSlot = updatedSlots[slot.id];
      const currentOccupantId = targetSlot.occupantId;
      const currentAssistantId = targetSlot.assistantId;
      const currentOccupant = currentOccupantId ? updatedCards[currentOccupantId] : undefined;
      const currentAssistant = currentAssistantId ? updatedCards[currentAssistantId] : undefined;
      const currentAttachments = targetSlot.attachedCardIds;
      const attachmentCards = currentAttachments
        .map((id) => updatedCards[id])
        .filter((attached): attached is CardInstance => Boolean(attached));

      const ensureAttachmentIds = (ids: string[]) => Array.from(new Set(ids));

      if (
        slot.type === 'study' &&
        currentOccupant &&
        currentOccupant.type === 'persona' &&
        isJournalCard(card) &&
        !currentAssistantId
      ) {
        updatedCards = {
          ...updatedCards,
          [currentOccupant.id]: { ...currentOccupant, location: { area: 'slot', slotId: slot.id } },
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };
        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: currentOccupant.id,
          attachedCardIds: ensureAttachmentIds(currentAttachments.filter((id) => id !== card.id))
        };
        updatedLog = appendLog(
          updatedLog,
          `${card.name} is opened for ${currentOccupant.name}, ready to capture their studies.`
        );
        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        currentOccupant.type === 'persona' &&
        isDreamCard(card) &&
        !currentAssistantId
      ) {
        updatedCards = {
          ...updatedCards,
          [currentOccupant.id]: { ...currentOccupant, location: { area: 'slot', slotId: slot.id } },
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };
        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: currentOccupant.id,
          attachedCardIds: ensureAttachmentIds(currentAttachments.filter((id) => id !== card.id))
        };
        updatedLog = appendLog(
          updatedLog,
          `${card.name} is entrusted to ${currentOccupant.name} for study.`
        );
        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        isDreamCard(currentOccupant) &&
        currentAssistant &&
        currentAssistant.type === 'persona' &&
        isJournalCard(card)
      ) {
        updatedCards = {
          ...updatedCards,
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };

        const nextAttachments = ensureAttachmentIds([
          ...currentAttachments.filter((id) => id !== card.id),
          card.id
        ]);

        updatedSlots[slot.id] = {
          ...targetSlot,
          attachedCardIds: nextAttachments
        };

        updatedLog = appendLog(
          updatedLog,
          `${card.name} lies open for ${currentAssistant.name}, ready to capture ${currentOccupant.name}.`
        );

        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        isDreamCard(currentOccupant) &&
        card.type === 'persona' &&
        (!currentAssistant || currentAssistant.id === card.id)
      ) {
        updatedCards = {
          ...updatedCards,
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };
        updatedSlots[slot.id] = {
          ...targetSlot,
          assistantId: card.id
        };
        updatedLog = appendLog(
          updatedLog,
          `${card.name} joins ${currentOccupant.name} to interpret the dream.`
        );
        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        isJournalCard(currentOccupant) &&
        currentAssistant &&
        currentAssistant.type === 'persona' &&
        isDreamCard(card)
      ) {
        const nextAttachments = ensureAttachmentIds([
          ...currentAttachments.filter((id) => id !== card.id && id !== currentOccupant.id),
          currentOccupant.id
        ]);

        updatedCards = {
          ...updatedCards,
          [currentOccupant.id]: { ...currentOccupant, location: { area: 'slot', slotId: slot.id } },
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };

        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: currentAssistant.id,
          attachedCardIds: nextAttachments
        };

        updatedLog = appendLog(
          updatedLog,
          `${card.name} is placed for ${currentAssistant.name} to chronicle within ${currentOccupant.name}.`
        );

        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (currentOccupantId && currentOccupantId !== card.id) {
        const displacedUpdates: Record<string, CardInstance> = {};

        if (currentOccupant) {
          displacedUpdates[currentOccupant.id] = {
            ...currentOccupant,
            location: { area: 'hand' }
          };
          updatedHand = addToHand(updatedHand, currentOccupant.id);
        }

        if (currentAssistantId && currentAssistant && currentAssistant.id !== card.id) {
          displacedUpdates[currentAssistant.id] = {
            ...currentAssistant,
            location: { area: 'hand' }
          };
          updatedHand = addToHand(updatedHand, currentAssistant.id);
        }

        for (const attachment of attachmentCards) {
          if (attachment.id === card.id) {
            continue;
          }
          displacedUpdates[attachment.id] = {
            ...attachment,
            location: { area: 'hand' }
          };
          updatedHand = addToHand(updatedHand, attachment.id);
        }

        updatedCards = {
          ...updatedCards,
          ...displacedUpdates,
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };

        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: null,
          attachedCardIds: []
        };
      } else {
        updatedCards = {
          ...updatedCards,
          [card.id]: {
            ...card,
            location: { area: 'slot', slotId: slot.id }
          }
        };

        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: targetSlot.assistantId && targetSlot.assistantId !== card.id ? targetSlot.assistantId : null,
          attachedCardIds: ensureAttachmentIds(
            currentAttachments.filter((id) => id !== card.id)
          )
        };
      }

      updatedLog = appendLog(updatedLog, `${card.name} settles into ${slot.name}.`);

      return {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand,
        log: updatedLog
      };
    }
    case 'RECALL_CARD': {
      const card = state.cards[action.cardId];
      if (!card) {
        return state;
      }

      if (card.location.area === 'slot') {
        const slot = state.slots[card.location.slotId];
        if (slot && slot.lockedUntil && slot.lockedUntil > now()) {
          return {
            ...state,
            log: appendLog(
              state.log,
              `${card.name} is still committed to ${slot.name}. Wait for the action to resolve before recalling them.`
            )
          };
        }
      }

      let updatedSlots = state.slots;
      if (card.location.area === 'slot') {
        const slot = state.slots[card.location.slotId];
        if (slot) {
          let nextSlot: Slot = slot;
          if (slot.occupantId === card.id) {
            const promotedOccupant =
              slot.assistantId && slot.assistantId !== card.id ? slot.assistantId : null;
            nextSlot = {
              ...slot,
              occupantId: promotedOccupant,
              assistantId:
                promotedOccupant && slot.assistantId === promotedOccupant
                  ? null
                  : slot.assistantId === card.id
                  ? null
                  : slot.assistantId
            };
          } else if (slot.assistantId === card.id) {
            nextSlot = {
              ...slot,
              assistantId: null
            };
          }

          if (nextSlot.attachedCardIds.includes(card.id)) {
            nextSlot = {
              ...nextSlot,
              attachedCardIds: nextSlot.attachedCardIds.filter((id) => id !== card.id)
            };
          }

          if (nextSlot !== slot) {
            updatedSlots = {
              ...state.slots,
              [slot.id]: nextSlot
            };
          }
        }
      }

      return {
        ...state,
        cards: {
          ...state.cards,
          [card.id]: { ...card, location: { area: 'hand' } }
        },
        slots: updatedSlots,
        hand: addToHand(state.hand, card.id),
        log: appendLog(state.log, `${card.name} returns to your hand.`)
      };
    }
    case 'ACTIVATE_SLOT': {
      const result = activateSlot(state, action.slotId);
      const stateWithLog = { ...result.state, log: result.log };
      return stateWithLog;
    }
    case 'UPGRADE_SLOT': {
      const slot = state.slots[action.slotId];
      if (!slot) {
        return state;
      }
      const cost = calculateUpgradeCost(slot);
      if (state.resources.glimmer < cost) {
        return {
          ...state,
          log: appendLog(state.log, `You need ${cost} glimmer to upgrade ${slot.name}.`)
        };
      }

      const upgradedSlot: Slot = {
        ...slot,
        level: slot.level + 1
      };

      return {
        ...state,
        slots: {
          ...state.slots,
          [slot.id]: upgradedSlot
        },
        resources: applyResources(state.resources, { glimmer: -cost }),
        log: appendLog(state.log, `${slot.name} is enhanced to level ${upgradedSlot.level}.`)
      };
    }
    case 'ADVANCE_TIME': {
      const currentTimestamp = now();
      let updatedCards = { ...state.cards };
      let updatedSlots = { ...state.slots };
      let updatedHand = [...state.hand];
      let updatedLog = appendLog(state.log, 'The candle gutters as time presses onward.');

      for (const card of Object.values(state.cards)) {
        if (card.permanent || card.location.area === 'lost') {
          continue;
        }
        const remaining = (card.remainingTurns ?? 0) - 1;
        if (remaining <= 0) {
          if (card.location.area === 'hand') {
            updatedHand = removeFromHand(updatedHand, card.id);
          } else if (card.location.area === 'slot') {
            const slot = updatedSlots[card.location.slotId];
            if (slot && slot.occupantId === card.id) {
              const promotedOccupant =
                slot.assistantId && slot.assistantId !== card.id ? slot.assistantId : null;
              updatedSlots = {
                ...updatedSlots,
                [slot.id]: {
                  ...slot,
                  occupantId: promotedOccupant,
                  assistantId:
                    promotedOccupant && slot.assistantId === promotedOccupant
                      ? null
                      : slot.assistantId === card.id
                      ? null
                      : slot.assistantId
                }
              };
          } else if (slot && slot.assistantId === card.id) {
            updatedSlots = {
              ...updatedSlots,
              [slot.id]: {
                ...slot,
                assistantId: null
              }
            };
          } else if (slot && slot.attachedCardIds.includes(card.id)) {
            updatedSlots = {
              ...updatedSlots,
              [slot.id]: {
                ...slot,
                attachedCardIds: slot.attachedCardIds.filter((id) => id !== card.id)
              }
            };
          }
        }
        delete updatedCards[card.id];
        updatedLog = appendLog(updatedLog, `${card.name} fades before it can be used.`);
        } else {
          updatedCards = {
            ...updatedCards,
            [card.id]: {
              ...card,
              remainingTurns: remaining
            }
          };
        }
      }

      let nextState: GameState = {
        ...state,
        cycle: state.cycle + 1,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand,
        log: updatedLog
      };

      for (const slot of Object.values(updatedSlots)) {
        if (
          slot.state === 'damaged' &&
          slot.repair &&
          slot.repairStarted &&
          slot.occupantId
        ) {
          const occupant = updatedCards[slot.occupantId];
          if (!occupant || occupant.type !== 'persona') {
            continue;
          }

          const remaining = slot.repair.remaining - 1;
          if (remaining <= 0) {
            const targetTemplate = SLOT_TEMPLATES[slot.repair.targetKey];
            if (targetTemplate) {
              const restoredSlot = instantiateSlot(targetTemplate, slot.id);
              updatedSlots = {
                ...updatedSlots,
                [slot.id]: {
                  ...restoredSlot,
                  occupantId: slot.occupantId,
                  assistantId: null
                }
              };

              let completionLog = `${occupant.name} restores ${restoredSlot.name}, ready for use.`;

              if (slot.repair.targetKey === 'study') {
                const journal = createEmptyJournal();
                const journalCard: CardInstance = { ...journal, location: { area: 'hand' } };
                updatedCards = {
                  ...updatedCards,
                  [journalCard.id]: journalCard
                };
                updatedHand = addToHand(updatedHand, journalCard.id);
                completionLog = `${occupant.name} restores ${restoredSlot.name}, uncovering ${journalCard.name}.`;
              }

              updatedLog = appendLog(updatedLog, completionLog);
            }
          } else {
            updatedSlots = {
              ...updatedSlots,
              [slot.id]: {
                ...slot,
                repair: {
                  ...slot.repair,
                  remaining
                }
              }
            };
            const remainingMs = remaining * SLOT_LOCK_BASE_MS;
            updatedLog = appendLog(
              updatedLog,
              `${occupant.name} makes progress restoring ${slot.name}. ≈ ${formatDurationLabel(remainingMs)} remain.`
            );
          }
        }
      }

      nextState = {
        ...nextState,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand,
        log: updatedLog
      };

      nextState = resolvePendingSlotActions(nextState, currentTimestamp);

      if (random() < 0.65) {
        const spawnResult = spawnOpportunity(nextState, nextState.log);
        nextState = { ...spawnResult.state, log: spawnResult.log };
      }

      return nextState;
    }
    case 'RESOLVE_PENDING_SLOT_ACTIONS': {
      return resolvePendingSlotActions(state, now());
    }
    case 'SET_TIME_SCALE': {
      const nextScale = Math.max(0.25, action.scale);
      if (nextScale === state.timeScale) {
        return state;
      }

      const currentTimestamp = now();
      const adjustedSlots: Record<string, Slot> = {};

      for (const [slotId, slot] of Object.entries(state.slots)) {
        if (slot.lockedUntil && slot.lockedUntil > currentTimestamp) {
          const remaining = slot.lockedUntil - currentTimestamp;
          const baseRemaining = Math.round(remaining * state.timeScale);
          const scaledRemaining = Math.max(0, Math.round(baseRemaining / nextScale));
          adjustedSlots[slotId] = {
            ...slot,
            lockedUntil: scaledRemaining > 0 ? currentTimestamp + scaledRemaining : currentTimestamp
          };
        } else {
          adjustedSlots[slotId] = slot;
        }
      }

      return {
        ...state,
        timeScale: nextScale,
        slots: adjustedSlots
      };
    }
    case 'ACKNOWLEDGE_CARD_REVEAL': {
      const index = state.pendingReveals.indexOf(action.cardId);
      if (index === -1) {
        return state;
      }

      const nextPending = state.pendingReveals.filter((id, idx) => idx !== index);

      return {
        ...state,
        pendingReveals: nextPending
      };
    }
    default:
      return state;
  }
}

export interface GameMachine {
  initialState: () => GameState;
  reducer: (state: GameState, action: GameAction) => GameState;
  resolvePendingActions: (state: GameState) => GameState;
  getUpgradeCost: (slot: Slot) => number;
  getScaledLockDuration: (slot: Slot, timeScale: number) => number;
  now: () => number;
}

export interface GameMachineConfig {
  random?: RandomSource;
  clock?: Clock;
}

export function createGameMachine(config: GameMachineConfig = {}): GameMachine {
  if (config.random) {
    setRandomSource(config.random);
  }
  if (config.clock) {
    setClock(config.clock);
  }

  return {
    initialState,
    reducer: (state, action) => gameReducer(state, action),
    resolvePendingActions: (state) => resolvePendingSlotActions(state, now()),
    getUpgradeCost: calculateUpgradeCost,
    getScaledLockDuration: getScaledSlotLockDurationMs,
    now: () => now()
  };
}

