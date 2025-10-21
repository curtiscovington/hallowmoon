import { afterEach, describe, expect, it } from 'vitest';
import { createGameMachine } from './gameMachine';
import { SLOT_TEMPLATES } from './content';
import { createCardInstance, type CardTemplate } from './content/cards';
import type { Slot } from './types';
import { registerSlotBehavior, resetSlotBehaviors, unregisterSlotBehavior } from './slots/behaviors';

afterEach(() => {
  resetSlotBehaviors();
});

describe('createGameMachine', () => {
  it('uses injected random and clock when generating the initial state', () => {
    const randomValues = [0.123456, 0.654321];
    let now = 42;
    const machine = createGameMachine({
      random: () => randomValues.shift() ?? 0.1,
      clock: () => now
    });

    const state = machine.initialState();

    const heroIdSuffix = (0.123456).toString(36).slice(2, 8);
    expect(state.heroCardId).toBe(`persona-initiate-${heroIdSuffix}`);
    expect(state.cards[state.heroCardId]?.name).toBe('Initiate of the Veiled Star');

    const whisperId = state.hand.find((id) => id !== state.heroCardId);
    const whisperSuffix = (0.654321).toString(36).slice(2, 8);
    expect(whisperId).toBe(`fading-whisper-${whisperSuffix}`);

    expect(machine.now()).toBe(42);
    now = 42000;
    expect(machine.now()).toBe(42000);
  });

  it('exposes helpers for upgrade costs and lock durations', () => {
    const machine = createGameMachine();
    const state = machine.initialState();

    const manorSlot = Object.values(state.slots).find((slot) => slot.key === 'the-manor');
    expect(manorSlot).toBeDefined();
    expect(machine.getUpgradeCost(manorSlot!)).toBe(manorSlot!.upgradeCost);

    const scaled = machine.getScaledLockDuration(manorSlot!, 2);
    expect(scaled).toBeGreaterThan(0);

    const resolved = machine.resolvePendingActions(state);
    expect(resolved).toEqual(state);
  });
});

describe('slot behavior registry', () => {
  it('uses registered slot behaviors when activating slots', () => {
    let currentTime = 1000;
    const machine = createGameMachine({ clock: () => currentTime });
    const state = machine.initialState();
    const manorSlot = Object.values(state.slots).find((slot) => slot.type === 'manor');
    expect(manorSlot).toBeDefined();

    let activated = false;
    registerSlotBehavior('manor', {
      activate: ({ state: inputState, slot, log }) => {
        activated = true;
        return {
          state: inputState,
          log: ['custom-behavior', ...log],
          performed: true
        };
      },
      getLockDurationMs: () => 5000
    });

    const nextState = machine.reducer(state, { type: 'ACTIVATE_SLOT', slotId: manorSlot!.id });

    expect(activated).toBe(true);
    const refreshedSlot = nextState.slots[manorSlot!.id];
    expect(refreshedSlot?.lockedUntil).toBe(currentTime + 5000);
    expect(nextState.log).toContain('custom-behavior');
  });

  it('logs an error when a slot type has no registered behavior', () => {
    const machine = createGameMachine();
    const state = machine.initialState();
    const manorSlot = Object.values(state.slots).find((slot) => slot.type === 'manor');
    expect(manorSlot).toBeDefined();

    unregisterSlotBehavior('manor');

    const nextState = machine.reducer(state, { type: 'ACTIVATE_SLOT', slotId: manorSlot!.id });

    expect(nextState.slots[manorSlot!.id].lockedUntil).toBeNull();
    expect(nextState.log[0]).toBe('No behavior is registered for slot type manor.');
  });
});

function buildStudySlot(id: string): Slot {
  const template = SLOT_TEMPLATES.study;
  return {
    id,
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
    unlocked: true,
    state: 'active',
    repair: null,
    repairStarted: false,
    lockedUntil: null,
    pendingAction: null,
    attachedCardIds: []
  };
}

function createTestMachine() {
  const randomValues = [0.123456, 0.654321, 0.222222];
  return createGameMachine({
    random: () => randomValues.shift() ?? 0.5,
    clock: () => 0
  });
}

