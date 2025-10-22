import { CardInstance, Discovery, DiscoverySeed, GameState, Resources, Slot, SlotRepair } from './types';
import {
  CardTemplate,
  HERO_TEMPLATE,
  OPPORTUNITY_TEMPLATES,
  SLOT_ACTION_COMPLETION_TOLERANCE_MS,
  SLOT_LOCK_BASE_MS,
  SLOT_LOCK_DURATIONS,
  SLOT_TEMPLATES,
  SlotTemplate
} from './content';
import { createCardInstance } from './content/cards';
import { buildStoryLog } from '../content/storyBeats';
import { formatDurationLabel } from '../utils/time';
import { resolveCardAbility } from './cards/abilities';
import {
  SLOT_BEHAVIORS,
  type SlotActionResult,
  type SlotBehaviorUtils,
  type SlotCardPlacementContext
} from './slots/behaviors';
import { createEmptyJournal } from './slots/study';
import { MANOR_ROOM_TEMPLATE_KEYS } from './slots/manor';

type RandomSource = () => number;
type Clock = () => number;

let randomSource: RandomSource = Math.random;
let clockNow: Clock = () => Date.now();

function createCardId(templateKey: string): string {
  return `${templateKey}-${randomSource().toString(36).slice(2, 8)}`;
}

function instantiateCard(template: CardTemplate): CardInstance {
  return createCardInstance(template, createCardId(template.key), { area: 'hand' });
}

function instantiateSlot(template: SlotTemplate, id?: string): Slot {
  const repair: SlotRepair | null = template.repair
    ? {
        targetKey: template.repair.targetKey,
        remaining: template.repair.time,
        total: template.repair.time
      }
    : null;

  return {
    id: id ?? `slot-${template.key}`,
    key: template.key,
    name: template.name,
    type: template.type,
    description: template.description,
    level: 1,
    upgradeCost: template.upgradeCost,
    traits: [...template.traits],
    accepted: template.accepted,
    occupantId: null,
    assistantId: null,
    unlocked: template.unlocked ?? true,
    state: template.state ?? 'active',
    repair,
    repairStarted: false,
    lockedUntil: null,
    pendingAction: null,
    attachedCardIds: []
  };
}

