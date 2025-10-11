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
  GameState,
  Hero,
  LocationKey,
  MarketItem,
  MarketItemKey,
  Species,
  TrainableStat
} from './types';

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
  performHeroMove: (moveKey: string) => void;
  retreat: () => void;
  resetGame: () => void;
  heroMoves: () => BattleMove[];
  dismissMessage: () => void;
}

const defaultState: GameState = {
  hero: null,
  view: 'create',
  location: 'village',
  battle: null,
  message: null,
  marketInventory: []
};

type MarketEffectResult = { hero: Hero; message: string };
type MarketEffect = (hero: Hero) => MarketEffectResult;

const MARKET_CATALOG: Record<MarketItemKey, MarketItem & { apply: MarketEffect }> = {
  'moon-tonic': {
    key: 'moon-tonic',
    name: 'Moon Tonic',
    description: 'Brewed silverleaf restores your vitality and spirit instantly.',
    cost: 12,
    apply: (hero) => ({
      hero: { ...hero, currentHp: hero.maxHp, energy: hero.maxEnergy },
      message: 'You feel moonlight flood your veins. HP and energy fully restored.'
    })
  },
  'silvered-armaments': {
    key: 'silvered-armaments',
    name: 'Silvered Armaments',
    description: 'Refined blades tuned by hunters grant +1 STR and +1 AGI.',
    cost: 20,
    apply: (hero) => ({
      hero: { ...hero, str: hero.str + 1, agi: hero.agi + 1 },
      message: 'Steel sings in your grip. Strength and agility rise by 1.'
    })
  },
  'occult-primer': {
    key: 'occult-primer',
    name: 'Occult Primer',
    description: 'Esoteric study increases your WIS by 1 and max energy by 1.',
    cost: 18,
    apply: (hero) => {
      const maxEnergy = hero.maxEnergy + 1;
      return {
        hero: { ...hero, wis: hero.wis + 1, maxEnergy, energy: maxEnergy },
        message: 'Mystic insights bloom. Wisdom and max energy each increase by 1.'
      };
    }
  },
  'lunar-wardstone': {
    key: 'lunar-wardstone',
    name: 'Lunar Wardstone',
    description: 'Carved wards grant +10 max HP and mend your wounds.',
    cost: 16,
    apply: (hero) => {
      const maxHp = hero.maxHp + 10;
      return {
        hero: { ...hero, maxHp, currentHp: maxHp },
        message: 'Protective sigils glow. Max HP rises by 10 and wounds close.'
      };
    }
  }
};

function generateMarketInventory(): MarketItem[] {
  const entries = Object.values(MARKET_CATALOG);
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temp;
  }
  return shuffled.slice(0, 3).map(({ key, name, description, cost }) => ({
    key,
    name,
    description,
    cost
  }));
}

const GameContext = React.createContext<GameContextValue | undefined>(undefined);

type LevelResult = {
  hero: Hero;
  levelMessage: string | null;
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
  return { hero: updated, levelMessage: messages.length ? messages.join(' ') : null };
}

function withPersistence(
  setState: React.Dispatch<React.SetStateAction<GameState>>,
  updater: (state: GameState) => GameState
) {
  setState((previous) => {
    const next = updater(previous);
    if (next.hero) {
      saveGame({ hero: next.hero, location: next.location, timestamp: Date.now() });
    } else {
      clearGame();
    }
    return next;
  });
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<GameState>(() => {
    const stored = loadGame();
    if (stored?.hero) {
      return {
        hero: stored.hero,
        location: stored.location,
        view: 'map',
        battle: null,
        message: `Welcome back, ${stored.hero.name}.`,
        marketInventory: generateMarketInventory()
      };
    }
    return { ...defaultState };
  });

  const updateState = React.useCallback(
    (updater: (state: GameState) => GameState) =>
      withPersistence(setState, updater),
    []
  );

  const createHero = React.useCallback(
    (name: string, species: Species) => {
      updateState(() => ({
        hero: generateHero(name, species),
        location: 'village',
        view: 'map',
        battle: null,
        message: `Welcome to HallowMoon, ${name}.`,
        marketInventory: generateMarketInventory()
      }));
    },
    [updateState]
  );

  const goToMap = React.useCallback(() => {
    updateState((current) => ({
      ...current,
      view: 'map',
      battle: null
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
        battle: null
      };
    });
  }, [updateState]);

  const startTraining = React.useCallback(() => {
    updateState((current) => ({
      ...current,
      view: 'training',
      location: 'village',
      battle: null,
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
        message: 'A calm night passes. Your strength is restored.'
      };
    });
  }, [updateState]);

  const startBattle = React.useCallback(
    (location: LocationKey) => {
      updateState((current) => {
        if (!current.hero) {
          return current;
        }
        const enemy = createEnemy(location, current.hero.level);
        const heroTurn = current.hero.agi >= enemy.agi ? 'hero' : 'enemy';
        const battle = {
          enemy,
          heroHp: current.hero.currentHp,
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
        return {
          ...current,
          location,
          view: 'battle',
          battle,
          message: null
        };
      });
    },
    [updateState]
  );

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
      const heroClone: Hero = { ...hero };
      heroClone.xp += battle.enemy.xp;
      heroClone.coins += battle.enemy.coins;
      const { hero: leveledHero, levelMessage } = applyLevelUps(heroClone);
      const rewardMessage = `Victory over ${battle.enemy.name}! +${battle.enemy.xp} XP, +${battle.enemy.coins} coins.`;
      return {
        hero: leveledHero,
        location: current.location,
        view: 'map',
        battle: null,
        message: levelMessage ? `${rewardMessage} ${levelMessage}` : rewardMessage,
        marketInventory: current.marketInventory
      } satisfies GameState;
    },
    []
  );

  const resolveDefeat = React.useCallback((hero: Hero) => {
    const heroClone: Hero = { ...hero };
    heroClone.currentHp = Math.max(1, Math.round(heroClone.maxHp * 0.3));
    heroClone.energy = Math.max(0, heroClone.energy - 1);
    heroClone.coins = Math.max(0, heroClone.coins - 6);
    return {
      hero: heroClone,
      location: 'village',
      view: 'map',
      battle: null,
      message: 'Defeat stings. You limp back to the village to recover.',
      marketInventory: generateMarketInventory()
    } satisfies GameState;
  }, []);

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
          return resolveDefeat(heroAfterEnemy);
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
      if (!current.hero || !current.battle) {
        return current;
      }
      const heroAfterRetreat: Hero = {
        ...current.hero,
        currentHp: Math.max(1, current.battle.heroHp),
        energy: Math.max(0, current.hero.energy - 1)
      };
      return {
        hero: heroAfterRetreat,
        location: 'village',
        view: 'map',
        battle: null,
        message: 'You retreat beneath the moon, vowing to return stronger.',
        marketInventory: current.marketInventory
      } satisfies GameState;
    });
  }, [updateState]);

  const resetGame = React.useCallback(() => {
    updateState(() => ({ ...defaultState }));
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
      performHeroMove,
      retreat,
      resetGame,
      heroMoves,
      dismissMessage
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
      performHeroMove,
      retreat,
      resetGame,
      heroMoves,
      dismissMessage
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
