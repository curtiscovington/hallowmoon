import { LocationKey, MarketItemKey, Species, VisualAsset } from '../state/types';

export interface SpeciesEntry {
  key: Species;
  name: string;
  tagline: string;
  summary: string;
  traits: string[];
  image: VisualAsset;
}

export const speciesCompendium: Record<Species, SpeciesEntry> = {
  Werewolf: {
    key: 'Werewolf',
    name: 'Werewolf',
    tagline: 'Feral guardians who channel raw lunar might.',
    summary:
      'Werewolves excel at overwhelming strength and endurance. Their claws and primal instincts keep allies safe while shredding foes.',
    traits: ['+ High health and strength', '+ Howls bolster physical stats', '+ Aggressive play rewards momentum'],
    image: {
      src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      alt: 'A lone wolf howling against a full moon backdrop.',
      credit: 'Photo by Geran de Klerk on Unsplash'
    }
  },
  Vampire: {
    key: 'Vampire',
    name: 'Vampire',
    tagline: 'Elegant tacticians weaving moonlit sorcery.',
    summary:
      'Vampires balance agility and arcane precision. They charm, drain, and outmaneuver with rituals that punish reckless enemies.',
    traits: ['+ Versatile spell and melee toolkit', '+ Debuffs sap enemy offense', '+ Resourceful sustain through vitae'],
    image: {
      src: 'https://images.unsplash.com/photo-1496317556649-f930d733eea0?auto=format&fit=crop&w=1200&q=80',
      alt: 'A cloaked figure bathed in crimson light beneath gothic arches.',
      credit: 'Photo by A L on Unsplash'
    }
  }
};

export type LocationActionDefinition =
  | { type: 'battle'; label: string; encounter: LocationKey }
  | { type: 'training'; label: string }
  | { type: 'rest'; label: string }
  | { type: 'market'; label: string };

export interface LocationEntry {
  key: LocationKey;
  name: string;
  summary: string;
  description: string;
  image: VisualAsset;
  actions: LocationActionDefinition[];
}

export const locationOrder: LocationKey[] = ['village', 'forest', 'ruins'];

export const locationCompendium: Record<LocationKey, LocationEntry> = {
  village: {
    key: 'village',
    name: 'Silverfen Village',
    summary: 'Home hearth for weary hunters to rest, trade, and strategize.',
    description:
      'Lantern-lit streets wind between timbered halls. Guild mentors offer guidance while merchants craft charms to aid your crusade.',
    image: {
      src: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
      alt: 'A moonlit medieval village square with glowing lanterns.',
      credit: 'Photo by János Perláki on Unsplash'
    },
    actions: [
      { type: 'training', label: 'Train Stats' },
      { type: 'rest', label: 'Rest & Recover' },
      { type: 'market', label: 'Visit Moonlit Market' }
    ]
  },
  forest: {
    key: 'forest',
    name: 'Whispering Forest',
    summary: 'Feral howls echo through the boughs. Expect agile foes.',
    description:
      'Silvered mist curls around ancient pines. Predators stalk the undergrowth, lunging with reckless speed when moonlight peaks.',
    image: {
      src: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80',
      alt: 'A dense forest path under a cool twilight glow.',
      credit: 'Photo by Lukasz Szmigiel on Unsplash'
    },
    actions: [{ type: 'battle', label: 'Enter Forest', encounter: 'forest' }]
  },
  ruins: {
    key: 'ruins',
    name: 'Lunar Ruins',
    summary: 'Forgotten altars hum with arcane vampires guarding secrets.',
    description:
      'Crumbled spires pierce the night sky. Arcane wards pulse as revenants defend relics of the first lunar coven.',
    image: {
      src: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80',
      alt: 'Ancient ruins glowing with ethereal moonlight.',
      credit: 'Photo by Sebastien Gabriel on Unsplash'
    },
    actions: [{ type: 'battle', label: 'Explore Ruins', encounter: 'ruins' }]
  }
};

export interface MonsterEntry {
  id: string;
  name: string;
  species: Species;
  location: LocationKey;
  summary: string;
  image: VisualAsset;
  baseStats: {
    maxHp: number;
    str: number;
    agi: number;
    wis: number;
    coins: number;
    xp: number;
  };
}

