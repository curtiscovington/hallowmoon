import { Slot, SlotType } from '../types';

export interface SlotTemplate {
  key: string;
  name: string;
  type: SlotType;
  description: string;
  traits: string[];
  accepted: Slot['accepted'];
  upgradeCost: number;
  unlocked?: boolean;
  state?: Slot['state'];
  repair?: { targetKey: string; time: number };
}

export const SLOT_LOCK_BASE_MS = 60000;
export const SLOT_ACTION_COMPLETION_TOLERANCE_MS = 250;

export const SLOT_LOCK_DURATIONS: Record<SlotType, number> = {
  hearth: SLOT_LOCK_BASE_MS,
  work: SLOT_LOCK_BASE_MS * 2,
  study: Math.round(SLOT_LOCK_BASE_MS * 1.5),
  ritual: SLOT_LOCK_BASE_MS * 3,
  expedition: SLOT_LOCK_BASE_MS * 4,
  manor: SLOT_LOCK_BASE_MS,
  bedroom: Math.round(SLOT_LOCK_BASE_MS * 1.5)
};

export const SLOT_TEMPLATES: Record<string, SlotTemplate> = {
  manor: {
    key: 'the-manor',
    name: 'The Manor',
    type: 'manor',
    description:
      'Dusty corridors wind through a neglected estate. Explore to reveal the rooms hidden within.',
    traits: ['domain'],
    accepted: 'persona-only',
    upgradeCost: 0
  },
  hearth: {
    key: 'veiled-sanctum',
    name: 'Veiled Sanctum',
    type: 'hearth',
    description:
      'A private chamber of incense and mirrors. Rest here to gather calm and crystallised lore.',
    traits: ['haven'],
    accepted: 'persona-only',
    upgradeCost: 3
  },
  work: {
    key: 'scribe-post',
    name: 'Moonlit Scriptorium',
    type: 'work',
    description:
      'Ledger clerks of the cult require steady hands. Work shifts here to earn coin and whispers.',
    traits: ['job'],
    accepted: 'persona-only',
    upgradeCost: 4
  },
  study: {
    key: 'night-archive',
    name: 'Night Archive Desk',
    type: 'study',
    description:
      'A desk piled with occult fragments. Feed it cards to glean their secrets.',
    traits: ['study'],
    accepted: 'any',
    upgradeCost: 3
  },
  ritual: {
    key: 'moonlit-circle',
    name: 'Moonlit Circle',
    type: 'ritual',
    description:
      'Ink sigils breathe in argent vapours. Offerings channel the moon’s wild resonance.',
    traits: ['ritual'],
    accepted: 'any',
    upgradeCost: 5
  },
  expedition: {
    key: 'chart-room',
    name: 'Chart Room',
    type: 'expedition',
    description:
      'Maps of impossible cities stretch across the tables. Prepare expeditions into the Ways.',
    traits: ['expedition'],
    accepted: 'any',
    upgradeCost: 6,
    unlocked: false
  },
  bedroom: {
    key: 'astral-chamber',
    name: 'Astral Chamber',
    type: 'bedroom',
    description:
      'Silken drapes shroud a bed carved of pale wood. Dreams here may mingle with the moon.',
    traits: ['dream'],
    accepted: 'persona-only',
    upgradeCost: 4,
    unlocked: true
  },
  'damaged-sanctum': {
    key: 'ruined-sanctum',
    name: 'Ruined Sanctum',
    type: 'manor',
    description:
      'Collapsed beams choke the hearth. Clearing the rubble could restore a place of rest.',
    traits: ['damaged', 'haven'],
    accepted: 'persona-only',
    upgradeCost: 0,
    unlocked: true,
    state: 'damaged',
    repair: { targetKey: 'hearth', time: 2 }
  },
  'damaged-scriptorium': {
    key: 'ruined-scriptorium',
    name: 'Ruined Scriptorium',
    type: 'manor',
    description:
      'Tumbled shelves choke the worktables. Clearing the debris will reopen the scriptorium.',
    traits: ['damaged', 'job'],
    accepted: 'persona-only',
    upgradeCost: 0,
    unlocked: true,
    state: 'damaged',
    repair: { targetKey: 'work', time: 3 }
  },
  'damaged-archive': {
    key: 'ruined-archive',
    name: 'Ruined Archive',
    type: 'manor',
    description:
      'Boxes of mildew and collapsed shelves hide the Night Archive. Patient sorting can restore it.',
    traits: ['damaged', 'study'],
    accepted: 'any',
    upgradeCost: 0,
    unlocked: true,
    state: 'damaged',
    repair: { targetKey: 'study', time: 2 }
  },
  'damaged-circle': {
    key: 'ruined-circle',
    name: 'Ruined Circle',
    type: 'manor',
    description:
      'The ritual chamber is cracked and waterlogged. Restoring the sigils will take devoted focus.',
    traits: ['damaged', 'ritual'],
    accepted: 'persona-only',
    upgradeCost: 0,
    unlocked: true,
    state: 'damaged',
    repair: { targetKey: 'ritual', time: 3 }
  },
  'damaged-bedroom': {
    key: 'ruined-bedroom',
    name: 'Ruined Bedroom',
    type: 'manor',
    description:
      'Mattresses are mouldering and windows broken. Careful effort will make it fit for dreaming again.',
    traits: ['damaged', 'dream'],
    accepted: 'persona-only',
    upgradeCost: 0,
    unlocked: true,
    state: 'damaged',
    repair: { targetKey: 'bedroom', time: 2 }
  }
};

