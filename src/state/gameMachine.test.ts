import { describe, expect, it } from 'vitest';
import { createGameMachine } from './gameMachine';
import { SLOT_TEMPLATES } from './content';
import { SLOT_BEHAVIORS } from './slots/behaviors';
import { createCardInstance, type CardTemplate } from './content/cards';
import type { Slot } from './types';

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

function buildSlotFromTemplate(templateKey: keyof typeof SLOT_TEMPLATES, id: string): Slot {
  const template = SLOT_TEMPLATES[templateKey];
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
    unlocked: template.unlocked ?? true,
    state: template.state ?? 'active',
    repair: template.repair
      ? {
          targetKey: template.repair.targetKey,
          remaining: template.repair.time,
          total: template.repair.time
        }
      : null,
    repairStarted: false,
    lockedUntil: null,
    pendingAction: null,
    attachedCardIds: []
  };
}

function buildStudySlot(id: string): Slot {
  return buildSlotFromTemplate('study', id);
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

  it('prevents permanent study subjects from being consumed', () => {
    const machine = createTestMachine();
    let state = machine.initialState();

    const studySlot = buildStudySlot('study-slot-permanent');
    state = {
      ...state,
      slots: {
        ...state.slots,
        [studySlot.id]: studySlot
      }
    };

    const permanentTemplate = {
      key: 'everlasting-tome',
      name: 'Everlasting Tome',
      type: 'relic',
      description: 'An enduring record that should only grow with new insights.',
      traits: ['immutable'],
      permanent: true,
      ability: { onActivate: 'study:reward' },
      rewards: { resources: { lore: 3 } }
    } satisfies CardTemplate;

    const permanentCard = createCardInstance(permanentTemplate, 'everlasting-tome-card', { area: 'hand' });

    state = {
      ...state,
      cards: {
        ...state.cards,
        [permanentCard.id]: permanentCard
      },
      hand: [...state.hand, permanentCard.id]
    };

    state = machine.reducer(state, {
      type: 'MOVE_CARD_TO_SLOT',
      cardId: permanentCard.id,
      slotId: studySlot.id
    });

    const previousResources = { ...state.resources };

    state = machine.reducer(state, {
      type: 'ACTIVATE_SLOT',
      slotId: studySlot.id
    });

    expect(state.cards[permanentCard.id]).toBeDefined();
    expect(state.cards[permanentCard.id]?.location).toEqual({ area: 'slot', slotId: studySlot.id });
    expect(state.slots[studySlot.id].occupantId).toBe(permanentCard.id);
    expect(state.resources).toEqual(previousResources);
    expect(state.log[0]).toContain('Permanent records resist');
  });
});

describe('time scale controls', () => {
  it('pauses slot locks and resumes without losing progress', () => {
    let now = 1000;
    const machine = createGameMachine({ clock: () => now });
    let state = machine.initialState();

    const studySlot = buildStudySlot('timing-slot');
    const initialLock = now + 60000;

    state = {
      ...state,
      slots: {
        ...state.slots,
        [studySlot.id]: { ...studySlot, lockedUntil: initialLock }
      }
    };

    state = machine.reducer(state, { type: 'SET_TIME_SCALE', scale: 0 });
    expect(state.pausedAt).toBe(1000);
    expect(state.slots[studySlot.id]?.lockedUntil).toBe(initialLock);

    now += 5000;

    state = machine.reducer(state, { type: 'SET_TIME_SCALE', scale: 1 });
    expect(state.pausedAt).toBeNull();
    expect(state.timeScale).toBe(1);
    expect(state.slots[studySlot.id]?.lockedUntil).toBe(initialLock + 5000);
  });

  it('rescales remaining lock duration when resuming at a new speed', () => {
    let now = 2000;
    const machine = createGameMachine({ clock: () => now });
    let state = machine.initialState();

    const studySlot = buildStudySlot('timing-slot-fast');
    const initialLock = now + 60000;

    state = {
      ...state,
      slots: {
        ...state.slots,
        [studySlot.id]: { ...studySlot, lockedUntil: initialLock }
      }
    };

    state = machine.reducer(state, { type: 'SET_TIME_SCALE', scale: 0 });
    now += 5000;

    state = machine.reducer(state, { type: 'SET_TIME_SCALE', scale: 2 });
    expect(state.pausedAt).toBeNull();
    expect(state.timeScale).toBe(2);
    const resumedSlot = state.slots[studySlot.id];
    expect(resumedSlot?.lockedUntil).toBe(37000);
  });
});

describe('slot behavior registry', () => {
  it('invokes registered behaviors and applies lock overrides', () => {
    const machine = createGameMachine({ clock: () => 0 });
    let state = machine.initialState();

    const workSlot = buildSlotFromTemplate('work', 'mock-work-slot');
    state = {
      ...state,
      slots: {
        ...state.slots,
        [workSlot.id]: workSlot
      }
    };

    const heroId = state.heroCardId;
    state = machine.reducer(state, {
      type: 'MOVE_CARD_TO_SLOT',
      cardId: heroId,
      slotId: workSlot.id
    });

    const originalBehavior = SLOT_BEHAVIORS.work;
    SLOT_BEHAVIORS.work = {
      activate: ({ state: currentState, slot, log }, utils) => {
        const nextLog = utils.appendLog(log, `Mock behavior activates ${slot.name}.`);
        return {
          state: { ...currentState, log: nextLog },
          log: nextLog,
          performed: true
        };
      },
      getLockDurationMs: () => 5000
    };

    try {
      state = machine.reducer(state, { type: 'ACTIVATE_SLOT', slotId: workSlot.id });
    } finally {
      if (originalBehavior) {
        SLOT_BEHAVIORS.work = originalBehavior;
      } else {
        delete SLOT_BEHAVIORS.work;
      }
    }

    const updatedSlot = state.slots[workSlot.id];
    expect(updatedSlot.lockedUntil).toBe(5000);
    expect(state.log.some((entry) => entry.includes('Mock behavior activates'))).toBe(true);
  });

  it('reports an error when no behavior is registered for a slot', () => {
    const machine = createGameMachine({ clock: () => 0 });
    let state = machine.initialState();

    const workSlot = buildSlotFromTemplate('work', 'missing-behavior-slot');
    state = {
      ...state,
      slots: {
        ...state.slots,
        [workSlot.id]: workSlot
      }
    };

    const heroId = state.heroCardId;
    state = machine.reducer(state, {
      type: 'MOVE_CARD_TO_SLOT',
      cardId: heroId,
      slotId: workSlot.id
    });

    const originalBehavior = SLOT_BEHAVIORS.work;
    delete SLOT_BEHAVIORS.work;

    try {
      state = machine.reducer(state, { type: 'ACTIVATE_SLOT', slotId: workSlot.id });
    } finally {
      if (originalBehavior) {
        SLOT_BEHAVIORS.work = originalBehavior;
      }
    }

    expect(state.slots[workSlot.id].lockedUntil).toBeNull();
    expect(state.log.some((entry) => entry.includes('No behavior is defined'))).toBe(true);
  });
});