export const monsterCompendium: Record<string, MonsterEntry> = {
  'sparring-adept': {
    id: 'sparring-adept',
    name: 'Sparring Adept',
    species: 'Vampire',
    location: 'village',
    summary: 'A guild rival who keeps your reflexes sharp in friendly bouts.',
    image: {
      src: 'https://images.unsplash.com/photo-1522196772883-393d879eb14f?auto=format&fit=crop&w=1200&q=80',
      alt: 'A duelist practicing with a rapier in a torch-lit hall.',
      credit: 'Photo by José Reyes on Unsplash'
    },
    baseStats: { maxHp: 28, str: 6, agi: 6, wis: 5, coins: 8, xp: 18 }
  },
  'feral-stalker': {
    id: 'feral-stalker',
    name: 'Feral Stalker',
    species: 'Werewolf',
    location: 'forest',
    summary: 'A moon-maddened predator prowling the dusk in search of prey.',
    image: {
      src: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?auto=format&fit=crop&w=1200&q=80',
      alt: 'A shadowed wolf poised on mossy ground under moonlight.',
      credit: 'Photo by Thomas Bonometti on Unsplash'
    },
    baseStats: { maxHp: 34, str: 9, agi: 7, wis: 4, coins: 14, xp: 28 }
  },
  'ancient-wraith': {
    id: 'ancient-wraith',
    name: 'Ancient Wraith',
    species: 'Vampire',
    location: 'ruins',
    summary: 'A relic guardian wielding forgotten moonfire and spectral claws.',
    image: {
      src: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
      alt: 'A spectral figure emerging among moonlit ruins.',
      credit: 'Photo by Ameer Basheer on Unsplash'
    },
    baseStats: { maxHp: 40, str: 8, agi: 6, wis: 10, coins: 20, xp: 35 }
  }
};

export const encounterTable: Record<LocationKey, string[]> = {
  village: ['sparring-adept'],
  forest: ['feral-stalker'],
  ruins: ['ancient-wraith']
};

export interface MarketItemEntry {
  key: MarketItemKey;
  name: string;
  description: string;
  cost: number;
  flavor: string;
  image: VisualAsset;
}

export const marketCompendium: Record<MarketItemKey, MarketItemEntry> = {
  'moon-tonic': {
    key: 'moon-tonic',
    name: 'Moon Tonic',
    description: 'Brewed silverleaf restores your vitality and spirit instantly.',
    cost: 12,
    flavor: 'A warm herbal glow seeps through your veins, mending every ache.',
    image: {
      src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      alt: 'A glowing potion bottle on a wooden table surrounded by herbs.',
      credit: 'Photo by Joanna Kosinska on Unsplash'
    }
  },
  'silvered-armaments': {
    key: 'silvered-armaments',
    name: 'Silvered Armaments',
    description: 'Refined blades tuned by hunters grant +1 STR and +1 AGI.',
    cost: 20,
    flavor: 'Edge-tempered moonsteel sings in the night air, eager for battle.',
    image: {
      src: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80',
      alt: 'Twin curved blades gleaming with a cool metallic sheen.',
      credit: 'Photo by Ricardo Cruz on Unsplash'
    }
  },
  'occult-primer': {
    key: 'occult-primer',
    name: 'Occult Primer',
    description: 'Esoteric study increases your WIS by 1 and max energy by 1.',
    cost: 18,
    flavor: 'Marginalia glow with argent ink as secrets bloom beneath your touch.',
    image: {
      src: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80',
      alt: 'An ancient grimoire open with mystical light spilling from the pages.',
      credit: 'Photo by Aaron Burden on Unsplash'
    }
  },
  'lunar-wardstone': {
    key: 'lunar-wardstone',
    name: 'Lunar Wardstone',
    description: 'Carved wards grant +10 max HP and mend your wounds.',
    cost: 16,
    flavor: 'Runes pulse softly, weaving a silver barrier that steadies your heart.',
    image: {
      src: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      alt: 'A luminous rune stone resting on moss in twilight.',
      credit: 'Photo by Chris Ried on Unsplash'
    }
  }
};
