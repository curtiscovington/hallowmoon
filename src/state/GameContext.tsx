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
  Species,
  TrainableStat
} from './types';

interface GameContextValue {
  state: GameState;
  createHero: (name: string, species: Species) => void;
  goToMap: () => void;
  startTraining: () => void;
  train: (stat: TrainableStat) => void;
  rest: () => void;
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
  message: null
};

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
        message: `Welcome back, ${stored.hero.name}.`
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
        message: `Welcome to HallowMoon, ${name}.`
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

  const startTraining = React.useCallback(() => {
    updateState((current) => ({
      ...current,
      view: 'training',
      location: 'village',
      message: 'Focus your efforts on the stat you crave to hone.'
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
        message: levelMessage ? `${rewardMessage} ${levelMessage}` : rewardMessage
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
      message: 'Defeat stings. You limp back to the village to recover.'
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
        message: 'You retreat beneath the moon, vowing to return stronger.'
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
      goToMap,
      startTraining,
      train: applyTraining,
      rest,
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
      goToMap,
      startTraining,
      applyTraining,
      rest,
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
