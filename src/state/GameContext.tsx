/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { clearGame, loadGame, saveGame } from '../persistence/saveManager';
import {
  applyEnemyTurn,
  applyHeroMove,
  createEnemy,
  HERO_MOVES
} from './combat';
import {
  BattleMove,
  BattleState,
  BattleRewardItem,
  Enemy,
  GameState,
  Hero,
  LocationKey,
  MarketItem,
  MarketItemKey,
  PostBattleRewards,
  RunOption,
  RunRelic,
  RunState,
  RunStepLog,
  Species,
  TownProgress,
  TrainableStat
} from './types';
import { marketCompendium } from '../content/compendium';

interface GameContextValue {
  state: GameState;
  createHero: (name: string, species: Species) => void;
  viewHero: () => void;
  goToMap: () => void;
  startTraining: () => void;
  train: (stat: TrainableStat) => void;
  rest: () => void;
  visitMarket: () => void;
  buyFromMarket: (itemKey: MarketItemKey) => void;
  startBattle: (location: LocationKey) => void;
  beginForestRun: () => void;
  chooseRunOption: (optionId: string) => void;
  abandonRun: () => void;
  performHeroMove: (moveKey: string) => void;
  retreat: () => void;
  resetGame: () => void;
  heroMoves: () => BattleMove[];
  dismissMessage: () => void;
  acknowledgeRewards: () => void;
  purchaseTownBlessing: () => void;
}

const defaultTownProgress: TownProgress = { moonShards: 0, blessingLevel: 0 };

const defaultState: GameState = {
  hero: null,
  view: 'create',
  location: 'village',
  battle: null,
  message: null,
  marketInventory: [],
  postBattleRewards: null,
  run: null,
  townProgress: { ...defaultTownProgress }
};

type MarketEffectResult = { hero: Hero; message: string };
type MarketEffect = (hero: Hero) => MarketEffectResult;

const MARKET_EFFECTS: Record<MarketItemKey, MarketEffect> = {
  'moon-tonic': (hero) => ({
    hero: { ...hero, currentHp: hero.maxHp, energy: hero.maxEnergy },
    message: 'You feel moonlight flood your veins. HP and energy fully restored.'
  }),
  'silvered-armaments': (hero) => ({
    hero: { ...hero, str: hero.str + 1, agi: hero.agi + 1 },
    message: 'Steel sings in your grip. Strength and agility rise by 1.'
  }),
  'occult-primer': (hero) => {
    const maxEnergy = hero.maxEnergy + 1;
    return {
      hero: { ...hero, wis: hero.wis + 1, maxEnergy, energy: maxEnergy },
      message: 'Mystic insights bloom. Wisdom and max energy each increase by 1.'
    };
  },
  'lunar-wardstone': (hero) => {
    const maxHp = hero.maxHp + 10;
    return {
      hero: { ...hero, maxHp, currentHp: maxHp },
      message: 'Protective sigils glow. Max HP rises by 10 and wounds close.'
    };
  }
};

const MARKET_CATALOG: Record<MarketItemKey, MarketItem & { apply: MarketEffect }> = (() => {
  const catalog = {} as Record<MarketItemKey, MarketItem & { apply: MarketEffect }>;
  (Object.keys(marketCompendium) as MarketItemKey[]).forEach((key) => {
    const entry = marketCompendium[key];
    catalog[key] = {
      key,
      name: entry.name,
      description: entry.description,
      cost: entry.cost,
      flavor: entry.flavor,
      artwork: entry.image,
      apply: MARKET_EFFECTS[key]
    };
  });
  return catalog;
})();

const RUN_MAX_DEPTH = 5;

type RunRelicKey =
  | 'moon-thistle-charm'
  | 'howlstone-totem'
  | 'twilight-ledger'
  | 'silvered-compass';

const RUN_RELIC_CATALOG: Record<RunRelicKey, RunRelic> = {
  'moon-thistle-charm': {
    id: 'moon-thistle-charm',
    name: 'Moon-Thistle Charm',
    description: 'After each victory, restore 8 HP as the charm glows warm.',
    effect: { kind: 'post-battle-heal', amount: 8 }
  },
  'howlstone-totem': {
    id: 'howlstone-totem',
    name: 'Howlstone Totem',
    description: 'Before battles, the totem hums and grants +1 energy.',
    effect: { kind: 'pre-battle-energy', amount: 1 }
  },
  'twilight-ledger': {
    id: 'twilight-ledger',
    name: 'Twilight Ledger',
    description: 'Accountants of dusk skim +6 coins after every encounter.',
    effect: { kind: 'bonus-coins', amount: 6 }
  },
  'silvered-compass': {
    id: 'silvered-compass',
    name: 'Silvered Compass',
    description: 'Reveals one additional path to choose each depth.',
    effect: { kind: 'extra-option', amount: 1 }
  }
};

function cloneRelic(key: RunRelicKey): RunRelic {
  const relic = RUN_RELIC_CATALOG[key];
  return { ...relic };
}

