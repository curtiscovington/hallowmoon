export type Species = 'Werewolf' | 'Vampire';
export type LocationKey = 'village' | 'forest' | 'ruins';
export type TrainableStat = 'str' | 'agi' | 'wis';

export interface VisualAsset {
  src: string;
  alt: string;
  credit?: string;
}

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
  artwork?: VisualAsset;
  flavor?: string;
}

export type LootRarity = 'common' | 'rare' | 'epic';

export interface BattleRewardItem {
  id: string;
  name: string;
  description: string;
  rarity: LootRarity;
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
  location: LocationKey;
  maxHp: number;
  str: number;
  agi: number;
  wis: number;
  coins: number;
  xp: number;
  description: string;
  moves: EnemyMove[];
  artwork?: VisualAsset;
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

export interface HeroProgressSnapshot {
  before: {
    level: number;
    xp: number;
    coins: number;
  };
  after: {
    level: number;
    xp: number;
    coins: number;
  };
  levelUps: string[];
}

export interface PostBattleRewards {
  enemyName: string;
  enemyArtwork?: VisualAsset;
  xpEarned: number;
  coinsEarned: number;
  items: BattleRewardItem[];
  heroProgress: HeroProgressSnapshot;
}

export type GameView =
  | 'create'
  | 'hero'
  | 'map'
  | 'battle'
  | 'training'
  | 'market'
  | 'post-battle';

export interface GameState {
  hero: Hero | null;
  view: GameView;
  location: LocationKey;
  battle: BattleState | null;
  message: string | null;
  marketInventory: MarketItem[];
  postBattleRewards: PostBattleRewards | null;
}

export interface PersistedState {
  hero: Hero | null;
  location: LocationKey;
  timestamp: number;
}
