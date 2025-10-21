import { afterEach, describe, expect, it } from 'vitest';
import { createGameMachine } from './gameMachine';
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