function randomFrom<T>(options: readonly T[]): T {
  return options[Math.floor(randomSource() * options.length)];
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

function appendLog(log: string[], message: string): string[] {
  const next = [message, ...log];
  return next.slice(0, 14);
}

function removeFromHand(hand: string[], cardId: string): string[] {
  return hand.filter((id) => id !== cardId);
}

function addToHand(hand: string[], cardId: string, toFront = true): string[] {
  const filtered = removeFromHand(hand, cardId);
  return toFront ? [cardId, ...filtered] : [...filtered, cardId];
}

function calculateUpgradeCost(slot: Slot): number {
  return slot.upgradeCost + (slot.level - 1) * 2;
}

function applyResources(current: Resources, delta: Partial<Resources>): Resources {
  return {
    coin: Math.max(0, current.coin + (delta.coin ?? 0)),
    lore: Math.max(0, current.lore + (delta.lore ?? 0)),
    glimmer: Math.max(0, current.glimmer + (delta.glimmer ?? 0))
  };
}

function maybeUnlockExpeditionSlot(state: GameState): GameState {
  const hasSlot = Object.values(state.slots).some((slot) => slot.type === 'expedition');
  if (hasSlot) {
    return state;
  }

  const discovery = state.discoveries.find((entry) => entry.key === 'umbral-gate');
  if (!discovery) {
    return state;
  }

  const expeditionTemplate = SLOT_TEMPLATES.expedition;
  const expeditionSlot = instantiateSlot(expeditionTemplate);
  const updatedSlots = {
    ...state.slots,
    [expeditionSlot.id]: expeditionSlot
  };

  return {
    ...state,
    slots: updatedSlots,
    log: appendLog(state.log, 'The Umbral Gate yawns open, offering expeditions into the Hollow Ways.')
  };
}

function applyDiscovery(state: GameState, seed: DiscoverySeed): GameState {
  const alreadyKnown = state.discoveries.some((entry) => entry.key === seed.key);
  if (alreadyKnown) {
    return state;
  }

  const discovery: Discovery = {
    id: `${seed.key}-${clockNow().toString(36)}`,
    key: seed.key,
    name: seed.name,
    description: seed.description,
    cycle: state.cycle
  };

  const updatedState: GameState = {
    ...state,
    discoveries: [discovery, ...state.discoveries],
    log: appendLog(state.log, `Discovery gained: ${seed.name}. ${seed.description}`)
  };

  return maybeUnlockExpeditionSlot(updatedState);
}

function spawnOpportunity(state: GameState, log: string[]): {
  state: GameState;
  log: string[];
} {
  const template = randomFrom(OPPORTUNITY_TEMPLATES);
  const card = instantiateCard(template);

  const nextState: GameState = {
    ...state,
    cards: {
      ...state.cards,
      [card.id]: card
    },
    hand: addToHand(state.hand, card.id, false)
  };

  const nextLog = appendLog(log, `${card.name} drifts within reach, inviting attention.`);

  return { state: nextState, log: nextLog };
}

const slotBehaviorUtils: SlotBehaviorUtils = {
  appendLog,
  applyResources,
  applyDiscovery,
  random: () => randomSource(),
  spawnOpportunity,
  createCard: instantiateCard,
  createSlot: instantiateSlot,
  addToHand,
  removeFromHand
};

function getSlotBaseLockDurationMs(slot: Slot, state?: GameState): number {
  const behavior = SLOT_BEHAVIORS[slot.type];
  if (behavior && state) {
    const context = { state, slot, log: state.log };
    const override = behavior.getLockDurationMs?.(context, slotBehaviorUtils);
    if (typeof override === 'number' && !Number.isNaN(override)) {
      return override;
    }
  }

  const base = SLOT_LOCK_DURATIONS[slot.type] ?? SLOT_LOCK_BASE_MS;
  if (slot.type === 'manor' && slot.state === 'damaged') {
    return base * 2;
  }
  return base;
}

function getScaledSlotLockDurationMs(slot: Slot, timeScale: number, state?: GameState): number {
  const baseDuration = getSlotBaseLockDurationMs(slot, state);
  const scale = Math.max(timeScale, 0.25);
  return Math.max(250, Math.round(baseDuration / scale));
}

function isCardAllowedInSlot(state: GameState, card: CardInstance, slot: Slot): boolean {
  const behavior = SLOT_BEHAVIORS[slot.type];
  if (behavior?.acceptsCard) {
    const context = { state, slot };
    if (!behavior.acceptsCard(card, context, slotBehaviorUtils)) {
      return false;
    }
  }

  if (slot.accepted === 'persona-only') {
    return card.type === 'persona';
  }
  if (slot.accepted === 'non-persona') {
    return card.type !== 'persona';
  }
  return true;
}

function completeManorExploration(state: GameState, slotId: string, log: string[]): {
  state: GameState;
  log: string[];
} {
  const currentSlot = state.slots[slotId];
  if (!currentSlot) {
    return { state, log };
  }

  const persona = currentSlot.occupantId ? state.cards[currentSlot.occupantId] ?? null : null;
  const missingKeys = MANOR_ROOM_TEMPLATE_KEYS.filter((templateKey) => {
    const template = SLOT_TEMPLATES[templateKey];
    const restoredKey = template.repair ? SLOT_TEMPLATES[template.repair.targetKey].key : null;
    return !Object.values(state.slots).some(
      (existing) => existing.key === template.key || (restoredKey ? existing.key === restoredKey : false)
    );
  });

  const updatedSlots: Record<string, Slot> = { ...state.slots };
  const revealedRooms: string[] = [];

  if (missingKeys.length > 0) {
    const selectedKey = missingKeys[0];
    const template = SLOT_TEMPLATES[selectedKey];
    const newRoom = instantiateSlot(template);
    updatedSlots[newRoom.id] = newRoom;
    revealedRooms.push(newRoom.name);
  }

  const shouldRemoveManor = missingKeys.length <= 1;

  if (shouldRemoveManor) {
    delete updatedSlots[slotId];
  } else {
    updatedSlots[slotId] = {
      ...currentSlot,
      occupantId: null,
      pendingAction: null,
      lockedUntil: null
    };
  }

  let updatedCards = state.cards;
  let updatedHand = state.hand;
  if (persona) {
    updatedCards = {
      ...state.cards,
      [persona.id]: { ...persona, location: { area: 'hand' } }
    };
    updatedHand = addToHand(state.hand, persona.id);
  }

  let nextLog = log;
  const explorerName = persona ? persona.name : 'Your retinue';

  if (revealedRooms.length > 0) {
    const roomsFragment = revealedRooms.join(', ');
    const summary = shouldRemoveManor
      ? `${explorerName} charts the manor’s halls, revealing ${roomsFragment} before the manor’s entrance seals behind them.`
      : `${explorerName} charts the manor’s halls, revealing ${roomsFragment}. More ruined chambers await discovery.`;
    nextLog = appendLog(log, summary);
  } else {
    nextLog = appendLog(
      log,
      `${explorerName} finds no further chambers awaiting discovery as the manor’s entrance seals behind them.`
    );
  }

  return {
    state: {
      ...state,
      slots: updatedSlots,
      cards: updatedCards,
      hand: updatedHand,
      log: nextLog
    },
    log: nextLog
  };
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
        nextState = result.state;
        break;
      }
      case 'deliver-cards': {
        const { cardIds, reveal } = slot.pendingAction;
        let updatedState = nextState;
        let updatedCards = { ...updatedState.cards };
        let updatedHand = [...updatedState.hand];
        let updatedSlots = { ...updatedState.slots };
        let updatedLog = updatedState.log;
        const deliveredNames: string[] = [];

        for (const cardId of cardIds) {
          const card = updatedCards[cardId];
          if (!card) {
            continue;
          }
          deliveredNames.push(card.name);
          updatedCards = {
            ...updatedCards,
            [cardId]: { ...card, location: { area: 'hand' } }
          };
          updatedHand = addToHand(updatedHand, cardId, false);
        }

        if (deliveredNames.length > 0) {
          const summary = `${slot.name} yields ${deliveredNames.join(', ')}.`;
          updatedLog = appendLog(updatedLog, summary);
        }

        const clearedSlot: Slot = {
          ...slot,
          lockedUntil: null,
          pendingAction: null
        };

        updatedSlots = {
          ...updatedSlots,
          [slotId]: clearedSlot
        };

        const pendingReveals = reveal
          ? [...updatedState.pendingReveals, ...cardIds]
          : updatedState.pendingReveals;

        updatedState = {
          ...updatedState,
          cards: updatedCards,
          hand: updatedHand,
          slots: updatedSlots,
          log: updatedLog,
          pendingReveals
        };

        nextState = updatedState;
        break;
      }
      default:
        break;
    }
  }

  return nextState;
}

