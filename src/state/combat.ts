import {
  BattleMove,
  BattleState,
  BattleStatus,
  Enemy,
  Hero,
  LocationKey,
  PendingAction,
  Species
} from './types';
import { encounterTable, monsterCompendium } from '../content/compendium';

export const HERO_MOVES: Record<Species, BattleMove[]> = {
  Werewolf: [
    {
      key: 'claw',
      name: 'Claw',
      description: 'A swift strike drawing on raw strength.',
      type: 'attack'
    },
    {
      key: 'howl',
      name: 'Howl',
      description: 'Bolster your spirit, boosting STR and AGI for several turns.',
      type: 'buff'
    },
    {
      key: 'rend',
      name: 'Rend',
      description: 'A brutal tear dealing heavy damage and exposing foes.',
      type: 'attack'
    },
    {
      key: 'feral-lunge',
      name: 'Feral Lunge',
      description: 'Crouch and spring into a crushing leap that lands next turn.',
      type: 'attack',
      chargeTurns: 1
    }
  ],
  Vampire: [
    {
      key: 'bite',
      name: 'Bite',
      description: 'Sink your fangs to drain life and heal.',
      type: 'attack'
    },
    {
      key: 'charm',
      name: 'Charm',
      description: 'Sap your foe’s resolve, lowering their might.',
      type: 'debuff'
    },
    {
      key: 'night-bolt',
      name: 'Night Bolt',
      description: 'Arcane moonlight dealing WIS-based damage.',
      type: 'special'
    },
    {
      key: 'blood-ritual',
      name: 'Blood Ritual',
      description: 'Spill vitae to weave a sigil that erupts after two turns.',
      type: 'special',
      chargeTurns: 2
    }
  ]
};

function scaleValue(base: number, level: number): number {
  const multiplier = 1 + (level - 1) * 0.12;
  return Math.round(base * multiplier);
}

export function createEnemy(location: LocationKey, heroLevel: number): Enemy {
  const encounterIds = encounterTable[location];
  const enemyId = encounterIds[Math.floor(Math.random() * encounterIds.length)];
  const blueprint = monsterCompendium[enemyId];
  const base = blueprint.baseStats;
  return {
    id: blueprint.id,
    name: blueprint.name,
    species: blueprint.species,
    location: blueprint.location,
    maxHp: scaleValue(base.maxHp, heroLevel),
    str: scaleValue(base.str, heroLevel),
    agi: scaleValue(base.agi, heroLevel),
    wis: scaleValue(base.wis, heroLevel),
    coins: base.coins + heroLevel * 3,
    xp: base.xp + heroLevel * 4,
    description: blueprint.summary,
    artwork: blueprint.image,
    moves: blueprint.species === 'Werewolf'
      ? [
          {
            key: 'slash',
            name: 'Raking Slash',
            description: 'Savage claws tear at you.',
            type: 'attack',
            scale: 'str'
          },
          {
            key: 'snarl',
            name: 'Piercing Snarl',
            description: 'A chilling cry that rattles agility.',
            type: 'debuff',
            scale: 'str'
          },
          {
            key: 'lunar-pounce',
            name: 'Lunar Pounce',
            description: 'Crouches low, readying a devastating leap.',
            type: 'attack',
            scale: 'str',
            windUpTurns: 1
          }
        ]
      : [
          {
            key: 'gaze',
            name: 'Hypnotic Gaze',
            description: 'Siphons will with wicked focus.',
            type: 'debuff',
            scale: 'wis'
          },
          {
            key: 'lash',
            name: 'Shadow Lash',
            description: 'Bolts of night strike swiftly.',
            type: 'attack',
            scale: 'wis'
          },
          {
            key: 'umbral-storm',
            name: 'Umbral Storm',
            description: 'Gathers void lightning to release soon.',
            type: 'attack',
            scale: 'wis',
            windUpTurns: 1
          }
        ]
  };
}

function cloneBattle(battle: BattleState): BattleState {
  return {
    ...battle,
    log: [...battle.log],
    heroStatuses: battle.heroStatuses.map((status) => ({ ...status })),
    enemyStatuses: battle.enemyStatuses.map((status) => ({ ...status })),
    pendingActions: battle.pendingActions.map((action) => ({
      ...action,
      payload: action.payload ? { ...action.payload } : undefined
    }))
  };
}

