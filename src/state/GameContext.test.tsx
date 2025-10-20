/* @vitest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { GameProvider, useGame } from './GameContext';
import type { GameState } from './types';

function getSlotByKey(state: GameState, key: string) {
  return Object.values(state.slots).find((slot) => slot.key === key);
}

describe('GameContext manor restoration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('restores the Ruined Archive into a working study and grants a journal', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <GameProvider>{children}</GameProvider>;
    const { result } = renderHook(() => useGame(), { wrapper });

    const heroId = result.current.state.heroCardId;

    const exploreManor = () => {
      const manorSlot = getSlotByKey(result.current.state, 'the-manor');
      expect(manorSlot).toBeDefined();

      act(() => {
        result.current.moveCardToSlot(heroId, manorSlot!.id);
      });

      act(() => {
        result.current.activateSlot(manorSlot!.id);
      });

      const lockedUntil = result.current.state.slots[manorSlot!.id]?.lockedUntil ?? 0;
      expect(lockedUntil).toBeGreaterThan(0);

      act(() => {
        const previous = Date.now();
        const targetTime = lockedUntil + 1000;
        vi.advanceTimersByTime(Math.max(0, targetTime - previous));
        vi.setSystemTime(targetTime);
        result.current.advanceTime();
      });
    };

    exploreManor();
    exploreManor();
    exploreManor();

    const archiveSlot = getSlotByKey(result.current.state, 'ruined-archive');
    expect(archiveSlot).toBeDefined();

    act(() => {
      result.current.moveCardToSlot(heroId, archiveSlot!.id);
    });

    act(() => {
      result.current.activateSlot(archiveSlot!.id);
    });

    const runRepairCycle = () => {
      act(() => {
        const previous = Date.now();
        const targetTime = previous + 60000;
        vi.advanceTimersByTime(60000);
        vi.setSystemTime(targetTime);
        result.current.advanceTime();
      });
    };

    runRepairCycle();
    runRepairCycle();

    const restoredSlot = result.current.state.slots[archiveSlot!.id];
    expect(restoredSlot.key).toBe('night-archive');
    expect(restoredSlot.state).toBe('active');
    expect(restoredSlot.type).toBe('study');

    const journalCard = Object.values(result.current.state.cards).find(
      (card) => card.traits.includes('journal') && card.location.area === 'hand'
    );
    expect(journalCard?.name).toBe('Private Journal');
  });
});