function activateSlot(state: GameState, slotId: string): SlotActionResult {
  const preparedState = resolvePendingSlotActions(state, clockNow());
  const slot = preparedState.slots[slotId];
  if (!slot || !slot.unlocked) {
    return {
      state: preparedState,
      log: appendLog(preparedState.log, 'That slot is not yet available.'),
      performed: false
    };
  }

  const now = clockNow();
  if (slot.lockedUntil && slot.lockedUntil > now) {
    const remaining = slot.lockedUntil - now;
    const message = `${slot.name} is still resolving a previous action. ≈ ${formatDurationLabel(remaining)} remain.`;
    return {
      state: preparedState,
      log: appendLog(preparedState.log, message),
      performed: false
    };
  }

  const log = preparedState.log;

  const behavior = SLOT_BEHAVIORS[slot.type];
  if (!behavior) {
    return {
      state: preparedState,
      log: appendLog(log, `No behavior is defined for ${slot.name}.`),
      performed: false
    };
  }

  const context = { state: preparedState, slot, log };
  const result = behavior.activate(context, slotBehaviorUtils);

  if (!result.performed) {
    return result;
  }

  const refreshedSlot = result.state.slots[slotId];
  if (!refreshedSlot) {
    return result;
  }

  const lockDuration = getScaledSlotLockDurationMs(refreshedSlot, result.state.timeScale, result.state);
  const lockedSlot: Slot = {
    ...refreshedSlot,
    lockedUntil: clockNow() + lockDuration
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
        if (originSlot && originSlot.lockedUntil && originSlot.lockedUntil > clockNow()) {
          return {
            ...state,
            log: appendLog(
              state.log,
              `${card.name} is still committed to ${originSlot.name}. Wait for the action to resolve before moving them.`
            )
          };
        }
      }

      let updatedSlots: Record<string, Slot> = { ...state.slots };
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

      let workingState: GameState = {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand,
        log: updatedLog
      };

      const behavior = SLOT_BEHAVIORS[slot.type];

      const buildPlacementContext = (snapshot: GameState): SlotCardPlacementContext | null => {
        const slotSnapshot = snapshot.slots[slot.id];
        if (!slotSnapshot) {
          return null;
        }
        const occupant = slotSnapshot.occupantId ? snapshot.cards[slotSnapshot.occupantId] ?? null : null;
        const assistant = slotSnapshot.assistantId ? snapshot.cards[slotSnapshot.assistantId] ?? null : null;
        const attachments = slotSnapshot.attachedCardIds
          .map((id) => snapshot.cards[id])
          .filter((attached): attached is CardInstance => Boolean(attached));
        const cardSnapshot = snapshot.cards[card.id] ?? card;

        return {
          state: snapshot,
          slot: slotSnapshot,
          card: cardSnapshot,
          occupant,
          assistant,
          attachments,
          log: snapshot.log
        };
      };

      if (behavior?.onCardPlaced) {
        const placementContext = buildPlacementContext(workingState);
        if (placementContext) {
          const placementResult = behavior.onCardPlaced(placementContext, slotBehaviorUtils);
          workingState = { ...placementResult.state, log: placementResult.log };
          if (placementResult.handled) {
            return workingState;
          }
        }
      }

      updatedCards = workingState.cards;
      updatedSlots = workingState.slots;
      updatedHand = workingState.hand;
      updatedLog = workingState.log;

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
        if (slot && slot.lockedUntil && slot.lockedUntil > clockNow()) {
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
      const now = clockNow();
      let updatedCards = { ...state.cards };
      let updatedSlots = { ...state.slots };
      let updatedHand = [...state.hand];
      let updatedLog = appendLog(state.log, 'The candle gutters as time presses onward.');
      let updatedPendingReveals = [...state.pendingReveals];

      for (const card of Object.values(state.cards)) {
        if (card.permanent || card.location.area === 'lost') {
          continue;
        }
        const expireAbility = resolveCardAbility(card).onExpire;
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
        updatedPendingReveals = updatedPendingReveals.filter((id) => id !== card.id);
        const expireMessage =
          expireAbility === 'expire:fading'
            ? `${card.name} fades before it can be used.`
            : `${card.name} fades before it can be used.`;
        updatedLog = appendLog(updatedLog, expireMessage);
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
        log: updatedLog,
        pendingReveals: updatedPendingReveals
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
                const journal = createEmptyJournal(slotBehaviorUtils);
                const journalCard: CardInstance = { ...journal, location: { area: 'hand' } };
                updatedCards = {
                  ...updatedCards,
                  [journalCard.id]: journalCard
                };
                updatedHand = addToHand(updatedHand, journalCard.id);
                updatedPendingReveals = [...updatedPendingReveals, journalCard.id];
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
        log: updatedLog,
        pendingReveals: updatedPendingReveals
      };

      nextState = resolvePendingSlotActions(nextState, now);

      if (randomSource() < 0.65) {
        const spawnResult = spawnOpportunity(nextState, nextState.log);
        nextState = { ...spawnResult.state, log: spawnResult.log };
      }

      return nextState;
    }
    case 'RESOLVE_PENDING_SLOT_ACTIONS': {
      return resolvePendingSlotActions(state, clockNow());
    }
    case 'SET_TIME_SCALE': {
      const nextScale = Math.max(0.25, action.scale);
      if (nextScale === state.timeScale) {
        return state;
      }

      const now = clockNow();
      const adjustedSlots: Record<string, Slot> = {};

      for (const [slotId, slot] of Object.entries(state.slots)) {
        if (slot.lockedUntil && slot.lockedUntil > now) {
          const remaining = slot.lockedUntil - now;
          const baseRemaining = Math.round(remaining * state.timeScale);
          const scaledRemaining = Math.max(0, Math.round(baseRemaining / nextScale));
          adjustedSlots[slotId] = {
            ...slot,
            lockedUntil: scaledRemaining > 0 ? now + scaledRemaining : now
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
    randomSource = config.random;
  }
  if (config.clock) {
    clockNow = config.clock;
  }

  return {
    initialState,
    reducer: (state, action) => gameReducer(state, action),
    resolvePendingActions: (state) => resolvePendingSlotActions(state, clockNow()),
    getUpgradeCost: calculateUpgradeCost,
    getScaledLockDuration: getScaledSlotLockDurationMs,
    now: () => clockNow()
  };
}

