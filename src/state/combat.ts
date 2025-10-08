import { BattleMove, BattleState, Enemy, Hero, LocationKey, Species } from './types';

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
      description: 'Bolster your spirit, increasing STR and AGI this battle.',
      type: 'buff'
    },
    {
      key: 'rend',
      name: 'Rend',
      description: 'A brutal tear dealing heavy damage.',
      type: 'attack'
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
    }
  ]
};

interface EnemyTemplate {
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
}

const ENCOUNTERS: Record<LocationKey, EnemyTemplate[]> = {
  village: [
    {
      id: 'sparring-adept',
      name: 'Sparring Adept',
      species: 'Vampire',
      maxHp: 28,
      str: 6,
      agi: 6,
      wis: 5,
      coins: 8,
      xp: 18,
      description: 'A friendly rival from the guild testing your footing.'
    }
  ],
  forest: [
    {
      id: 'feral-stalker',
      name: 'Feral Stalker',
      species: 'Werewolf',
      maxHp: 34,
      str: 9,
      agi: 7,
      wis: 4,
      coins: 14,
      xp: 28,
      description: 'A moon-maddened predator prowling the dusk.'
    }
  ],
  ruins: [
    {
      id: 'ancient-wraith',
      name: 'Ancient Wraith',
      species: 'Vampire',
      maxHp: 40,
      str: 8,
      agi: 6,
      wis: 10,
      coins: 20,
      xp: 35,
      description: 'A relic guardian wielding forgotten moonfire.'
    }
  ]
};

function scaleValue(base: number, level: number): number {
  const multiplier = 1 + (level - 1) * 0.12;
  return Math.round(base * multiplier);
}

export function createEnemy(location: LocationKey, heroLevel: number): Enemy {
  const templatePool = ENCOUNTERS[location];
  const template = templatePool[Math.floor(Math.random() * templatePool.length)];
  return {
    ...template,
    maxHp: scaleValue(template.maxHp, heroLevel),
    str: scaleValue(template.str, heroLevel),
    agi: scaleValue(template.agi, heroLevel),
    wis: scaleValue(template.wis, heroLevel),
    coins: template.coins + heroLevel * 3,
    xp: template.xp + heroLevel * 4,
    moves: template.species === 'Werewolf'
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
          }
        ]
  };
}

function cloneBattle(battle: BattleState): BattleState {
  return {
    ...battle,
    log: [...battle.log]
  };
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
    return { battle: next, heroHp };
  }
  if (moveKey === 'howl') {
    next.heroStrMod += 2;
    next.heroAgiMod += 1;
    next.log.unshift('You let out a fearsome howl, empowering your claws.');
    next.turn = 'enemy';
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
      next.enemyHp = Math.max(0, next.enemyHp - result.damage);
      next.log.unshift(
        `Rend tears for ${result.damage} damage${result.critical ? ' (critical!)' : ''}.`
      );
    }
    next.turn = next.enemyHp <= 0 ? 'hero' : 'enemy';
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
      next.log.unshift(
        `Bite deals ${result.damage} damage and restores ${heal} HP.`
      );
    }
    next.turn = next.enemyHp <= 0 ? 'hero' : 'enemy';
    return { battle: next, heroHp };
  }
  if (moveKey === 'charm') {
    next.enemyStrMod -= 2;
    next.enemyAgiMod -= 1;
    next.log.unshift('Charm saps the foe, dulling their claws.');
    next.turn = 'enemy';
    return { battle: next, heroHp };
  }
  if (moveKey === 'night-bolt') {
    const damage = wisdomDamage(hero.wis, next.heroWisMod, 1.15);
    next.enemyHp = Math.max(0, next.enemyHp - damage);
    next.log.unshift(`Night Bolt sears for ${damage} arcane damage.`);
    next.turn = next.enemyHp <= 0 ? 'hero' : 'enemy';
    return { battle: next, heroHp };
  }
  next.log.unshift('The moonlight flickers uncertainly.');
  next.turn = 'enemy';
  return { battle: next, heroHp };
}

export function applyEnemyTurn(
  battle: BattleState,
  hero: Hero
): { battle: BattleState; heroHp: number } {
  const next = cloneBattle(battle);
  let heroHp = next.heroHp;
  const move = battle.enemy.moves[
    Math.floor(Math.random() * battle.enemy.moves.length)
  ];
  if (move.type === 'attack') {
    if (move.scale === 'str') {
      const result = physicalDamage(
        battle.enemy.str,
        next.enemyStrMod,
        battle.enemy.agi,
        next.enemyAgiMod,
        hero.agi,
        next.heroAgiMod
      );
      if (result.evaded) {
        next.log.unshift(`${battle.enemy.name}'s attack is dodged!`);
      } else {
        heroHp = Math.max(0, heroHp - result.damage);
        next.log.unshift(
          `${battle.enemy.name} uses ${move.name}, dealing ${result.damage} damage.`
        );
      }
    } else {
      const damage = wisdomDamage(battle.enemy.wis, 0, 1.05);
      heroHp = Math.max(0, heroHp - damage);
      next.log.unshift(
        `${battle.enemy.name} channels ${move.name} for ${damage} damage.`
      );
    }
  } else {
    if (move.scale === 'str') {
      next.heroAgiMod -= 1;
      next.log.unshift(`${battle.enemy.name}'s snarl chills your agility.`);
    } else {
      next.heroStrMod -= 1;
      next.log.unshift(`${battle.enemy.name}'s gaze weakens your strikes.`);
    }
  }
  next.turn = 'hero';
  return { battle: next, heroHp };
}
