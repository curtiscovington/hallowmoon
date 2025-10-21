import { CardInstance, CardLocation, GameState, Resources, Slot, SlotTemplate } from '../types';
import { CardTemplate, OPPORTUNITY_TEMPLATES } from '../content';
import { createCardInstance } from '../content/cards';
import { getRandomSource } from '../runtime';

export function appendLog(log: string[], message: string): string[] {
  const next = [message, ...log];
  return next.slice(0, 14);
}

export function removeFromHand(hand: string[], cardId: string): string[] {
  return hand.filter((id) => id !== cardId);
}

export function addToHand(hand: string[], cardId: string, toFront = true): string[] {
  const filtered = removeFromHand(hand, cardId);
  return toFront ? [cardId, ...filtered] : [...filtered, cardId];
}

export function applyResources(current: Resources, delta: Partial<Resources>): Resources {
  return {
    coin: Math.max(0, current.coin + (delta.coin ?? 0)),
    lore: Math.max(0, current.lore + (delta.lore ?? 0)),
    glimmer: Math.max(0, current.glimmer + (delta.glimmer ?? 0))
  };
}

export interface SlotCompletionResult {
  state: GameState;
  log: string[];
}

export type InstantiateLocation = CardLocation;

export function createCardId(templateKey: string, random = getRandomSource()): string {
  return `${templateKey}-${random().toString(36).slice(2, 8)}`;
}

export function instantiateCard(
  template: CardTemplate,
  location: InstantiateLocation = { area: 'hand' }
): CardInstance {
  return createCardInstance(template, createCardId(template.key), location);
}

export function instantiateSlot(template: SlotTemplate, id?: string): Slot {
  const repair: Slot['repair'] = template.repair
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

export function randomFrom<T>(options: readonly T[], random = getRandomSource()): T {
  return options[Math.floor(random() * options.length)];
}

export function spawnOpportunity(
  state: GameState,
  log: string[],
  random = getRandomSource()
): { state: GameState; log: string[] } {
  const template = randomFrom(OPPORTUNITY_TEMPLATES, random);
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

interface DeliverCardsParams {
  state: GameState;
  slot: Slot;
  log: string[];
  cardIds: string[];
  reveal: boolean;
}

export function resolveDeliverCardsAction({
  state,
  slot,
  log,
  cardIds,
  reveal
}: DeliverCardsParams): SlotCompletionResult {
  if (!cardIds.length) {
    const clearedSlot: Slot = { ...slot, lockedUntil: null, pendingAction: null };
    return {
      state: {
        ...state,
        slots: {
          ...state.slots,
          [slot.id]: clearedSlot
        }
      },
      log
    };
  }

  let updatedState = state;
  let updatedCards = { ...state.cards };
  let updatedHand = [...state.hand];
  let updatedLog = log;
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

  const updatedSlots = {
    ...updatedState.slots,
    [slot.id]: clearedSlot
  };

  updatedState = {
    ...updatedState,
    cards: updatedCards,
    hand: updatedHand,
    slots: updatedSlots,
    log: updatedLog,
    pendingReveals: reveal ? [...updatedState.pendingReveals, ...cardIds] : updatedState.pendingReveals
  };

  return {
    state: updatedState,
    log: updatedState.log
  };
}