describe('card ability behaviors', () => {
  it('applies study rewards through ability metadata', () => {
    const machine = createTestMachine();
    let state = machine.initialState();

    const studySlot = buildStudySlot('study-slot');
    state = {
      ...state,
      slots: {
        ...state.slots,
        [studySlot.id]: studySlot
      }
    };

    const whisperId = state.hand.find((id) => id !== state.heroCardId);
    expect(whisperId).toBeDefined();

    state = machine.reducer(state, {
      type: 'MOVE_CARD_TO_SLOT',
      cardId: whisperId!,
      slotId: studySlot.id
    });

    state = machine.reducer(state, {
      type: 'ACTIVATE_SLOT',
      slotId: studySlot.id
    });

    expect(state.cards[whisperId!]).toBeUndefined();
    expect(state.resources.lore).toBe(2);
    expect(state.resources.glimmer).toBe(2);
    expect(state.log.some((entry) => entry.includes('is deciphered, yielding'))).toBe(true);
  });

  it('resolves persona reflection when studying a persona without explicit ability metadata', () => {
    const machine = createTestMachine();
    let state = machine.initialState();

    const studySlot = buildStudySlot('study-slot-persona');
    state = {
      ...state,
      slots: {
        ...state.slots,
        [studySlot.id]: studySlot
      }
    };

    const heroId = state.heroCardId;
    state = machine.reducer(state, {
      type: 'MOVE_CARD_TO_SLOT',
      cardId: heroId,
      slotId: studySlot.id
    });

    const previousLore = state.resources.lore;

    state = machine.reducer(state, {
      type: 'ACTIVATE_SLOT',
      slotId: studySlot.id
    });

    expect(state.resources.lore).toBe(previousLore + 1);
    expect(state.cards[heroId]?.location).toEqual({ area: 'slot', slotId: studySlot.id });
    expect(state.log.some((entry) => entry.includes('reflects upon their path'))).toBe(true);
  });

  it('records dreams using trait-derived ability defaults', () => {
    const machine = createTestMachine();
    let state = machine.initialState();

    const studySlot = buildStudySlot('study-slot-dream');
    state = {
      ...state,
      slots: {
        ...state.slots,
        [studySlot.id]: studySlot
      }
    };

    const heroId = state.heroCardId;

    const dreamTemplate = {
      key: 'test-dream',
      name: 'Fleeting Dream: Test',
      type: 'inspiration',
      description: 'A testing dream awaiting transcription.',
      traits: ['dream', 'fleeting'],
      permanent: false,
      lifetime: 2
    } satisfies CardTemplate;

    const dreamCard = createCardInstance(dreamTemplate, 'test-dream-card', { area: 'hand' });

    state = {
      ...state,
      cards: {
        ...state.cards,
        [dreamCard.id]: dreamCard
      },
      hand: [...state.hand, dreamCard.id]
    };

    state = machine.reducer(state, {
      type: 'MOVE_CARD_TO_SLOT',
      cardId: heroId,
      slotId: studySlot.id
    });

    state = machine.reducer(state, {
      type: 'MOVE_CARD_TO_SLOT',
      cardId: dreamCard.id,
      slotId: studySlot.id
    });

    state = machine.reducer(state, {
      type: 'ACTIVATE_SLOT',
      slotId: studySlot.id
    });

    const slotAfter = state.slots[studySlot.id];
    expect(slotAfter.occupantId).toBe(heroId);
    expect(slotAfter.pendingAction?.type).toBe('deliver-cards');
    const journalId = slotAfter.pendingAction?.cardIds[0];
    expect(journalId).toBeDefined();

    if (journalId) {
      const journalCard = state.cards[journalId];
      expect(journalCard?.location.area).toBe('lost');
      expect(journalCard?.traits).toContain('journal');
    }

    expect(state.cards[dreamCard.id]).toBeUndefined();
    expect(state.hand.includes(dreamCard.id)).toBe(false);
    expect(state.log.some((entry) => entry.includes('records') || entry.includes('expands'))).toBe(true);
  });
});