function modifyStatsForStatus(
  battle: BattleState,
  owner: 'hero' | 'enemy',
  modifiers?: Partial<Record<'str' | 'agi' | 'wis', number>>,
  revert = false
) {
  if (!modifiers) {
    return;
  }
  const factor = revert ? -1 : 1;
  if (owner === 'hero') {
    if (modifiers.str) {
      battle.heroStrMod += modifiers.str * factor;
    }
    if (modifiers.agi) {
      battle.heroAgiMod += modifiers.agi * factor;
    }
    if (modifiers.wis) {
      battle.heroWisMod += modifiers.wis * factor;
    }
  } else {
    if (modifiers.str) {
      battle.enemyStrMod += modifiers.str * factor;
    }
    if (modifiers.agi) {
      battle.enemyAgiMod += modifiers.agi * factor;
    }
  }
}

function addStatus(
  battle: BattleState,
  owner: 'hero' | 'enemy',
  status: BattleStatus
): 'new' | 'refreshed' {
  const collection = owner === 'hero' ? battle.heroStatuses : battle.enemyStatuses;
  const existingIndex = collection.findIndex((entry) => entry.key === status.key);
  if (existingIndex >= 0) {
    const existing = collection[existingIndex];
    collection[existingIndex] = {
      ...existing,
      remainingTurns: status.remainingTurns,
      description: status.description,
      justApplied: true
    };
    return 'refreshed';
  }
  modifyStatsForStatus(battle, owner, status.modifiers);
  collection.push({ ...status, justApplied: true });
  return 'new';
}

function tickStatuses(battle: BattleState, owner: 'hero' | 'enemy'): string[] {
  const collection = owner === 'hero' ? battle.heroStatuses : battle.enemyStatuses;
  if (collection.length === 0) {
    return [];
  }
  const remaining: BattleStatus[] = [];
  const messages: string[] = [];
  collection.forEach((status) => {
    if (status.justApplied) {
      remaining.push({ ...status, justApplied: false });
      return;
    }
    if (status.remainingTurns <= 1) {
      modifyStatsForStatus(battle, owner, status.modifiers, true);
      messages.push(
        `${owner === 'hero' ? 'Your' : `${battle.enemy.name}'s`} ${status.label} fades.`
      );
    } else {
      remaining.push({ ...status, remainingTurns: status.remainingTurns - 1 });
    }
  });
  if (owner === 'hero') {
    battle.heroStatuses = remaining;
  } else {
    battle.enemyStatuses = remaining;
  }
  return messages;
}

function resolveHeroPendingAction(
  battle: BattleState,
  action: PendingAction,
  hero: Hero,
  heroHp: number
): number {
  if (action.key === 'feral-lunge') {
    const agility = hero.agi + battle.heroAgiMod;
    const strength = hero.str + battle.heroStrMod;
    const damage = Math.max(6, Math.round(strength * 1.4 + agility * 0.6 + Math.random() * 8));
    battle.enemyHp = Math.max(0, battle.enemyHp - damage);
    battle.log.unshift(`Feral Lunge crashes into ${battle.enemy.name} for ${damage} damage!`);
    return heroHp;
  }
  if (action.key === 'blood-ritual') {
    const damage = wisdomDamage(hero.wis, battle.heroWisMod + 2, 1.35);
    const heal = Math.round(damage * 0.6);
    battle.enemyHp = Math.max(0, battle.enemyHp - damage);
    const healedHp = Math.min(hero.maxHp, heroHp + heal);
    battle.log.unshift(
      `Blood Ritual erupts in crimson moonfire for ${damage} damage, restoring ${heal} HP.`
    );
    battle.heroHp = healedHp;
    return healedHp;
  }
  battle.log.unshift('Arcane energies fizzle before they can be shaped.');
  return heroHp;
}

function resolveEnemyPendingAction(
  battle: BattleState,
  action: PendingAction,
  hero: Hero,
  heroHp: number
): number {
  if (action.key === 'lunar-pounce') {
    const multiplier = action.payload?.multiplier ?? 1.55;
    const result = physicalDamage(
      battle.enemy.str,
      battle.enemyStrMod,
      battle.enemy.agi,
      battle.enemyAgiMod,
      hero.agi,
      battle.heroAgiMod,
      multiplier
    );
    const damage = result.evaded
      ? Math.max(5, Math.round((battle.enemy.str + battle.enemyStrMod) * 1.1))
      : result.damage;
    const logMessage = result.evaded
      ? `${battle.enemy.name} pounces relentlessly, grazing you for ${damage} damage.`
      : `${battle.enemy.name}'s Lunar Pounce slams you for ${damage} damage!`;
    const updatedHp = Math.max(0, heroHp - damage);
    battle.heroHp = updatedHp;
    battle.log.unshift(logMessage);
    return updatedHp;
  }
  if (action.key === 'umbral-storm') {
    const damage = Math.max(6, wisdomDamage(battle.enemy.wis, 0, 1.3));
    const updatedHp = Math.max(0, heroHp - damage);
    battle.heroHp = updatedHp;
    battle.log.unshift(
      `${battle.enemy.name}'s Umbral Storm detonates, raking you for ${damage} damage!`
    );
    return updatedHp;
  }
  battle.log.unshift(`${battle.enemy.name}'s preparation fizzles out.`);
  return heroHp;
}

