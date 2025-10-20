import React, {
  Reducer,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef
} from 'react';
import { GameState } from './types';
import { createGameMachine, GameAction, GameMachine } from './gameMachine';
import { SLOT_ACTION_COMPLETION_TOLERANCE_MS } from './content';

interface GameContextValue {
  state: GameState;
  moveCardToSlot: (cardId: string, slotId: string) => void;
  recallCard: (cardId: string) => void;
  activateSlot: (slotId: string) => void;
  upgradeSlot: (slotId: string) => void;
  advanceTime: () => void;
  getUpgradeCost: (slotId: string) => number;
  setTimeScale: (scale: number) => void;
  acknowledgeCardReveal: (cardId: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function useGameMachine(): GameMachine {
  const machineRef = useRef<GameMachine>();
  if (!machineRef.current) {
    machineRef.current = createGameMachine();
  }
  return machineRef.current;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const machine = useGameMachine();
  const initialState = useMemo(() => machine.initialState(), [machine]);
  const reducer = useMemo<Reducer<GameState, GameAction>>(() => machine.reducer, [machine]);
  const [state, dispatch] = useReducer(reducer, initialState);

  const moveCardToSlot = useCallback((cardId: string, slotId: string) => {
    dispatch({ type: 'MOVE_CARD_TO_SLOT', cardId, slotId });
  }, []);

  const recallCard = useCallback((cardId: string) => {
    dispatch({ type: 'RECALL_CARD', cardId });
  }, []);

  const activateSlot = useCallback((slotId: string) => {
    dispatch({ type: 'ACTIVATE_SLOT', slotId });
  }, []);

  const upgradeSlot = useCallback((slotId: string) => {
    dispatch({ type: 'UPGRADE_SLOT', slotId });
  }, []);

  const advanceTime = useCallback(() => {
    dispatch({ type: 'ADVANCE_TIME' });
  }, []);

  const setTimeScale = useCallback((scale: number) => {
    dispatch({ type: 'SET_TIME_SCALE', scale });
  }, []);

  const acknowledgeCardReveal = useCallback((cardId: string) => {
    dispatch({ type: 'ACKNOWLEDGE_CARD_REVEAL', cardId });
  }, []);

  const getUpgradeCost = useCallback(
    (slotId: string) => {
      const slot = state.slots[slotId];
      return slot ? machine.getUpgradeCost(slot) : 0;
    },
    [machine, state.slots]
  );

  useEffect(() => {
    const pendingSlots = Object.values(state.slots).filter((slot) => slot.pendingAction);
    if (pendingSlots.length === 0) {
      return;
    }

    const now = machine.now();
    let earliestReadyAt = Number.POSITIVE_INFINITY;

    for (const slot of pendingSlots) {
      const readyAt = slot.lockedUntil ?? now;
      if (readyAt < earliestReadyAt) {
        earliestReadyAt = readyAt;
      }
    }

    if (!Number.isFinite(earliestReadyAt)) {
      return;
    }

    if (earliestReadyAt <= now + SLOT_ACTION_COMPLETION_TOLERANCE_MS) {
      dispatch({ type: 'RESOLVE_PENDING_SLOT_ACTIONS' });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({ type: 'RESOLVE_PENDING_SLOT_ACTIONS' });
    }, Math.max(0, earliestReadyAt - now) + SLOT_ACTION_COMPLETION_TOLERANCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [machine, state.slots]);

  const value = useMemo(
    () => ({
      state,
      moveCardToSlot,
      recallCard,
      activateSlot,
      upgradeSlot,
      advanceTime,
      getUpgradeCost,
      setTimeScale,
      acknowledgeCardReveal
    }),
    [
      state,
      moveCardToSlot,
      recallCard,
      activateSlot,
      upgradeSlot,
      advanceTime,
      getUpgradeCost,
      setTimeScale,
      acknowledgeCardReveal
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
