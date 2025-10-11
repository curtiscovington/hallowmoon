export type Species = 'Werewolf' | 'Vampire';
export type LocationKey = 'village' | 'forest' | 'ruins';
export type TrainableStat = 'str' | 'agi' | 'wis';

export type MarketItemKey =
  | 'moon-tonic'
  | 'silvered-armaments'
  | 'occult-primer'
  | 'lunar-wardstone';

export interface MarketItem {
  key: MarketItemKey;
  name: string;
  description: string;
  cost: number;
}

export interface Hero {
  name: string;
  species: Species;
  level: number;
  xp: number;
  coins: number;
  currentHp: number;
  maxHp: number;
  str: number;
  agi: number;
  wis: number;
  energy: number;
  maxEnergy: number;
}

export interface BattleMove {
  key: string;
  name: string;
  description: string;
  type: 'attack' | 'buff' | 'special' | 'debuff';
  chargeTurns?: number;
}

export interface EnemyMove {
  key: string;
  name: string;
  description: string;
  type: 'attack' | 'debuff';
  scale: 'str' | 'wis';
  windUpTurns?: number;
}

export interface BattleStatus {
  key: string;
  label: string;
  description: string;
  type: 'buff' | 'debuff';
  remainingTurns: number;
  modifiers?: Partial<Record<'str' | 'agi' | 'wis', number>>;
  justApplied?: boolean;
}

export interface PendingAction {
  owner: 'hero' | 'enemy';
  key: string;
  name: string;
  description: string;
  remainingTurns: number;
  totalTurns: number;
  payload?: Record<string, number>;
}

export interface Enemy {
  id: string;
  name: string;
  species: Species;
  maxHp: number;
  str: number;
  agi: number;
  wis: number;
  coins: number;
  xp: number;
  description: string;
  moves: EnemyMove[];
}

export interface BattleState {
  enemy: Enemy;
  heroHp: number;
  enemyHp: number;
  heroStrMod: number;
  heroWisMod: number;
  heroAgiMod: number;
  enemyStrMod: number;
  enemyAgiMod: number;
  heroStatuses: BattleStatus[];
  enemyStatuses: BattleStatus[];
  pendingActions: PendingAction[];
  log: string[];
  turn: 'hero' | 'enemy';
}

export type GameView = 'create' | 'hero' | 'map' | 'battle' | 'training' | 'market';

export interface GameState {
  hero: Hero | null;
  view: GameView;
  location: LocationKey;
  battle: BattleState | null;
  message: string | null;
  marketInventory: MarketItem[];
}

export interface PersistedState {
  hero: Hero | null;
  location: LocationKey;
  timestamp: number;
}