function resolvePendingActions(
  battle: BattleState,
  owner: 'hero' | 'enemy',
  hero: Hero,
  heroHp: number
): number {
  if (battle.pendingActions.length === 0) {
    return heroHp;
  }
  const updated: PendingAction[] = [];
  battle.pendingActions.forEach((action) => {
    if (action.owner !== owner) {
      updated.push(action);
      return;
    }
    if (action.remainingTurns > 1) {
      const nextRemaining = action.remainingTurns - 1;
      updated.push({ ...action, remainingTurns: nextRemaining });
      const actorName = owner === 'hero' ? 'You' : battle.enemy.name;
      battle.log.unshift(
        `${actorName} ${owner === 'hero' ? 'continue' : 'continues'} preparing ${
          action.name
        } (${nextRemaining} turn${nextRemaining === 1 ? '' : 's'} remain).`
      );
      return;
    }
    heroHp =
      owner === 'hero'
        ? resolveHeroPendingAction(battle, action, hero, heroHp)
        : resolveEnemyPendingAction(battle, action, hero, heroHp);
  });
  battle.pendingActions = updated;
  battle.heroHp = heroHp;
  return heroHp;
}

function prepareTurn(
  battle: BattleState,
  owner: 'hero' | 'enemy',
  hero: Hero,
  heroHp: number
): number {
  const statusMessages = tickStatuses(battle, owner);
  for (let i = statusMessages.length - 1; i >= 0; i -= 1) {
    battle.log.unshift(statusMessages[i]);
  }
  return resolvePendingActions(battle, owner, hero, heroHp);
}

function physicalDamage(
  attackerStr: number,
  strMod: number,
  attackerAgi: number,
  agiMod: number,
  defenderAgi: number,
  defenderAgiMod: number,
  multiplier = 1
) {
  const power = Math.max(1, (attackerStr + strMod) * multiplier);
  const agility = Math.max(1, attackerAgi + agiMod);
  const avoidance = Math.max(1, defenderAgi + defenderAgiMod);
  const base = power * (0.85 + Math.random() * 0.3);
  const critChance = Math.min(0.45, 0.05 + agility * 0.01);
  let damage = Math.round(base * (0.9 + Math.random() * 0.2));
  let critical = false;
  const evadeChance = Math.min(0.2, avoidance * 0.004);
  if (Math.random() < evadeChance) {
    return { damage: 0, critical: false, evaded: true };
  }
  if (Math.random() < critChance) {
    damage = Math.round(damage * 1.5);
    critical = true;
  }
  return { damage: Math.max(0, damage), critical, evaded: false };
}

function wisdomDamage(wis: number, wisMod: number, multiplier = 1) {
  const power = Math.max(1, (wis + wisMod) * multiplier);
  return Math.round(power * (1 + Math.random() * 0.4));
}

