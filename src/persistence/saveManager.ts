import { PersistedState } from '../state/types';

const SAVE_KEY = 'hallowmoon.save.v1';

export function loadGame(): PersistedState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PersistedState;
  } catch (error) {
    console.error('Failed to parse save data', error);
    return null;
  }
}

export function saveGame(state: PersistedState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearGame(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(SAVE_KEY);
}