function drawRandomRelic(existing: RunRelic[]): RunRelic | null {
  const owned = new Set(existing.map((relic) => relic.id));
  const pool = (Object.keys(RUN_RELIC_CATALOG) as RunRelicKey[]).filter(
    (key) => !owned.has(key)
  );
  if (pool.length === 0) {
    return null;
  }
  const choice = pool[Math.floor(Math.random() * pool.length)];
  return cloneRelic(choice);
}

function createRunOptionId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`;
}

function createBattleOption(depth: number): RunOption {
  return {
    id: createRunOptionId('battle'),
    type: 'battle',
    label: `Hunt the prowling chorus (Depth ${depth})`,
    description: 'Track a feral pack and test your mettle to seize further spoils.'
  };
}

function createHealEvent(depth: number): RunOption {
  const amount = 14 + depth * 3;
  return {
    id: createRunOptionId('heal'),
    type: 'event',
    label: 'Moonwell Respite',
    description: `Drink from a radiant pool to restore ${amount} HP.`,
    payload: { kind: 'heal', amount }
  };
}

function createEnergyEvent(depth: number): RunOption {
  const amount = 1 + Math.floor(depth / 2);
  return {
    id: createRunOptionId('energy'),
    type: 'event',
    label: 'Starlit Meditation',
    description: `Meditate beneath silver boughs to regain ${amount} energy.`,
    payload: { kind: 'energy', amount }
  };
}

function createCoinEvent(depth: number): RunOption {
  const amount = 16 + depth * 4;
  return {
    id: createRunOptionId('cache'),
    type: 'event',
    label: 'Silversap Cache',
    description: `Harvest rare sap worth ${amount} coins at market.`,
    payload: { kind: 'coins', amount }
  };
}

function createRelicEvent(): RunOption {
  return {
    id: createRunOptionId('relic'),
    type: 'event',
    label: 'Hidden Reliquary',
    description: 'Search a moonlit den for a relic that bends the run in your favour.',
    payload: { kind: 'relic' }
  };
}

function createRetreatOption(completed: boolean): RunOption {
  return {
    id: createRunOptionId('retreat'),
    type: 'retreat',
    label: completed ? 'Return with Triumph' : 'Withdraw to Silverfen',
    description: completed
      ? 'The heart of the forest quiets. Carry your legend and moonshards back to town.'
      : 'Leave the forest now, banking your gathered moonshards and regrouping in the village.'
  };
}

function shuffleOptions<T>(list: T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const j = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function extraOptionsFromRelics(relics: RunRelic[]): number {
  return relics.reduce((total, relic) => {
    if (relic.effect.kind === 'extra-option') {
      return total + relic.effect.amount;
    }
    return total;
  }, 0);
}

function bonusCoinsFromRelics(relics: RunRelic[]): number {
  return relics.reduce((total, relic) => {
    if (relic.effect.kind === 'bonus-coins') {
      return total + relic.effect.amount;
    }
    return total;
  }, 0);
}

function applyEncounterCoinBonus(relics: RunRelic[], hero: Hero, messages: string[]): void {
  const bonus = bonusCoinsFromRelics(relics);
  if (bonus > 0) {
    hero.coins += bonus;
    messages.push(`Twilight ledgers tally +${bonus} coins.`);
  }
}

function createRunChoices(
  depth: number,
  relics: RunRelic[]
): { options: RunOption[]; completed: boolean } {
  if (depth > RUN_MAX_DEPTH) {
    return {
      options: [createRetreatOption(true)],
      completed: true
    };
  }
  const options: RunOption[] = [createBattleOption(depth)];
  const library = shuffleOptions([
    createHealEvent(depth),
    createEnergyEvent(depth),
    createCoinEvent(depth),
    createRelicEvent()
  ]);
  const eventCount = Math.min(library.length, 1 + extraOptionsFromRelics(relics));
  for (let index = 0; index < eventCount; index += 1) {
    options.push(library[index]);
  }
  options.push(createRetreatOption(false));
  return { options, completed: false };
}

const STARTING_RELIC_TIERS: RunRelicKey[][] = [
  [],
  ['moon-thistle-charm'],
  ['moon-thistle-charm', 'howlstone-totem'],
  ['moon-thistle-charm', 'howlstone-totem', 'twilight-ledger'],
  ['moon-thistle-charm', 'howlstone-totem', 'twilight-ledger', 'silvered-compass']
];

export const MAX_BLESSING_LEVEL = STARTING_RELIC_TIERS.length - 1;

const BLESSING_BASE_COST = 8;
const BLESSING_STEP_COST = 6;

export function getBlessingUpgradeCost(level: number): number {
  if (level >= MAX_BLESSING_LEVEL) {
    return Number.POSITIVE_INFINITY;
  }
  return BLESSING_BASE_COST + level * BLESSING_STEP_COST;
}

const BLESSING_DESCRIPTIONS = [
  'Invest moonshards to awaken sanctuary boons for future forest runs.',
  'Blessing I: Begin runs with the Moon-Thistle Charm (post-battle healing).',
  'Blessing II: Carry the Howlstone Totem as well (pre-battle energy).',
  'Blessing III: Twilight Ledger keepers tithe +6 coins per encounter.',
  'Blessing IV: The Silvered Compass reveals an extra choice each depth.'
];

export function describeBlessingLevel(level: number): string {
  const clamped = Math.max(0, Math.min(level, BLESSING_DESCRIPTIONS.length - 1));
  return BLESSING_DESCRIPTIONS[clamped];
}

function startingRelicsForLevel(level: number): RunRelic[] {
  const clamped = Math.max(0, Math.min(level, MAX_BLESSING_LEVEL));
  const keys = STARTING_RELIC_TIERS[clamped];
  return keys.map((key) => cloneRelic(key));
}

function computeMoonShardReward(run: RunState, outcome: 'completed' | 'retreat' | 'failure'): number {
  const base = Math.max(1, run.depth - 1);
  const victoryBonus = run.victoryCount;
  const completionBonus = outcome === 'completed' ? 3 : 0;
  const penalty = outcome === 'failure' ? 2 : 0;
  return Math.max(0, base + victoryBonus + completionBonus - penalty);
}

function buildBattleState(hero: Hero, enemy: Enemy): BattleState {
  const heroTurn = hero.agi >= enemy.agi ? 'hero' : 'enemy';
  return {
    enemy,
    heroHp: hero.currentHp,
    enemyHp: enemy.maxHp,
    heroStrMod: 0,
    heroWisMod: 0,
    heroAgiMod: 0,
    enemyStrMod: 0,
    enemyAgiMod: 0,
    heroStatuses: [],
    enemyStatuses: [],
    pendingActions: [],
    log: [
      `${enemy.name} appears amidst the shadows.`,
      ...(heroTurn === 'enemy'
        ? [`${enemy.name} strikes first!`]
        : ['You seize the initiative.'])
    ],
    turn: heroTurn as BattleState['turn']
  } satisfies BattleState;
}

function applyRunBattleVictory(
  run: RunState | null,
  hero: Hero,
  battle: BattleState
): { run: RunState | null; hero: Hero; messages: string[] } {
  if (!run || !run.pendingBattle) {
    return { run, hero, messages: [] };
  }
  const messages: string[] = [];
  run.relics.forEach((relic) => {
    if (relic.effect.kind === 'post-battle-heal') {
      const before = hero.currentHp;
      hero.currentHp = Math.min(hero.maxHp, hero.currentHp + relic.effect.amount);
      const healed = hero.currentHp - before;
      if (healed > 0) {
        messages.push(`${relic.name} knits wounds for ${healed} HP.`);
      }
    }
  });
  applyEncounterCoinBonus(run.relics, hero, messages);
  const nextDepth = run.depth + 1;
  const { options: nextOptions, completed } = createRunChoices(nextDepth, run.relics);
  const logEntry: RunStepLog = {
    depth: run.depth,
    choice: run.pendingBattle.label,
    summary: `Defeated ${battle.enemy.name}.`
  };
  return {
    hero,
    messages,
    run: {
      ...run,
      depth: nextDepth,
      options: nextOptions,
      completed,
      awaitingNextStep: true,
      pendingBattle: undefined,
      pendingMessages: messages,
      log: [...run.log, logEntry],
      victoryCount: run.victoryCount + 1
    }
  };
}

type LootDefinition = BattleRewardItem & {
  dropRate: number;
};

const LOCATION_LOOT_TABLE: Record<LocationKey, LootDefinition[]> = {
  village: [
    {
      id: 'guild-token',
      name: 'Guild Favor Token',
      description: 'Proof of triumph in sanctioned duels. Traders respect its seal.',
      rarity: 'common',
      dropRate: 0.75
    },
    {
      id: 'polished-charm',
      name: 'Polished Moon Charm',
      description: 'A small charm infused with moonlight. Slightly boosts morale.',
      rarity: 'rare',
      dropRate: 0.35
    }
  ],
  forest: [
    {
      id: 'silversap-resin',
      name: 'Silversap Resin',
      description: 'Sticky sap harvested from whispering pines. Merchants prize it.',
      rarity: 'common',
      dropRate: 0.8
    },
    {
      id: 'lupine-fang',
      name: 'Lupine Fang',
      description: 'A gleaming fang humming with feral energy.',
      rarity: 'rare',
      dropRate: 0.45
    },
    {
      id: 'moonlit-cloak-fragment',
      name: 'Moonlit Cloak Fragment',
      description: 'Shimmering cloth from a hunter’s mantle. Said to deflect claws.',
      rarity: 'epic',
      dropRate: 0.2
    }
  ],
  ruins: [
    {
      id: 'wraith-essence',
      name: 'Wraith Essence',
      description: 'Distilled moonfire in liquid form. Glows faintly in the dark.',
      rarity: 'rare',
      dropRate: 0.65
    },
    {
      id: 'arcane-sigil-shard',
      name: 'Arcane Sigil Shard',
      description: 'Broken fragment of an ancient wardstone etched with runes.',
      rarity: 'common',
      dropRate: 0.85
    },
    {
      id: 'lunar-relay-crystal',
      name: 'Lunar Relay Crystal',
      description: 'A resonant crystal that hums with forgotten incantations.',
      rarity: 'epic',
      dropRate: 0.25
    }
  ]
};

function rollBattleLoot(enemyLocation: LocationKey): BattleRewardItem[] {
  const lootTable = LOCATION_LOOT_TABLE[enemyLocation] ?? [];
  const drops: BattleRewardItem[] = [];
  lootTable.forEach((entry) => {
    if (Math.random() < entry.dropRate) {
      drops.push({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        rarity: entry.rarity
      });
    }
  });
  if (drops.length === 0 && lootTable.length > 0) {
    const fallback = lootTable.reduce((best, current) =>
      current.dropRate > best.dropRate ? current : best
    );
    drops.push({
      id: fallback.id,
      name: fallback.name,
      description: fallback.description,
      rarity: fallback.rarity
    });
  }
  return drops;
}

function generateMarketInventory(): MarketItem[] {
  const entries = Object.values(MARKET_CATALOG);
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temp;
  }
  return shuffled.slice(0, 3).map(({ key, name, description, cost, flavor, artwork }) => ({
    key,
    name,
    description,
    cost,
    flavor,
    artwork
  }));
}

const GameContext = React.createContext<GameContextValue | undefined>(undefined);

type LevelResult = {
  hero: Hero;
  levelMessage: string | null;
  levelMessages: string[];
};

function xpToNext(level: number): number {
  return 60 + (level - 1) * 25;
}

function generateHero(name: string, species: Species) {
  const baseStats =
    species === 'Werewolf'
      ? { maxHp: 44, str: 9, agi: 7, wis: 5 }
      : { maxHp: 38, str: 7, agi: 9, wis: 9 };
  return {
    name,
    species,
    level: 1,
    xp: 0,
    coins: 25,
    currentHp: baseStats.maxHp,
    maxHp: baseStats.maxHp,
    str: baseStats.str,
    agi: baseStats.agi,
    wis: baseStats.wis,
    energy: 6,
    maxEnergy: 6
  };
}

function applyLevelUps(hero: Hero): LevelResult {
  const updated = { ...hero };
  const messages: string[] = [];
  while (updated.xp >= xpToNext(updated.level)) {
    updated.xp -= xpToNext(updated.level);
    updated.level += 1;
    updated.maxHp += updated.species === 'Werewolf' ? 7 : 5;
    updated.str += updated.species === 'Werewolf' ? 2 : 1;
    updated.agi += updated.species === 'Vampire' ? 2 : 1;
    updated.wis += 1;
    updated.maxEnergy += 1;
    updated.energy = updated.maxEnergy;
    updated.currentHp = updated.maxHp;
    messages.push(`Level ${updated.level}! Moonlight surges through you.`);
  }
  return {
    hero: updated,
    levelMessage: messages.length ? messages.join(' ') : null,
    levelMessages: messages
  };
}

function withPersistence(
  setState: React.Dispatch<React.SetStateAction<GameState>>,
  updater: (state: GameState) => GameState
) {
  setState((previous) => {
    const next = updater(previous);
    const persisted = {
      hero: next.hero,
      location: next.location,
      timestamp: Date.now(),
      townProgress: next.townProgress
    };
    if (
      !persisted.hero &&
      persisted.townProgress.moonShards === 0 &&
      persisted.townProgress.blessingLevel === 0
    ) {
      clearGame();
    } else {
      saveGame(persisted);
    }
    return next;
  });
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<GameState>(() => {
    const stored = loadGame();
    const storedProgress = stored?.townProgress ?? { ...defaultTownProgress };
    if (stored?.hero) {
      return {
        hero: stored.hero,
        location: stored.location,
        view: 'map',
        battle: null,
        message: `Welcome back, ${stored.hero.name}.`,
        marketInventory: generateMarketInventory(),
        postBattleRewards: null,
        run: null,
        townProgress: storedProgress
      };
    }
    return { ...defaultState, townProgress: storedProgress };
  });

  const updateState = React.useCallback(
    (updater: (state: GameState) => GameState) =>
      withPersistence(setState, updater),
    []
  );

  const concludeRun = React.useCallback(
    (
      current: GameState,
      hero: Hero,
      run: RunState,
      outcome: 'completed' | 'retreat' | 'failure'
    ): GameState => {
      const shards = computeMoonShardReward(run, outcome);
      const townProgress: TownProgress = {
        ...current.townProgress,
        moonShards: current.townProgress.moonShards + shards
      };
      const descriptor =
        outcome === 'completed'
          ? 'You conquer the heart of the Whispering Forest.'
          : outcome === 'failure'
          ? 'You flee the forest, clutching what shards you can.'
          : 'You withdraw before the forest can claim more strength.';
      const shardLine = ` Moonshards secured: ${shards}.`;
      return {
        ...current,
        hero,
        location: 'village',
        view: 'map',
        battle: null,
        postBattleRewards: null,
        message: `${descriptor}${shardLine}`,
        run: null,
        townProgress
      } satisfies GameState;
    },
    []
  );

  const createHero = React.useCallback(
    (name: string, species: Species) => {
      updateState((current) => ({
        hero: generateHero(name, species),
        location: 'village',
        view: 'map',
        battle: null,
        message: `Welcome to HallowMoon, ${name}.`,
        marketInventory: generateMarketInventory(),
        postBattleRewards: null,
        run: null,
        townProgress: current.townProgress
      }));
    },
    [updateState]
  );

  const goToMap = React.useCallback(() => {
    updateState((current) => ({
      ...current,
      view: 'map',
      battle: null,
      postBattleRewards: null
    }));
  }, [updateState]);

  const viewHero = React.useCallback(() => {
    updateState((current) => {
      if (!current.hero) {
        return current;
      }
      return {
        ...current,
        view: 'hero',
        battle: null,
        postBattleRewards: null
      };
    });
  }, [updateState]);

  const startTraining = React.useCallback(() => {
    updateState((current) => ({
      ...current,
      view: 'training',
      location: 'village',
      battle: null,
      postBattleRewards: null,
      message:
        current.view === 'training'
          ? current.message
          : 'Focus your efforts on the stat you crave to hone.'
    }));
  }, [updateState]);

  const visitMarket = React.useCallback(() => {
    updateState((current) => ({
      ...current,
      view: 'market',
      location: 'village',
      battle: null,
      postBattleRewards: null,
      marketInventory:
        current.marketInventory.length > 0
          ? current.marketInventory
          : generateMarketInventory(),
      message:
        current.view === 'market'
          ? current.message
          : 'The Moonlit Market shimmers to life beneath the lanterns.'
    }));
  }, [updateState]);

  const applyTraining = React.useCallback(
    (stat: TrainableStat) => {
      updateState((current) => {
        if (!current.hero) {
          return current;
        }
        if (current.hero.energy <= 0) {
          return {
            ...current,
            message: 'You are exhausted. Rest at the village hearth.'
          };
        }
        const hero = { ...current.hero };
        hero.energy -= 1;
        hero.xp += 12;
        hero.coins += 2;
        if (stat === 'str') {
          hero.str += 1;
        } else if (stat === 'agi') {
          hero.agi += 1;
        } else {
          hero.wis += 1;
        }
        const { hero: leveled, levelMessage } = applyLevelUps(hero);
        const statName = stat.toUpperCase();
        const messageParts = [`${statName} rises. +12 XP, +2 coins.`];
        if (levelMessage) {
          messageParts.push(levelMessage);
        }
        return {
          ...current,
          hero: leveled,
          message: messageParts.join(' ')
        };
      });
    },
    [updateState]
  );

  const rest = React.useCallback(() => {
    updateState((current) => {
      if (!current.hero) {
        return current;
      }
      const hero = { ...current.hero };
      hero.currentHp = hero.maxHp;
      hero.energy = hero.maxEnergy;
      return {
        ...current,
        location: 'village',
        hero,
        message: 'A calm night passes. Your strength is restored.',
        postBattleRewards: null,
        run: null
      };
    });
  }, [updateState]);

  const beginForestRun = React.useCallback(() => {
    updateState((current) => {
      if (!current.hero) {
        return current;
      }
      const hero = { ...current.hero };
      const relics = startingRelicsForLevel(current.townProgress.blessingLevel);
      const { options, completed } = createRunChoices(1, relics);
      const messageParts = ['You step beneath the whispering canopy.'];
      if (relics.length > 0) {
        const relicNames = relics.map((relic) => relic.name).join(', ');
        messageParts.push(`Sanctuary blessings arm you with ${relicNames}.`);
      }
      return {
        ...current,
        hero,
        location: 'forest',
        view: 'run',
        battle: null,
        message: messageParts.join(' '),
        marketInventory: current.marketInventory,
        postBattleRewards: null,
        run: {
          depth: 1,
          relics,
          options,
          log: [],
          pendingBattle: undefined,
          awaitingNextStep: false,
          completed,
          victoryCount: 0,
          pendingMessages: []
        }
      } satisfies GameState;
    });
  }, [updateState]);

  const startBattle = React.useCallback(
    (location: LocationKey) => {
      updateState((current) => {
        if (!current.hero) {
          return current;
        }
        const enemy = createEnemy(location, current.hero.level);
        const battle = buildBattleState(current.hero, enemy);
        return {
          ...current,
          location,
          view: 'battle',
          battle,
          message: null,
          postBattleRewards: null,
          run: null
        };
      });
    },
    [updateState]
  );

  const chooseRunOption = React.useCallback(
    (optionId: string) => {
      updateState((current) => {
        if (!current.hero || !current.run) {
          return current;
        }
        const run = current.run;
        const option = run.options.find((entry) => entry.id === optionId);
        if (!option) {
          return current;
        }
        const hero = { ...current.hero };
        const runMessages: string[] = [];

        if (option.type === 'retreat') {
          return concludeRun(current, hero, run, run.completed ? 'completed' : 'retreat');
        }

        if (option.type === 'battle') {
          run.relics.forEach((relic) => {
            if (relic.effect.kind === 'pre-battle-energy') {
              const before = hero.energy;
              hero.energy = Math.min(hero.maxEnergy, hero.energy + relic.effect.amount);
              const gained = hero.energy - before;
              if (gained > 0) {
                runMessages.push(`${relic.name} grants +${gained} energy.`);
              }
            }
          });
          const heroLevelOffset = Math.floor((run.depth - 1) / 2);
          const enemy = createEnemy('forest', Math.max(1, hero.level + heroLevelOffset));
          const battle = buildBattleState(hero, enemy);
          const message = runMessages.length > 0 ? runMessages.join(' ') : null;
          return {
            ...current,
            hero,
            location: 'forest',
            view: 'battle',
            battle,
            message,
            postBattleRewards: null,
            run: {
              ...run,
              pendingBattle: { optionId: option.id, label: option.label },
              options: [],
              awaitingNextStep: false,
              pendingMessages: []
            }
          } satisfies GameState;
        }

        const updatedRelics = [...run.relics];
        const logFragments: string[] = [];
        if (option.payload?.kind === 'heal') {
          const before = hero.currentHp;
          hero.currentHp = Math.min(hero.maxHp, hero.currentHp + option.payload.amount);
          const healed = hero.currentHp - before;
          if (healed > 0) {
            runMessages.push(`Moonwell waters mend ${healed} HP.`);
            logFragments.push(`Healed ${healed} HP.`);
          } else {
            runMessages.push('Moonwell waters offer comfort, but you are already at full strength.');
            logFragments.push('Healing wasted; HP already full.');
          }
        } else if (option.payload?.kind === 'energy') {
          const before = hero.energy;
          hero.energy = Math.min(hero.maxEnergy, hero.energy + option.payload.amount);
          const restored = hero.energy - before;
          if (restored > 0) {
            runMessages.push(`Starlit breaths restore ${restored} energy.`);
            logFragments.push(`Recovered ${restored} energy.`);
          } else {
            runMessages.push('Your essence is already brimming with power.');
            logFragments.push('Energy already full.');
          }
        } else if (option.payload?.kind === 'coins') {
          hero.coins += option.payload.amount;
          runMessages.push(`Silversap trades for +${option.payload.amount} coins.`);
          logFragments.push(`Gained ${option.payload.amount} coins.`);
        } else if (option.payload?.kind === 'relic') {
          const relic = drawRandomRelic(updatedRelics);
          if (relic) {
            updatedRelics.push(relic);
            runMessages.push(`You recover the relic ${relic.name}.`);
            logFragments.push(`Claimed relic ${relic.name}.`);
          } else {
            const fallback = 12;
            hero.coins += fallback;
            runMessages.push('The cache lies empty, but you salvage +12 coins.');
            logFragments.push('Relic cache empty; recovered 12 coins instead.');
          }
        }

        applyEncounterCoinBonus(updatedRelics, hero, runMessages);

        const nextDepth = run.depth + 1;
        const { options: nextOptions, completed } = createRunChoices(nextDepth, updatedRelics);
        const summaryText = logFragments.join(' ') || option.description;
        const logEntry: RunStepLog = {
          depth: run.depth,
          choice: option.label,
          summary: summaryText
        };
        const baseMessage = runMessages.join(' ') || option.description;
        const followUp = completed
          ? 'The heart of the forest falls quiet. Return when you are ready.'
          : `New paths unfurl at depth ${nextDepth}.`;

        return {
          ...current,
          hero,
          run: {
            ...run,
            depth: nextDepth,
            relics: updatedRelics,
            options: nextOptions,
            completed,
            awaitingNextStep: false,
            pendingBattle: undefined,
            pendingMessages: [],
            log: [...run.log, logEntry]
          },
          message: `${baseMessage} ${followUp}`.trim()
        } satisfies GameState;
      });
    },
    [concludeRun, updateState]
  );

  const abandonRun = React.useCallback(() => {
    updateState((current) => {
      if (!current.hero || !current.run) {
        return current;
      }
      return concludeRun(current, current.hero, current.run, 'retreat');
    });
  }, [concludeRun, updateState]);

  const purchaseTownBlessing = React.useCallback(() => {
    updateState((current) => {
      const cost = getBlessingUpgradeCost(current.townProgress.blessingLevel);
      if (Number.isInfinity(cost)) {
        return {
          ...current,
          message: 'The sanctuary already resonates with every blessing we can invoke.'
        };
      }
      if (current.townProgress.moonShards < cost) {
        const deficit = cost - current.townProgress.moonShards;
        return {
          ...current,
          message: `You require ${deficit} more moonshards to empower the sanctuary.`
        };
      }
      const nextLevel = Math.min(current.townProgress.blessingLevel + 1, MAX_BLESSING_LEVEL);
      const nextProgress: TownProgress = {
        moonShards: current.townProgress.moonShards - cost,
        blessingLevel: nextLevel
      };
      return {
        ...current,
        townProgress: nextProgress,
        message: `Sanctuary blessing rises to tier ${nextLevel}. ${describeBlessingLevel(nextLevel)}`
      };
    });
  }, [updateState]);

  const buyFromMarket = React.useCallback(
    (itemKey: MarketItemKey) => {
      updateState((current) => {
        if (!current.hero) {
          return current;
        }
        const definition = MARKET_CATALOG[itemKey];
        if (!definition) {
          return current;
        }
        if (current.hero.coins < definition.cost) {
          return {
            ...current,
            message: 'You lack the coins for that purchase.'
          };
        }
        const heroAfterPurchase = {
          ...current.hero,
          coins: current.hero.coins - definition.cost
        };
        const { hero: upgradedHero, message } = definition.apply(heroAfterPurchase);
        const remainingInventory = current.marketInventory.filter(
          (item) => item.key !== itemKey
        );
        return {
          ...current,
          hero: upgradedHero,
          marketInventory: remainingInventory,
          message: `${definition.name} acquired. ${message}`
        };
      });
    },
    [updateState]
  );

  const resolveVictory = React.useCallback(
    (current: GameState, hero: Hero, battle: BattleState) => {
      const heroBefore: Hero = { ...hero };
      const xpEarned = battle.enemy.xp;
      const coinsEarned = battle.enemy.coins;
      const heroClone: Hero = { ...hero };
      heroClone.xp += xpEarned;
      heroClone.coins += coinsEarned;
      const { hero: leveledHero, levelMessages } = applyLevelUps(heroClone);
      const leveledSnapshot: Hero = { ...leveledHero };
      const { run: runAfter, hero: heroAfterRun } = applyRunBattleVictory(
        current.run,
        leveledSnapshot,
        battle
      );
      const loot = rollBattleLoot(battle.enemy.location);
      const rewardSummary: PostBattleRewards = {
        enemyName: battle.enemy.name,
        enemyArtwork: battle.enemy.artwork,
        xpEarned,
        coinsEarned,
        items: loot,
        heroProgress: {
          before: {
            level: heroBefore.level,
            xp: heroBefore.xp,
            coins: heroBefore.coins
          },
          after: {
            level: heroAfterRun.level,
            xp: heroAfterRun.xp,
            coins: heroAfterRun.coins
          },
          levelUps: levelMessages
        }
      };
      return {
        hero: heroAfterRun,
        location: current.location,
        view: 'post-battle',
        battle: null,
        message: null,
        marketInventory: current.marketInventory,
        postBattleRewards: rewardSummary,
        run: runAfter,
        townProgress: current.townProgress
      } satisfies GameState;
    },
    []
  );

  const resolveDefeat = React.useCallback(
    (current: GameState, hero: Hero) => {
      const heroClone: Hero = { ...hero };
      heroClone.currentHp = Math.max(1, Math.round(heroClone.maxHp * 0.3));
      heroClone.energy = Math.max(0, heroClone.energy - 1);
      heroClone.coins = Math.max(0, heroClone.coins - 6);
      if (current.run) {
        return concludeRun(current, heroClone, current.run, 'failure');
      }
      return {
        ...current,
        hero: heroClone,
        location: 'village',
        view: 'map',
        battle: null,
        message: 'Defeat stings. You limp back to the village to recover.',
        marketInventory: generateMarketInventory(),
        postBattleRewards: null,
        run: null
      } satisfies GameState;
    },
    [concludeRun]
  );

  const queueEnemyTurn = React.useCallback(() => {
    setTimeout(() => {
      updateState((latest) => {
        if (!latest.hero || latest.view !== 'battle' || !latest.battle) {
          return latest;
        }
        if (latest.battle.turn !== 'enemy') {
          return latest;
        }
        const enemyTurn = applyEnemyTurn(latest.battle, latest.hero);
        const heroAfterEnemy: Hero = {
          ...latest.hero,
          currentHp: enemyTurn.heroHp
        };
        if (enemyTurn.heroHp <= 0) {
          return resolveDefeat(latest, heroAfterEnemy);
        }
        if (enemyTurn.battle.enemyHp <= 0) {
          return resolveVictory(latest, heroAfterEnemy, enemyTurn.battle);
        }
        return {
          ...latest,
          hero: heroAfterEnemy,
          battle: enemyTurn.battle
        };
      });
    }, 450);
  }, [resolveDefeat, resolveVictory, updateState]);

  const performHeroMove = React.useCallback(
    (moveKey: string) => {
      updateState((current) => {
        if (!current.hero || current.view !== 'battle' || !current.battle) {
          return current;
        }
        if (current.battle.turn !== 'hero') {
          return current;
        }
        const { battle: afterHero, heroHp } = applyHeroMove(
          moveKey,
          current.hero,
          current.battle
        );
        const heroAfterHero = { ...current.hero, currentHp: heroHp };
        if (afterHero.enemyHp <= 0) {
          return resolveVictory(current, heroAfterHero, afterHero);
        }
        if (afterHero.turn === 'enemy') {
          queueEnemyTurn();
          return {
            ...current,
            hero: heroAfterHero,
            battle: afterHero
          };
        }
        return {
          ...current,
          hero: heroAfterHero,
          battle: afterHero
        };
      });
    },
    [queueEnemyTurn, resolveVictory, updateState]
  );

  const retreat = React.useCallback(() => {
    updateState((current) => {
      if (!current.hero) {
        return current;
      }
      if (!current.battle) {
        if (current.run) {
          return concludeRun(current, current.hero, current.run, 'retreat');
        }
        return current;
      }
      const heroAfterRetreat: Hero = {
        ...current.hero,
        currentHp: Math.max(1, current.battle.heroHp),
        energy: Math.max(0, current.hero.energy - 1)
      };
      if (current.run) {
        return concludeRun(current, heroAfterRetreat, current.run, 'failure');
      }
      return {
        ...current,
        hero: heroAfterRetreat,
        location: 'village',
        view: 'map',
        battle: null,
        message: 'You retreat beneath the moon, vowing to return stronger.',
        postBattleRewards: null,
        run: null
      } satisfies GameState;
    });
  }, [concludeRun, updateState]);

  const resetGame = React.useCallback(() => {
    updateState((current) => ({ ...defaultState, townProgress: current.townProgress }));
  }, [updateState]);

  const heroMoves = React.useCallback(() => {
    if (!state.hero) {
      return [];
    }
    return HERO_MOVES[state.hero.species];
  }, [state.hero]);

  const dismissMessage = React.useCallback(() => {
    updateState((current) => ({ ...current, message: null }));
  }, [updateState]);

  const acknowledgeRewards = React.useCallback(() => {
    updateState((current) => {
      if (!current.postBattleRewards) {
        if (current.run?.awaitingNextStep) {
          const runMessageBase =
            current.run.pendingMessages.length > 0
              ? current.run.pendingMessages.join(' ')
              : 'The forest shifts around you.';
          const followUp = current.run.completed
            ? 'Return to Silverfen to bank your triumph.'
            : `New paths await at depth ${current.run.depth}.`;
          return {
            ...current,
            view: 'run',
            battle: null,
            postBattleRewards: null,
            message: `${runMessageBase} ${followUp}`.trim(),
            run: { ...current.run, awaitingNextStep: false, pendingMessages: [] }
          } satisfies GameState;
        }
        return { ...current, view: 'map', battle: null };
      }
      const summary = current.postBattleRewards;
      const baseMessage = `Victory over ${summary.enemyName}! +${summary.xpEarned} XP, +${summary.coinsEarned} coins.`;
      const levelMessage = summary.heroProgress.levelUps.join(' ');
      const runAwaiting = current.run?.awaitingNextStep ?? false;
      if (runAwaiting && current.run) {
        const runMessageBase =
          current.run.pendingMessages.length > 0
            ? current.run.pendingMessages.join(' ')
            : 'The forest shifts around you.';
        const followUp = current.run.completed
          ? 'Return to Silverfen to bank your triumph.'
          : `New paths await at depth ${current.run.depth}.`;
        return {
          ...current,
          view: 'run',
          battle: null,
          postBattleRewards: null,
          message: `${baseMessage} ${runMessageBase} ${followUp}`.trim(),
          run: { ...current.run, awaitingNextStep: false, pendingMessages: [] }
        } satisfies GameState;
      }
      return {
        ...current,
        view: 'map',
        battle: null,
        postBattleRewards: null,
        message: levelMessage ? `${baseMessage} ${levelMessage}` : baseMessage
      } satisfies GameState;
    });
  }, [updateState]);

  const value = React.useMemo(
    () => ({
      state,
      createHero,
      viewHero,
      goToMap,
      startTraining,
      train: applyTraining,
      rest,
      visitMarket,
      buyFromMarket,
      startBattle,
      beginForestRun,
      chooseRunOption,
      abandonRun,
      performHeroMove,
      retreat,
      resetGame,
      heroMoves,
      dismissMessage,
      acknowledgeRewards,
      purchaseTownBlessing
    }),
    [
      state,
      createHero,
      viewHero,
      goToMap,
      startTraining,
      applyTraining,
      rest,
      visitMarket,
      buyFromMarket,
      startBattle,
      beginForestRun,
      chooseRunOption,
      abandonRun,
      performHeroMove,
      retreat,
      resetGame,
      heroMoves,
      dismissMessage,
      acknowledgeRewards,
      purchaseTownBlessing
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = React.useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