export function applyHeroMove(
  moveKey: string,
  hero: Hero,
  battle: BattleState
): { battle: BattleState; heroHp: number } {
  const next = cloneBattle(battle);
  let heroHp = next.heroHp;
  if (moveKey === 'claw') {
    const result = physicalDamage(
      hero.str,
      next.heroStrMod,
      hero.agi,
      next.heroAgiMod,
      battle.enemy.agi,
      next.enemyAgiMod
    );
    if (result.evaded) {
      next.log.unshift('Your claw swipes through empty air!');
    } else {
      next.enemyHp = Math.max(0, next.enemyHp - result.damage);
      next.log.unshift(
        `Claw deals ${result.damage} damage${result.critical ? ' (critical!)' : ''}.`
      );
    }
    next.turn = next.enemyHp <= 0 ? 'hero' : 'enemy';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (moveKey === 'howl') {
    const statusResult = addStatus(next, 'hero', {
      key: 'howl-empower',
      label: 'Moonlit Ferocity',
      description: '+2 STR, +1 AGI for 3 turns.',
      type: 'buff',
      remainingTurns: 3,
      modifiers: { str: 2, agi: 1 }
    });
    next.log.unshift(
      statusResult === 'new'
        ? 'You let out a fearsome howl, power thrumming through your limbs for a few turns.'
        : 'Your howl renews your feral focus.'
    );
    next.turn = 'enemy';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (moveKey === 'rend') {
    const result = physicalDamage(
      hero.str,
      next.heroStrMod + 2,
      hero.agi,
      next.heroAgiMod,
      battle.enemy.agi,
      next.enemyAgiMod,
      1.2
    );
    if (result.evaded) {
      next.log.unshift('The rend misses as your foe slips aside!');
    } else {
      const exposedResult = addStatus(next, 'enemy', {
        key: 'exposed-wounds',
        label: 'Exposed Wounds',
        description: '-1 STR and -1 AGI for 2 turns.',
        type: 'debuff',
        remainingTurns: 2,
        modifiers: { str: -1, agi: -1 }
      });
      if (exposedResult === 'new') {
        next.log.unshift(`${next.enemy.name} is exposed! (-1 STR/-1 AGI for 2 turns.)`);
      } else {
        next.log.unshift(`Your relentless assault keeps ${next.enemy.name} exposed.`);
      }
      next.enemyHp = Math.max(0, next.enemyHp - result.damage);
      next.log.unshift(
        `Rend tears for ${result.damage} damage${result.critical ? ' (critical!)' : ''}.`
      );
    }
    next.turn = next.enemyHp <= 0 ? 'hero' : 'enemy';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (moveKey === 'bite') {
    const result = physicalDamage(
      hero.str,
      next.heroStrMod,
      hero.agi,
      next.heroAgiMod,
      battle.enemy.agi,
      next.enemyAgiMod
    );
    if (result.evaded) {
      next.log.unshift('Your bite fails to find purchase.');
    } else {
      const heal = Math.round(result.damage * 0.5);
      next.enemyHp = Math.max(0, next.enemyHp - result.damage);
      heroHp = Math.min(hero.maxHp, heroHp + heal);
      next.heroHp = heroHp;
      const thirstResult = addStatus(next, 'hero', {
        key: 'night-thirst',
        label: 'Night Thirst',
        description: '+1 STR for 2 turns after feeding.',
        type: 'buff',
        remainingTurns: 2,
        modifiers: { str: 1 }
      });
      next.log.unshift(
        `Bite deals ${result.damage} damage and restores ${heal} HP.`
      );
      next.log.unshift(
        thirstResult === 'new'
          ? 'Stolen blood sharpens your strikes (+1 STR, 2 turns).'
          : 'Your hunger is sated again, keeping your strength heightened.'
      );
    }
    next.turn = next.enemyHp <= 0 ? 'hero' : 'enemy';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (moveKey === 'charm') {
    const charmResult = addStatus(next, 'enemy', {
      key: 'charmed-weakness',
      label: 'Enthralled',
      description: '-2 STR and -1 AGI while charmed.',
      type: 'debuff',
      remainingTurns: 3,
      modifiers: { str: -2, agi: -1 }
    });
    next.log.unshift(
      charmResult === 'new'
        ? 'Charm saps the foe, dulling their claws for a short while.'
        : 'Your foe remains enthralled and weakened.'
    );
    next.turn = 'enemy';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (moveKey === 'night-bolt') {
    const damage = wisdomDamage(hero.wis, next.heroWisMod, 1.15);
    next.enemyHp = Math.max(0, next.enemyHp - damage);
    next.log.unshift(`Night Bolt sears for ${damage} arcane damage.`);
    next.turn = next.enemyHp <= 0 ? 'hero' : 'enemy';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (moveKey === 'feral-lunge') {
    const alreadyPreparing = next.pendingActions.some(
      (action) => action.owner === 'hero' && action.key === 'feral-lunge'
    );
    if (alreadyPreparing) {
      next.log.unshift('You are already coiled for a feral lunge.');
      next.heroHp = heroHp;
      return { battle: next, heroHp };
    }
    next.pendingActions.push({
      owner: 'hero',
      key: 'feral-lunge',
      name: 'Feral Lunge',
      description: 'A crushing leap that lands next turn.',
      remainingTurns: 1,
      totalTurns: 1
    });
    next.log.unshift('You crouch low, muscles coiling for a feral lunge (1 turn).');
    next.turn = 'enemy';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (moveKey === 'blood-ritual') {
    if (heroHp <= 1) {
      next.log.unshift('You lack the vitality to begin a blood ritual.');
      next.heroHp = heroHp;
      return { battle: next, heroHp };
    }
    const alreadyChanneling = next.pendingActions.some(
      (action) => action.owner === 'hero' && action.key === 'blood-ritual'
    );
    if (alreadyChanneling) {
      next.log.unshift('Your ritual circle is already etched and pulsing.');
      next.heroHp = heroHp;
      return { battle: next, heroHp };
    }
    const sacrifice = Math.min(heroHp - 1, Math.max(4, Math.round(hero.maxHp * 0.08)));
    heroHp = Math.max(1, heroHp - sacrifice);
    next.heroHp = heroHp;
    next.pendingActions.push({
      owner: 'hero',
      key: 'blood-ritual',
      name: 'Blood Ritual',
      description: 'Release a wave of crimson moonfire after 2 turns.',
      remainingTurns: 2,
      totalTurns: 2
    });
    next.log.unshift(
      `You carve a sanguine sigil, sacrificing ${sacrifice} HP to begin the ritual (2 turns).`
    );
    next.turn = 'enemy';
    return { battle: next, heroHp };
  }
  next.log.unshift('The moonlight flickers uncertainly.');
  next.turn = 'enemy';
  next.heroHp = heroHp;
  return { battle: next, heroHp };
}

export function applyEnemyTurn(
  battle: BattleState,
  hero: Hero
): { battle: BattleState; heroHp: number } {
  const next = cloneBattle(battle);
  let heroHp = next.heroHp;
  heroHp = prepareTurn(next, 'enemy', hero, heroHp);
  if (heroHp <= 0) {
    next.turn = 'hero';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }
  if (next.enemyHp <= 0) {
    next.turn = 'hero';
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }

  const moves = battle.enemy.moves;
  let move = moves[Math.floor(Math.random() * moves.length)];
  if (move.windUpTurns) {
    const alreadyPending = next.pendingActions.some(
      (action) => action.owner === 'enemy' && action.key === move.key
    );
    if (alreadyPending) {
      const alternatives = moves.filter((candidate) => candidate.key !== move.key);
      if (alternatives.length > 0) {
        move = alternatives[Math.floor(Math.random() * alternatives.length)];
      }
    }
  }

  const enemyName = next.enemy.name;

  if (
    move.windUpTurns &&
    !next.pendingActions.some((action) => action.owner === 'enemy' && action.key === move.key)
  ) {
    next.pendingActions.push({
      owner: 'enemy',
      key: move.key,
      name: move.name,
      description: move.description,
      remainingTurns: move.windUpTurns,
      totalTurns: move.windUpTurns,
      payload: move.scale === 'str' ? { multiplier: 1.55 } : { multiplier: 1.3 }
    });
    next.log.unshift(
      `${enemyName} begins ${move.name}! (${move.windUpTurns} turn${
        move.windUpTurns === 1 ? '' : 's'
      } to unleash.)`
    );
    next.turn = 'hero';
    heroHp = prepareTurn(next, 'hero', hero, heroHp);
    next.heroHp = heroHp;
    return { battle: next, heroHp };
  }

  if (move.type === 'attack') {
    if (move.scale === 'str') {
      const result = physicalDamage(
        next.enemy.str,
        next.enemyStrMod,
        next.enemy.agi,
        next.enemyAgiMod,
        hero.agi,
        next.heroAgiMod
      );
      if (result.evaded) {
        next.log.unshift(`${enemyName}'s attack is dodged!`);
      } else {
        heroHp = Math.max(0, heroHp - result.damage);
        next.log.unshift(`${enemyName} uses ${move.name}, dealing ${result.damage} damage.`);
      }
    } else {
      const damage = wisdomDamage(next.enemy.wis, 0, 1.05);
      heroHp = Math.max(0, heroHp - damage);
      next.log.unshift(`${enemyName} channels ${move.name} for ${damage} damage.`);
    }
  } else {
    const status =
      move.scale === 'str'
        ? {
            key: 'shaken-focus',
            label: 'Shaken',
            description: '-1 AGI for 2 turns.',
            type: 'debuff' as const,
            remainingTurns: 2,
            modifiers: { agi: -1 }
          }
        : {
            key: 'enervated-spell',
            label: 'Enervated',
            description: '-1 STR and -1 WIS for 3 turns.',
            type: 'debuff' as const,
            remainingTurns: 3,
            modifiers: { str: -1, wis: -1 }
          };
    const statusResult = addStatus(next, 'hero', status);
    next.log.unshift(
      statusResult === 'new'
        ? `${enemyName}'s ${move.name.toLowerCase()} leaves you ${status.label.toLowerCase()}!`
        : `${enemyName} keeps you ${status.label.toLowerCase()}.`
    );
  }

  next.turn = 'hero';
  next.heroHp = heroHp;
  heroHp = prepareTurn(next, 'hero', hero, heroHp);
  next.heroHp = heroHp;
  return { battle: next, heroHp };
}
