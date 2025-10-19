export type ResourceType = 'coin' | 'lore' | 'glimmer';

export interface Resources {
  coin: number;
  lore: number;
  glimmer: number;
}

export type CardArchetype = 'persona' | 'inspiration' | 'relic' | 'task';

export interface DiscoverySeed {
  key: string;
  name: string;
  description: string;
}

export interface CardReward {
  resources?: Partial<Resources>;
  discovery?: DiscoverySeed;
}

export type CardLocation =
  | { area: 'hand' }
  | { area: 'slot'; slotId: string }
  | { area: 'lost' };

export interface CardInstance {
  id: string;
  key: string;
  name: string;
  type: CardArchetype;
  description: string;
  traits: string[];
  permanent: boolean;
  remainingTurns: number | null;
  rewards?: CardReward;
  location: CardLocation;
}

export type SlotType = 'hearth' | 'work' | 'study' | 'ritual' | 'expedition' | 'manor' | 'bedroom';

export type SlotState = 'active' | 'damaged';

export interface SlotRepair {
  targetKey: string;
  remaining: number;
  total: number;
}

export type SlotAcceptance = 'persona-only' | 'non-persona' | 'any';

export interface Slot {
  id: string;
  key: string;
  name: string;
  type: SlotType;
  description: string;
  level: number;
  upgradeCost: number;
  traits: string[];
  accepted: SlotAcceptance;
  occupantId: string | null;
  assistantId: string | null;
  unlocked: boolean;
  state: SlotState;
  repair: SlotRepair | null;
  repairStarted: boolean;
}

export interface Discovery {
  id: string;
  key: string;
  name: string;
  description: string;
  cycle: number;
}

export interface GameState {
  cycle: number;
  heroCardId: string;
  cards: Record<string, CardInstance>;
  hand: string[];
  slots: Record<string, Slot>;
  resources: Resources;
  log: string[];
  discoveries: Discovery[];
}
