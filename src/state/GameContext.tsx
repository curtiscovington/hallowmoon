import React, { useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  CardInstance,
  CardReward,
  Discovery,
  DiscoverySeed,
  GameState,
  Resources,
  Slot,
  SlotRepair,
  SlotType
} from './types';

interface GameContextValue {
  state: GameState;
  moveCardToSlot: (cardId: string, slotId: string) => void;
  recallCard: (cardId: string) => void;
  activateSlot: (slotId: string) => void;
  upgradeSlot: (slotId: string) => void;
  advanceTime: () => void;
  getUpgradeCost: (slotId: string) => number;
  setTimeScale: (scale: number) => void;
  acknowledgeCardReveal: (cardId: string) => void;
}

const GameContext = React.createContext<GameContextValue | null>(null);

interface CardTemplate {
  key: string;
  name: string;
  type: CardInstance['type'];
  description: string;
  traits: string[];
  permanent: boolean;
  lifetime?: number;
  rewards?: CardReward;
}

interface SlotTemplate {
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

const SLOT_LOCK_BASE_MS = 60000;
const SLOT_ACTION_COMPLETION_TOLERANCE_MS = 250;

const SLOT_LOCK_DURATIONS: Record<SlotType, number> = {
  hearth: SLOT_LOCK_BASE_MS,
  work: SLOT_LOCK_BASE_MS * 2,
  study: Math.round(SLOT_LOCK_BASE_MS * 1.5),
  ritual: SLOT_LOCK_BASE_MS * 3,
  expedition: SLOT_LOCK_BASE_MS * 4,
  manor: SLOT_LOCK_BASE_MS,
  bedroom: Math.round(SLOT_LOCK_BASE_MS * 1.5)
};

const HERO_TEMPLATE: CardTemplate = {
  key: 'persona-initiate',
  name: 'Initiate of the Veiled Star',
  type: 'persona',
  description:
    'You. A fledgling adept weaving meaning from scraps of forgotten constellations.',
  traits: ['permanent', 'persona'],
  permanent: true
};

const OPPORTUNITY_TEMPLATES: CardTemplate[] = [
  {
    key: 'fading-whisper',
    name: 'Fading Whisper',
    type: 'inspiration',
    description: 'Study before it unravels to gather 2 lore and a glimmer of moonlight.',
    traits: ['fleeting', 'memory'],
    permanent: false,
    lifetime: 2,
    rewards: {
      resources: { lore: 2, glimmer: 1 }
    }
  },
  {
    key: 'glimmering-spark',
    name: 'Glimmering Spark',
    type: 'relic',
    description: 'A mote of wandering starlight. Study to harvest 2 glimmer.',
    traits: ['fleeting', 'starlight'],
    permanent: false,
    lifetime: 3,
    rewards: {
      resources: { glimmer: 2 }
    }
  },
  {
    key: 'cartographer-echo',
    name: 'Cartographer’s Echo',
    type: 'inspiration',
    description:
      'A half-remembered map etched in frost. Studying it may reveal new expedition grounds.',
    traits: ['fleeting', 'map'],
    permanent: false,
    lifetime: 4,
    rewards: {
      resources: { lore: 1 },
      discovery: {
        key: 'umbral-gate',
        name: 'Umbral Gate Sigil',
        description: 'The sigil unlocks an expedition slot leading into the Hollow Ways.'
      }
    }
  }
];

const SLOT_TEMPLATES: Record<string, SlotTemplate> = {
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
    key: 'echoing-circle',
    name: 'Echoing Circle',
    type: 'ritual',
    description:
      'A chalk-drawn ring that trades lore for gleaming insight. Conduct rites when ready.',
    traits: ['ritual'],
    accepted: 'persona-only',
    upgradeCost: 5
  },
  expedition: {
    key: 'umbral-gate',
    name: 'Umbral Gate',
    type: 'expedition',
    description:
      'A portal of obsidian mirrors leading beyond the known city. Venture forth for wonders.',
    traits: ['expedition'],
    accepted: 'persona-only',
    upgradeCost: 6
  },
  bedroom: {
    key: 'moonlit-bedroom',
    name: 'Moonlit Bedroom',
    type: 'bedroom',
    description:
      'A restful chamber washed in pale glow. Let a persona sleep here to court lucid dreams.',
    traits: ['haven', 'dream'],
    accepted: 'persona-only',
    upgradeCost: 2
  },
  'damaged-sanctum': {
    key: 'ruined-sanctum',
    name: 'Ruined Sanctum',
    type: 'manor',
    description:
      'Broken mirrors and dust-clogged braziers mute the sanctum. A persona could clear it with a few focused shifts.',
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

function createCardId(templateKey: string): string {
  return `${templateKey}-${Math.random().toString(36).slice(2, 8)}`;
}

function instantiateCard(template: CardTemplate): CardInstance {
  return {
    id: createCardId(template.key),
    key: template.key,
    name: template.name,
    type: template.type,
    description: template.description,
    traits: [...template.traits],
    permanent: template.permanent,
    remainingTurns: template.permanent ? null : template.lifetime ?? null,
    rewards: template.rewards,
    location: { area: 'hand' }
  };
}

function instantiateSlot(template: SlotTemplate, id?: string): Slot {
  const repair: SlotRepair | null = template.repair
    ? {
        targetKey: template.repair.targetKey,
        remaining: template.repair.time,
        total: template.repair.time
      }
    : null;

  return {
    id: id ?? `slot-${template.key}`,
    key: template.key,
    name: template.name,
    type: template.type,
    description: template.description,
    level: 1,
    upgradeCost: template.upgradeCost,
    traits: [...template.traits],
    accepted: template.accepted,
    occupantId: null,
    assistantId: null,
    unlocked: template.unlocked ?? true,
    state: template.state ?? 'active',
    repair,
    repairStarted: false,
    lockedUntil: null,
    pendingAction: null,
    attachedCardIds: []
  };
}

function formatDurationLabel(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped >= 60000) {
    const minutes = Math.floor(clamped / 60000);
    const seconds = Math.round((clamped % 60000) / 1000);
    if (seconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }
  if (clamped >= 1000) {
    return `${Math.round(clamped / 1000)}s`;
  }
  return `${clamped}ms`;
}

function getSlotBaseLockDurationMs(slot: Slot): number {
  const base = SLOT_LOCK_DURATIONS[slot.type] ?? SLOT_LOCK_BASE_MS;
  if (slot.type === 'manor' && slot.state === 'damaged') {
    return base * 2;
  }
  return base;
}

function getScaledSlotLockDurationMs(slot: Slot, timeScale: number): number {
  const baseDuration = getSlotBaseLockDurationMs(slot);
  const scale = Math.max(timeScale, 0.25);
  return Math.max(250, Math.round(baseDuration / scale));
}

const MANOR_ROOM_TEMPLATE_KEYS = [
  'damaged-sanctum',
  'damaged-scriptorium',
  'damaged-archive',
  'damaged-circle',
  'damaged-bedroom'
] as const;

type ManorRoomTemplateKey = (typeof MANOR_ROOM_TEMPLATE_KEYS)[number];

const DREAM_TITLES = [
  'Silver Staircases',
  'Echoing Halls',
  'Frosted Lanterns',
  'Lunar Choirs',
  'Velvet Storms',
  'Shattered Constellations'
] as const;

const JOURNAL_CARD_NAME = 'Private Journal';

function randomFrom<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function isDreamCard(card: CardInstance | undefined): card is CardInstance {
  return Boolean(card && card.traits.includes('dream'));
}

function isJournalCard(card: CardInstance | undefined): card is CardInstance {
  return Boolean(card && card.traits.includes('journal'));
}

function extractDreamTitle(dream: CardInstance): string {
  return dream.name.replace(/^Fleeting Dream:\s*/, '');
}

function createDreamCard(): CardInstance {
  const title = randomFrom(DREAM_TITLES);
  const template: CardTemplate = {
    key: 'fleeting-dream',
    name: `Fleeting Dream: ${title}`,
    type: 'inspiration',
    description: `A fleeting vision of ${title.toLowerCase()}. Document it before it fades.`,
    traits: ['dream', 'fleeting'],
    permanent: false,
    lifetime: 3
  };
  return instantiateCard(template);
}

function extractJournalDreams(journal: CardInstance): string[] {
  return journal.traits
    .filter((trait) => trait.startsWith('dream:'))
    .map((trait) => trait.slice('dream:'.length));
}

function formatJournalDescription(entries: string[]): string {
  if (entries.length === 0) {
    return 'Blank pages await recorded dreams.';
  }
  if (entries.length === 1) {
    return `Pages capture the dream of ${entries[0]}.`;
  }
  if (entries.length === 2) {
    return `Entries chronicle the dreams of ${entries[0]} and ${entries[1]}.`;
  }

  const rest = entries.slice(0, -1).join(', ');
  const last = entries[entries.length - 1];
  return `Entries chronicle the dreams of ${rest}, and ${last}.`;
}

function describeJournal(entries: string[]): string {
  return `A bound journal cataloguing lucid recollections. ${formatJournalDescription(entries)}`;
}

function normalizeJournalTraits(journal: CardInstance, entries: string[]): string[] {
  const baseTraits = journal.traits.filter((trait) => !trait.startsWith('dream:'));
  const dedupedBase = Array.from(new Set(baseTraits.filter((trait) => trait !== 'journal' && trait !== 'dream-record')));
  const dreamTraits = entries.map((entry) => `dream:${entry}`);
  return [...dedupedBase, 'journal', 'dream-record', ...dreamTraits];
}

function applyJournalEntries(journal: CardInstance, entries: string[]): CardInstance {
  return {
    ...journal,
    name: JOURNAL_CARD_NAME,
    description: describeJournal(entries),
    traits: normalizeJournalTraits(journal, entries),
    permanent: true,
    remainingTurns: null
  };
}

function augmentJournalWithDream(journal: CardInstance, dreamTitle: string): CardInstance {
  const existingEntries = extractJournalDreams(journal);
  const hasEntry = existingEntries.includes(dreamTitle);
  const updatedEntries = hasEntry ? existingEntries : [...existingEntries, dreamTitle];
  return applyJournalEntries(journal, updatedEntries);
}

function createEmptyJournal(): CardInstance {
  const template: CardTemplate = {
    key: 'private-journal',
    name: JOURNAL_CARD_NAME,
    type: 'inspiration',
    description: describeJournal([]),
    traits: ['journal', 'dream-record'],
    permanent: true
  };
  const journal = instantiateCard(template);
  return applyJournalEntries(journal, []);
}

function createJournalFromDream(dream: CardInstance): CardInstance {
  const recordedTitle = extractDreamTitle(dream) || dream.name;
  const template: CardTemplate = {
    key: 'private-journal',
    name: JOURNAL_CARD_NAME,
    type: 'inspiration',
    description: describeJournal([recordedTitle]),
    traits: ['journal', 'dream-record', `dream:${recordedTitle}`],
    permanent: true
  };
  const journal = instantiateCard(template);
  return applyJournalEntries(journal, [recordedTitle]);
}

function baseResources(): Resources {
  return { coin: 0, lore: 0, glimmer: 1 };
}

function initialState(): GameState {
  const hero = instantiateCard(HERO_TEMPLATE);
  const whisper = instantiateCard(OPPORTUNITY_TEMPLATES[0]);
  const slots: Record<string, Slot> = {};
  const manorSlot = instantiateSlot(SLOT_TEMPLATES.manor);

  slots[manorSlot.id] = manorSlot;

  return {
    cycle: 1,
    heroCardId: hero.id,
    cards: {
      [hero.id]: hero,
      [whisper.id]: whisper
    },
    hand: [hero.id, whisper.id],
    slots,
    resources: baseResources(),
    log: [
      'You arrive at the shuttered manor. Its rooms slumber beneath dust and locked memories.'
    ],
    discoveries: [],
    timeScale: 1,
    pendingReveals: []
  };
}

type Action =
  | { type: 'MOVE_CARD_TO_SLOT'; cardId: string; slotId: string }
  | { type: 'RECALL_CARD'; cardId: string }
  | { type: 'ACTIVATE_SLOT'; slotId: string }
  | { type: 'UPGRADE_SLOT'; slotId: string }
  | { type: 'ADVANCE_TIME' }
  | { type: 'RESOLVE_PENDING_SLOT_ACTIONS' }
  | { type: 'SET_TIME_SCALE'; scale: number }
  | { type: 'ACKNOWLEDGE_CARD_REVEAL'; cardId: string };

interface SlotActionResult {
  state: GameState;
  log: string[];
  performed: boolean;
}

function appendLog(log: string[], message: string): string[] {
  const next = [message, ...log];
  return next.slice(0, 14);
}

function removeFromHand(hand: string[], cardId: string): string[] {
  return hand.filter((id) => id !== cardId);
}

function addToHand(hand: string[], cardId: string, toFront = true): string[] {
  const filtered = removeFromHand(hand, cardId);
  return toFront ? [cardId, ...filtered] : [...filtered, cardId];
}

function isCardAllowedInSlot(card: CardInstance, slot: Slot): boolean {
  if (slot.accepted === 'persona-only') {
    return card.type === 'persona';
  }
  if (slot.accepted === 'non-persona') {
    return card.type !== 'persona';
  }
  return true;
}

function calculateUpgradeCost(slot: Slot): number {
  return slot.upgradeCost + (slot.level - 1) * 2;
}

function applyResources(current: Resources, delta: Partial<Resources>): Resources {
  return {
    coin: Math.max(0, current.coin + (delta.coin ?? 0)),
    lore: Math.max(0, current.lore + (delta.lore ?? 0)),
    glimmer: Math.max(0, current.glimmer + (delta.glimmer ?? 0))
  };
}

function maybeUnlockExpeditionSlot(state: GameState): GameState {
  const hasSlot = Object.values(state.slots).some((slot) => slot.type === 'expedition');
  if (hasSlot) {
    return state;
  }

  const discovery = state.discoveries.find((entry) => entry.key === 'umbral-gate');
  if (!discovery) {
    return state;
  }

  const expeditionTemplate = SLOT_TEMPLATES.expedition;
  const expeditionSlot = instantiateSlot(expeditionTemplate);
  const updatedSlots = {
    ...state.slots,
    [expeditionSlot.id]: expeditionSlot
  };

  return {
    ...state,
    slots: updatedSlots,
    log: appendLog(state.log, 'The Umbral Gate yawns open, offering expeditions into the Hollow Ways.')
  };
}

function applyDiscovery(state: GameState, seed: DiscoverySeed): GameState {
  const alreadyKnown = state.discoveries.some((entry) => entry.key === seed.key);
  if (alreadyKnown) {
    return state;
  }

  const discovery: Discovery = {
    id: `${seed.key}-${Date.now().toString(36)}`,
    key: seed.key,
    name: seed.name,
    description: seed.description,
    cycle: state.cycle
  };

  const updatedState: GameState = {
    ...state,
    discoveries: [discovery, ...state.discoveries],
    log: appendLog(state.log, `Discovery gained: ${seed.name}. ${seed.description}`)
  };

  return maybeUnlockExpeditionSlot(updatedState);
}

function spawnOpportunity(state: GameState, log: string[]): {
  state: GameState;
  log: string[];
} {
  const template = OPPORTUNITY_TEMPLATES[Math.floor(Math.random() * OPPORTUNITY_TEMPLATES.length)];
  const card = instantiateCard(template);

  const nextState: GameState = {
    ...state,
    cards: {
      ...state.cards,
      [card.id]: card
    },
    hand: addToHand(state.hand, card.id, false)
  };

  const nextLog = appendLog(log, `${card.name} drifts within reach, inviting attention.`);

  return { state: nextState, log: nextLog };
}

function workHearth(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'The sanctum waits for someone to rest within it.'), performed: false };
  }

  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'Only a living persona can draw the sanctum’s calm.'),
      performed: false
    };
  }

  const loreGain = 1 + Math.floor(slot.level / 2);
  const glimmerGain = slot.level >= 3 ? 1 : 0;

  const nextResources = applyResources(state.resources, {
    lore: loreGain,
    glimmer: glimmerGain
  });

  const fragments = [`${loreGain} lore`];
  if (glimmerGain > 0) {
    fragments.push(`${glimmerGain} glimmer`);
  }

  const nextLog = appendLog(
    log,
    `${card.name} communes with the Veiled Sanctum, gaining ${fragments.join(' and ')}.`
  );

  return {
    state: {
      ...state,
      resources: nextResources
    },
    log: nextLog,
    performed: true
  };
}

function workJob(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.occupantId) {
    return {
      state,
      log: appendLog(log, 'Assign your persona to the job before attempting to work it.'),
      performed: false
    };
  }
  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'Only a persona can interpret the ledgers of the scriptorium.'),
      performed: false
    };
  }

  const coinGain = 2 + slot.level;
  const loreGain = slot.level >= 2 ? 1 : 0;
  const nextResources = applyResources(state.resources, {
    coin: coinGain,
    lore: loreGain
  });

  const nextLog = appendLog(
    log,
    `${card.name} works the Moonlit Scriptorium, earning ${coinGain} coin${
      loreGain > 0 ? ` and ${loreGain} lore` : ''
    }.`
  );

  if (Math.random() < 0.4) {
    const { state: spawnedState, log: spawnedLog } = spawnOpportunity(
      { ...state, resources: nextResources },
      nextLog
    );
    return { state: spawnedState, log: spawnedLog, performed: true };
  }

  return {
    state: {
      ...state,
      resources: nextResources
    },
    log: nextLog,
    performed: true
  };
}

function exploreManor(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.occupantId) {
    return {
      state,
      log: appendLog(log, 'Send a persona into the manor before attempting to explore it.'),
      performed: false
    };
  }

  const persona = state.cards[slot.occupantId];
  if (!persona || persona.type !== 'persona') {
    return { state, log: appendLog(log, 'Only a living persona can unveil the manor’s halls.'), performed: false };
  }

  const missingKeys: ManorRoomTemplateKey[] = MANOR_ROOM_TEMPLATE_KEYS.filter((templateKey) => {
    const template = SLOT_TEMPLATES[templateKey];
    const restoredKey = template.repair ? SLOT_TEMPLATES[template.repair.targetKey].key : null;
    return !Object.values(state.slots).some(
      (existing) => existing.key === template.key || (restoredKey ? existing.key === restoredKey : false)
    );
  });

  if (missingKeys.length === 0) {
    return {
      state,
      log: appendLog(log, 'The manor is quiet for now; every discovered room awaits restoration.'),
      performed: false
    };
  }

  if (slot.pendingAction) {
    return {
      state,
      log: appendLog(log, `${persona.name} is already charting the manor’s halls.`),
      performed: false
    };
  }

  const updatedSlots: Record<string, Slot> = {
    ...state.slots,
    [slot.id]: {
      ...slot,
      pendingAction: { type: 'explore-manor' }
    }
  };

  const nextLog = appendLog(
    log,
    `${persona.name} ventures deeper into ${slot.name}, mapping its passages. They will report back soon.`
  );

  return {
    state: {
      ...state,
      slots: updatedSlots
    },
    log: nextLog,
    performed: true
  };
}

function completeManorExploration(state: GameState, slotId: string, log: string[]): {
  state: GameState;
  log: string[];
} {
  const currentSlot = state.slots[slotId];
  if (!currentSlot) {
    return { state, log };
  }

  const persona = currentSlot.occupantId ? state.cards[currentSlot.occupantId] ?? null : null;
  const missingKeys: ManorRoomTemplateKey[] = MANOR_ROOM_TEMPLATE_KEYS.filter((templateKey) => {
    const template = SLOT_TEMPLATES[templateKey];
    const restoredKey = template.repair ? SLOT_TEMPLATES[template.repair.targetKey].key : null;
    return !Object.values(state.slots).some(
      (existing) => existing.key === template.key || (restoredKey ? existing.key === restoredKey : false)
    );
  });

  const updatedSlots: Record<string, Slot> = { ...state.slots };
  const revealedRooms: string[] = [];

  if (missingKeys.length > 0) {
    const selectedKey = missingKeys[0];
    const template = SLOT_TEMPLATES[selectedKey];
    const newRoom = instantiateSlot(template);
    updatedSlots[newRoom.id] = newRoom;
    revealedRooms.push(newRoom.name);
  }

  const shouldRemoveManor = missingKeys.length <= 1;

  if (shouldRemoveManor) {
    delete updatedSlots[slotId];
  } else {
    updatedSlots[slotId] = {
      ...currentSlot,
      occupantId: null,
      pendingAction: null,
      lockedUntil: null
    };
  }

  let updatedCards = state.cards;
  let updatedHand = state.hand;
  if (persona) {
    updatedCards = {
      ...state.cards,
      [persona.id]: { ...persona, location: { area: 'hand' } }
    };
    updatedHand = addToHand(state.hand, persona.id);
  }

  let nextLog = log;
  const explorerName = persona ? persona.name : 'Your retinue';

  if (revealedRooms.length > 0) {
    const roomsFragment = revealedRooms.join(', ');
    const summary = shouldRemoveManor
      ? `${explorerName} charts the manor’s halls, revealing ${roomsFragment} before the manor’s entrance seals behind them.`
      : `${explorerName} charts the manor’s halls, revealing ${roomsFragment}. More ruined chambers await discovery.`;
    nextLog = appendLog(log, summary);
  } else {
    nextLog = appendLog(
      log,
      `${explorerName} finds no further chambers awaiting discovery as the manor’s entrance seals behind them.`
    );
  }

  return {
    state: {
      ...state,
      slots: updatedSlots,
      cards: updatedCards,
      hand: updatedHand,
      log: nextLog
    },
    log: nextLog
  };
}

function resolvePendingSlotActions(state: GameState, now: number): GameState {
  let nextState = state;
  const slotIds = Object.keys(state.slots);

  for (const slotId of slotIds) {
    const slot = nextState.slots[slotId];
    if (!slot || !slot.pendingAction) {
      continue;
    }
    if (slot.lockedUntil) {
      const remaining = slot.lockedUntil - now;
      // Allow a small grace window so we don't require another full cycle when the
      // lock expires between timer ticks.
      if (remaining > SLOT_ACTION_COMPLETION_TOLERANCE_MS) {
        continue;
      }
    }

    switch (slot.pendingAction.type) {
      case 'explore-manor': {
        const result = completeManorExploration(nextState, slotId, nextState.log);
        nextState = result.state;
        break;
      }
      case 'deliver-cards': {
        const { cardIds, reveal } = slot.pendingAction;
        let updatedState = nextState;
        let updatedCards = { ...updatedState.cards };
        let updatedHand = [...updatedState.hand];
        let updatedSlots = { ...updatedState.slots };
        let updatedLog = updatedState.log;
        const deliveredNames: string[] = [];

        for (const cardId of cardIds) {
          const card = updatedCards[cardId];
          if (!card) {
            continue;
          }
          deliveredNames.push(card.name);
          updatedCards = {
            ...updatedCards,
            [cardId]: { ...card, location: { area: 'hand' } }
          };
          updatedHand = addToHand(updatedHand, cardId, false);
        }

        if (deliveredNames.length > 0) {
          const summary = `${slot.name} yields ${deliveredNames.join(', ')}.`;
          updatedLog = appendLog(updatedLog, summary);
        }

        const clearedSlot: Slot = {
          ...slot,
          lockedUntil: null,
          pendingAction: null
        };

        updatedSlots = {
          ...updatedSlots,
          [slotId]: clearedSlot
        };

        const pendingReveals = reveal
          ? [...updatedState.pendingReveals, ...cardIds]
          : updatedState.pendingReveals;

        updatedState = {
          ...updatedState,
          cards: updatedCards,
          hand: updatedHand,
          slots: updatedSlots,
          log: updatedLog,
          pendingReveals
        };

        nextState = updatedState;
        break;
      }
      default:
        break;
    }
  }

  return nextState;
}

function repairManorRoom(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.repair) {
    return { state, log, performed: false };
  }

  if (!slot.occupantId) {
    return {
      state,
      log: appendLog(log, 'Assign a persona to clear the debris from this room.'),
      performed: false
    };
  }

  const persona = state.cards[slot.occupantId];
  if (!persona || persona.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'A persona must brave the dust and cobwebs to restore the room.'),
      performed: false
    };
  }

  const remainingMs = slot.repair.remaining * SLOT_LOCK_BASE_MS;
  const message = slot.repairStarted
    ? `${persona.name} continues restoring ${slot.name}. ≈ ${formatDurationLabel(remainingMs)} remain.`
    : `${persona.name} begins restoring ${slot.name}. ≈ ${formatDurationLabel(remainingMs)} remain.`;

  if (slot.repairStarted) {
    return { state, log: appendLog(log, message), performed: false };
  }

  const updatedSlots = {
    ...state.slots,
    [slot.id]: {
      ...slot,
      repairStarted: true
    }
  };

  return {
    state: {
      ...state,
      slots: updatedSlots
    },
    log: appendLog(log, message),
    performed: true
  };
}

function bedroomSlot(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'Let a persona rest within the bedroom to invite a dream.'), performed: false };
  }

  const persona = state.cards[slot.occupantId];
  if (!persona || persona.type !== 'persona') {
    return { state, log: appendLog(log, 'Only a persona may slumber deeply enough to dream here.'), performed: false };
  }

  const dream = createDreamCard();
  const stagedDream: CardInstance = { ...dream, location: { area: 'lost' } };

  const updatedSlots = {
    ...state.slots,
    [slot.id]: {
      ...slot,
      pendingAction: {
        type: 'deliver-cards',
        cardIds: [stagedDream.id],
        reveal: true
      }
    }
  };

  const nextState: GameState = {
    ...state,
    cards: {
      ...state.cards,
      [stagedDream.id]: stagedDream
    },
    slots: updatedSlots
  };

  const nextLog = appendLog(
    log,
    `${persona.name} slumbers in ${slot.name}. A dream will surface when their rest concludes.`
  );

  return { state: nextState, log: nextLog, performed: true };
}

function studySlot(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'Place a card upon the Night Archive to study it.'), performed: false };
  }

  const card = state.cards[slot.occupantId];
  if (!card) {
    return { state, log, performed: false };
  }

  const assistant = slot.assistantId ? state.cards[slot.assistantId] ?? null : null;
  const attachmentCards = slot.attachedCardIds
    .map((id) => state.cards[id])
    .filter((attached): attached is CardInstance => Boolean(attached));

  if (isDreamCard(card) && assistant && assistant.type === 'persona') {
    const existingJournal = attachmentCards.find((attached) => attached.traits.includes('journal'));
    const updatedCards = { ...state.cards };
    delete updatedCards[card.id];

    const stagedIds: string[] = [];
    let nextLog = log;

    if (existingJournal) {
      const augmented = augmentJournalWithDream(existingJournal, extractDreamTitle(card) || card.name);
      updatedCards[existingJournal.id] = { ...augmented, location: { area: 'lost' } };
      stagedIds.push(existingJournal.id);
      nextLog = appendLog(
        log,
        `${assistant.name} expands ${existingJournal.name} with ${card.name}. The entry will be ready once the study concludes.`
      );
    } else {
      const journal = createJournalFromDream(card);
      const journalCard: CardInstance = { ...journal, location: { area: 'lost' } };
      updatedCards[journalCard.id] = journalCard;
      stagedIds.push(journalCard.id);
      nextLog = appendLog(
        log,
        `${assistant.name} records ${card.name}, preserving it within ${journalCard.name}. The entry will be ready once the study concludes.`
      );
    }

    const cleanedAttachments = slot.attachedCardIds.filter((id) => {
      if (existingJournal && id === existingJournal.id) {
        return false;
      }
      return true;
    });

    const updatedSlots = {
      ...state.slots,
      [slot.id]: {
        ...slot,
        occupantId: assistant.id,
        assistantId: null,
        attachedCardIds: cleanedAttachments,
        pendingAction: {
          type: 'deliver-cards',
          cardIds: stagedIds,
          reveal: true
        }
      }
    };

    const updatedHand = removeFromHand(state.hand, card.id);

    return {
      state: {
        ...state,
        cards: {
          ...updatedCards,
          [assistant.id]: { ...assistant, location: { area: 'slot', slotId: slot.id } }
        },
        slots: updatedSlots,
        hand: updatedHand
      },
      log: nextLog,
      performed: true
    };
  }

  if (card.type === 'persona') {
    const loreGain = 1;
    const nextResources = applyResources(state.resources, { lore: loreGain });
    return {
      state: {
        ...state,
        resources: nextResources
      },
      log: appendLog(log, `${card.name} reflects upon their path, gaining ${loreGain} lore.`),
      performed: true
    };
  }

  let nextState: GameState = { ...state };
  let nextLog = log;

  if (card.rewards?.resources) {
    nextState = {
      ...nextState,
      resources: applyResources(nextState.resources, card.rewards.resources)
    };
    const fragments = Object.entries(card.rewards.resources)
      .map(([key, value]) => `${value} ${key}`)
      .join(' and ');
    nextLog = appendLog(nextLog, `${card.name} is deciphered, yielding ${fragments}.`);
  } else {
    nextLog = appendLog(nextLog, `${card.name} reveals little before dissolving.`);
  }

  if (card.rewards?.discovery) {
    nextState = applyDiscovery(nextState, card.rewards.discovery);
    nextLog = nextState.log;
  }

  const updatedSlots = {
    ...nextState.slots,
    [slot.id]: {
      ...slot,
      occupantId: null,
      assistantId: null,
      attachedCardIds: []
    }
  };

  const updatedCards = { ...nextState.cards };
  delete updatedCards[card.id];

  return {
    state: {
      ...nextState,
      slots: updatedSlots,
      cards: updatedCards,
      hand: removeFromHand(nextState.hand, card.id)
    },
    log: nextLog,
    performed: true
  };
}

function ritualSlot(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'Seat your persona within the circle to conduct a rite.'), performed: false };
  }
  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'A living persona must anchor the ritual.'),
      performed: false
    };
  }

  const loreCost = Math.max(2, 2 + slot.level - 1);
  if (state.resources.lore < loreCost) {
    return {
      state,
      log: appendLog(log, `You require ${loreCost} lore to empower the ritual.`),
      performed: false
    };
  }

  const glimmerGain = 1 + Math.floor(slot.level / 2);
  const nextResources = applyResources(state.resources, {
    lore: -loreCost,
    glimmer: glimmerGain
  });

  const nextLog = appendLog(
    log,
    `${card.name} completes a rite, converting ${loreCost} lore into ${glimmerGain} glimmer.`
  );

  if (Math.random() < 0.35) {
    const { state: spawnedState, log: spawnedLog } = spawnOpportunity(
      { ...state, resources: nextResources },
      nextLog
    );
    return { state: spawnedState, log: spawnedLog, performed: true };
  }

  return {
    state: {
      ...state,
      resources: nextResources
    },
    log: nextLog,
    performed: true
  };
}

function expeditionSlot(state: GameState, slot: Slot, log: string[]): SlotActionResult {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'A daring persona must step through the Umbral Gate.'), performed: false };
  }
  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return { state, log: appendLog(log, 'Only your persona can brave the Umbral Gate.'), performed: false };
  }

  const glimmerCost = 1;
  if (state.resources.glimmer < glimmerCost) {
    return {
      state,
      log: appendLog(log, 'At least 1 glimmer is needed to light the path beyond the gate.'),
      performed: false
    };
  }

  const coinGain = 1 + slot.level;
  const loreGain = 2 + slot.level;

  let nextState: GameState = {
    ...state,
    resources: applyResources(state.resources, {
      glimmer: -glimmerCost,
      coin: coinGain,
      lore: loreGain
    })
  };

  let nextLog = appendLog(
    log,
    `${card.name} ventures beyond the Umbral Gate, returning with ${coinGain} coin and ${loreGain} lore.`
  );

  if (Math.random() < 0.5) {
    const { state: spawnedState, log: spawnedLog } = spawnOpportunity(nextState, nextLog);
    nextState = spawnedState;
    nextLog = spawnedLog;
  }

  return { state: nextState, log: nextLog, performed: true };
}

function activateSlot(state: GameState, slotId: string): SlotActionResult {
  const preparedState = resolvePendingSlotActions(state, Date.now());
  const slot = preparedState.slots[slotId];
  if (!slot || !slot.unlocked) {
    return {
      state: preparedState,
      log: appendLog(preparedState.log, 'That slot is not yet available.'),
      performed: false
    };
  }

  const now = Date.now();
  if (slot.lockedUntil && slot.lockedUntil > now) {
    const remaining = slot.lockedUntil - now;
    const message = `${slot.name} is still resolving a previous action. ≈ ${formatDurationLabel(remaining)} remain.`;
    return {
      state: preparedState,
      log: appendLog(preparedState.log, message),
      performed: false
    };
  }

  const log = preparedState.log;

  let result: SlotActionResult;

  switch (slot.type) {
    case 'hearth':
      result = workHearth(preparedState, slot, log);
      break;
    case 'work':
      result = workJob(preparedState, slot, log);
      break;
    case 'study':
      result = studySlot(preparedState, slot, log);
      break;
    case 'ritual':
      result = ritualSlot(preparedState, slot, log);
      break;
    case 'expedition':
      result = expeditionSlot(preparedState, slot, log);
      break;
    case 'manor':
      if (slot.state === 'damaged' && slot.repair) {
        result = repairManorRoom(preparedState, slot, log);
      } else {
        result = exploreManor(preparedState, slot, log);
      }
      break;
    case 'bedroom':
      result = bedroomSlot(preparedState, slot, log);
      break;
    default:
      result = { state: preparedState, log, performed: false };
  }

  if (!result.performed) {
    return result;
  }

  const refreshedSlot = result.state.slots[slotId];
  if (!refreshedSlot) {
    return result;
  }

  const lockDuration = getScaledSlotLockDurationMs(refreshedSlot, result.state.timeScale);
  const lockedSlot: Slot = {
    ...refreshedSlot,
    lockedUntil: Date.now() + lockDuration
  };

  const updatedSlots = {
    ...result.state.slots,
    [slotId]: lockedSlot
  };

  const nextState: GameState = {
    ...result.state,
    slots: updatedSlots
  };

  const nextLog = appendLog(
    result.log,
    `${lockedSlot.name} will be ready again in about ${formatDurationLabel(lockDuration)}.`
  );

  return { state: nextState, log: nextLog, performed: true };
}

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'MOVE_CARD_TO_SLOT': {
      const card = state.cards[action.cardId];
      const slot = state.slots[action.slotId];
      if (!card || !slot || !slot.unlocked) {
        return {
          ...state,
          log: appendLog(state.log, 'That move is not possible right now.')
        };
      }

      if (!isCardAllowedInSlot(card, slot)) {
        return {
          ...state,
          log: appendLog(state.log, `${card.name} is not suited for ${slot.name}.`)
        };
      }

      if (card.location.area === 'slot' && card.location.slotId === slot.id) {
        return state;
      }

      const updatedSlots: Record<string, Slot> = { ...state.slots };
      let updatedCards: Record<string, CardInstance> = { ...state.cards };
      let updatedHand = [...state.hand];
      let updatedLog = state.log;

      if (card.location.area === 'hand') {
        updatedHand = removeFromHand(updatedHand, card.id);
      } else if (card.location.area === 'slot') {
        const previousSlot = updatedSlots[card.location.slotId];
        if (previousSlot) {
          let nextPreviousSlot: Slot = previousSlot;

          if (previousSlot.occupantId === card.id) {
            const promotedOccupant =
              previousSlot.assistantId && previousSlot.assistantId !== card.id
                ? previousSlot.assistantId
                : null;
            nextPreviousSlot = {
              ...nextPreviousSlot,
              occupantId: promotedOccupant,
              assistantId:
                promotedOccupant && previousSlot.assistantId === promotedOccupant
                  ? null
                  : previousSlot.assistantId === card.id
                  ? null
                  : previousSlot.assistantId
            };
          } else if (previousSlot.assistantId === card.id) {
            nextPreviousSlot = {
              ...nextPreviousSlot,
              assistantId: null
            };
          }

          if (nextPreviousSlot.attachedCardIds.includes(card.id)) {
            nextPreviousSlot = {
              ...nextPreviousSlot,
              attachedCardIds: nextPreviousSlot.attachedCardIds.filter((id) => id !== card.id)
            };
          }

          updatedSlots[previousSlot.id] = nextPreviousSlot;
        }
      }

      const targetSlot = updatedSlots[slot.id];
      const currentOccupantId = targetSlot.occupantId;
      const currentAssistantId = targetSlot.assistantId;
      const currentOccupant = currentOccupantId ? updatedCards[currentOccupantId] : undefined;
      const currentAssistant = currentAssistantId ? updatedCards[currentAssistantId] : undefined;
      const currentAttachments = targetSlot.attachedCardIds;
      const attachmentCards = currentAttachments
        .map((id) => updatedCards[id])
        .filter((attached): attached is CardInstance => Boolean(attached));

      const ensureAttachmentIds = (ids: string[]) => Array.from(new Set(ids));

      if (
        slot.type === 'study' &&
        currentOccupant &&
        currentOccupant.type === 'persona' &&
        isJournalCard(card) &&
        !currentAssistantId
      ) {
        updatedCards = {
          ...updatedCards,
          [currentOccupant.id]: { ...currentOccupant, location: { area: 'slot', slotId: slot.id } },
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };
        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: currentOccupant.id,
          attachedCardIds: ensureAttachmentIds(currentAttachments.filter((id) => id !== card.id))
        };
        updatedLog = appendLog(
          updatedLog,
          `${card.name} is opened for ${currentOccupant.name}, ready to capture their studies.`
        );
        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        currentOccupant.type === 'persona' &&
        isDreamCard(card) &&
        !currentAssistantId
      ) {
        updatedCards = {
          ...updatedCards,
          [currentOccupant.id]: { ...currentOccupant, location: { area: 'slot', slotId: slot.id } },
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };
        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: currentOccupant.id,
          attachedCardIds: ensureAttachmentIds(currentAttachments.filter((id) => id !== card.id))
        };
        updatedLog = appendLog(
          updatedLog,
          `${card.name} is entrusted to ${currentOccupant.name} for study.`
        );
        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        isDreamCard(currentOccupant) &&
        currentAssistant &&
        currentAssistant.type === 'persona' &&
        isJournalCard(card)
      ) {
        updatedCards = {
          ...updatedCards,
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };

        const nextAttachments = ensureAttachmentIds([
          ...currentAttachments.filter((id) => id !== card.id),
          card.id
        ]);

        updatedSlots[slot.id] = {
          ...targetSlot,
          attachedCardIds: nextAttachments
        };

        updatedLog = appendLog(
          updatedLog,
          `${card.name} lies open for ${currentAssistant.name}, ready to capture ${currentOccupant.name}.`
        );

        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        isDreamCard(currentOccupant) &&
        card.type === 'persona' &&
        (!currentAssistant || currentAssistant.id === card.id)
      ) {
        updatedCards = {
          ...updatedCards,
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };
        updatedSlots[slot.id] = {
          ...targetSlot,
          assistantId: card.id
        };
        updatedLog = appendLog(
          updatedLog,
          `${card.name} joins ${currentOccupant.name} to interpret the dream.`
        );
        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (
        slot.type === 'study' &&
        currentOccupant &&
        isJournalCard(currentOccupant) &&
        currentAssistant &&
        currentAssistant.type === 'persona' &&
        isDreamCard(card)
      ) {
        const nextAttachments = ensureAttachmentIds([
          ...currentAttachments.filter((id) => id !== card.id && id !== currentOccupant.id),
          currentOccupant.id
        ]);

        updatedCards = {
          ...updatedCards,
          [currentOccupant.id]: { ...currentOccupant, location: { area: 'slot', slotId: slot.id } },
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };

        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: currentAssistant.id,
          attachedCardIds: nextAttachments
        };

        updatedLog = appendLog(
          updatedLog,
          `${card.name} is placed for ${currentAssistant.name} to chronicle within ${currentOccupant.name}.`
        );

        return {
          ...state,
          cards: updatedCards,
          slots: updatedSlots,
          hand: updatedHand,
          log: updatedLog
        };
      }

      if (currentOccupantId && currentOccupantId !== card.id) {
        const displacedUpdates: Record<string, CardInstance> = {};

        if (currentOccupant) {
          displacedUpdates[currentOccupant.id] = {
            ...currentOccupant,
            location: { area: 'hand' }
          };
          updatedHand = addToHand(updatedHand, currentOccupant.id);
        }

        if (currentAssistantId && currentAssistant && currentAssistant.id !== card.id) {
          displacedUpdates[currentAssistant.id] = {
            ...currentAssistant,
            location: { area: 'hand' }
          };
          updatedHand = addToHand(updatedHand, currentAssistant.id);
        }

        for (const attachment of attachmentCards) {
          if (attachment.id === card.id) {
            continue;
          }
          displacedUpdates[attachment.id] = {
            ...attachment,
            location: { area: 'hand' }
          };
          updatedHand = addToHand(updatedHand, attachment.id);
        }

        updatedCards = {
          ...updatedCards,
          ...displacedUpdates,
          [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
        };

        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: null,
          attachedCardIds: []
        };
      } else {
        updatedCards = {
          ...updatedCards,
          [card.id]: {
            ...card,
            location: { area: 'slot', slotId: slot.id }
          }
        };

        updatedSlots[slot.id] = {
          ...targetSlot,
          occupantId: card.id,
          assistantId: targetSlot.assistantId && targetSlot.assistantId !== card.id ? targetSlot.assistantId : null,
          attachedCardIds: ensureAttachmentIds(
            currentAttachments.filter((id) => id !== card.id)
          )
        };
      }

      updatedLog = appendLog(updatedLog, `${card.name} settles into ${slot.name}.`);

      return {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand,
        log: updatedLog
      };
    }
    case 'RECALL_CARD': {
      const card = state.cards[action.cardId];
      if (!card) {
        return state;
      }

      if (card.location.area === 'slot') {
        const slot = state.slots[card.location.slotId];
        if (slot && slot.lockedUntil && slot.lockedUntil > Date.now()) {
          return {
            ...state,
            log: appendLog(
              state.log,
              `${card.name} is still committed to ${slot.name}. Wait for the action to resolve before recalling them.`
            )
          };
        }
      }

      let updatedSlots = state.slots;
      if (card.location.area === 'slot') {
        const slot = state.slots[card.location.slotId];
        if (slot) {
          let nextSlot: Slot = slot;
          if (slot.occupantId === card.id) {
            const promotedOccupant =
              slot.assistantId && slot.assistantId !== card.id ? slot.assistantId : null;
            nextSlot = {
              ...slot,
              occupantId: promotedOccupant,
              assistantId:
                promotedOccupant && slot.assistantId === promotedOccupant
                  ? null
                  : slot.assistantId === card.id
                  ? null
                  : slot.assistantId
            };
          } else if (slot.assistantId === card.id) {
            nextSlot = {
              ...slot,
              assistantId: null
            };
          }

          if (nextSlot.attachedCardIds.includes(card.id)) {
            nextSlot = {
              ...nextSlot,
              attachedCardIds: nextSlot.attachedCardIds.filter((id) => id !== card.id)
            };
          }

          if (nextSlot !== slot) {
            updatedSlots = {
              ...state.slots,
              [slot.id]: nextSlot
            };
          }
        }
      }

      return {
        ...state,
        cards: {
          ...state.cards,
          [card.id]: { ...card, location: { area: 'hand' } }
        },
        slots: updatedSlots,
        hand: addToHand(state.hand, card.id),
        log: appendLog(state.log, `${card.name} returns to your hand.`)
      };
    }
    case 'ACTIVATE_SLOT': {
      const result = activateSlot(state, action.slotId);
      const stateWithLog = { ...result.state, log: result.log };
      return stateWithLog;
    }
    case 'UPGRADE_SLOT': {
      const slot = state.slots[action.slotId];
      if (!slot) {
        return state;
      }
      const cost = calculateUpgradeCost(slot);
      if (state.resources.glimmer < cost) {
        return {
          ...state,
          log: appendLog(state.log, `You need ${cost} glimmer to upgrade ${slot.name}.`)
        };
      }

      const upgradedSlot: Slot = {
        ...slot,
        level: slot.level + 1
      };

      return {
        ...state,
        slots: {
          ...state.slots,
          [slot.id]: upgradedSlot
        },
        resources: applyResources(state.resources, { glimmer: -cost }),
        log: appendLog(state.log, `${slot.name} is enhanced to level ${upgradedSlot.level}.`)
      };
    }
    case 'ADVANCE_TIME': {
      const now = Date.now();
      let updatedCards = { ...state.cards };
      let updatedSlots = { ...state.slots };
      let updatedHand = [...state.hand];
      let updatedLog = appendLog(state.log, 'The candle gutters as time presses onward.');

      for (const card of Object.values(state.cards)) {
        if (card.permanent || card.location.area === 'lost') {
          continue;
        }
        const remaining = (card.remainingTurns ?? 0) - 1;
        if (remaining <= 0) {
          if (card.location.area === 'hand') {
            updatedHand = removeFromHand(updatedHand, card.id);
          } else if (card.location.area === 'slot') {
            const slot = updatedSlots[card.location.slotId];
            if (slot && slot.occupantId === card.id) {
              const promotedOccupant =
                slot.assistantId && slot.assistantId !== card.id ? slot.assistantId : null;
              updatedSlots = {
                ...updatedSlots,
                [slot.id]: {
                  ...slot,
                  occupantId: promotedOccupant,
                  assistantId:
                    promotedOccupant && slot.assistantId === promotedOccupant
                      ? null
                      : slot.assistantId === card.id
                      ? null
                      : slot.assistantId
                }
              };
          } else if (slot && slot.assistantId === card.id) {
            updatedSlots = {
              ...updatedSlots,
              [slot.id]: {
                ...slot,
                assistantId: null
              }
            };
          } else if (slot && slot.attachedCardIds.includes(card.id)) {
            updatedSlots = {
              ...updatedSlots,
              [slot.id]: {
                ...slot,
                attachedCardIds: slot.attachedCardIds.filter((id) => id !== card.id)
              }
            };
          }
        }
        delete updatedCards[card.id];
        updatedLog = appendLog(updatedLog, `${card.name} fades before it can be used.`);
        } else {
          updatedCards = {
            ...updatedCards,
            [card.id]: {
              ...card,
              remainingTurns: remaining
            }
          };
        }
      }

      let nextState: GameState = {
        ...state,
        cycle: state.cycle + 1,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand,
        log: updatedLog
      };

      for (const slot of Object.values(updatedSlots)) {
        if (
          slot.state === 'damaged' &&
          slot.repair &&
          slot.repairStarted &&
          slot.occupantId
        ) {
          const occupant = updatedCards[slot.occupantId];
          if (!occupant || occupant.type !== 'persona') {
            continue;
          }

          const remaining = slot.repair.remaining - 1;
          if (remaining <= 0) {
            const targetTemplate = SLOT_TEMPLATES[slot.repair.targetKey];
            if (targetTemplate) {
              const restoredSlot = instantiateSlot(targetTemplate, slot.id);
              updatedSlots = {
                ...updatedSlots,
                [slot.id]: {
                  ...restoredSlot,
                  occupantId: slot.occupantId,
                  assistantId: null
                }
              };

              let completionLog = `${occupant.name} restores ${restoredSlot.name}, ready for use.`;

              if (slot.repair.targetKey === 'study') {
                const journal = createEmptyJournal();
                const journalCard: CardInstance = { ...journal, location: { area: 'hand' } };
                updatedCards = {
                  ...updatedCards,
                  [journalCard.id]: journalCard
                };
                updatedHand = addToHand(updatedHand, journalCard.id);
                completionLog = `${occupant.name} restores ${restoredSlot.name}, uncovering ${journalCard.name}.`;
              }

              updatedLog = appendLog(updatedLog, completionLog);
            }
          } else {
            updatedSlots = {
              ...updatedSlots,
              [slot.id]: {
                ...slot,
                repair: {
                  ...slot.repair,
                  remaining
                }
              }
            };
            const remainingMs = remaining * SLOT_LOCK_BASE_MS;
            updatedLog = appendLog(
              updatedLog,
              `${occupant.name} makes progress restoring ${slot.name}. ≈ ${formatDurationLabel(remainingMs)} remain.`
            );
          }
        }
      }

      nextState = {
        ...nextState,
        slots: updatedSlots,
        log: updatedLog
      };

      nextState = resolvePendingSlotActions(nextState, now);

      if (Math.random() < 0.65) {
        const spawnResult = spawnOpportunity(nextState, nextState.log);
        nextState = { ...spawnResult.state, log: spawnResult.log };
      }

      return nextState;
    }
    case 'RESOLVE_PENDING_SLOT_ACTIONS': {
      return resolvePendingSlotActions(state, Date.now());
    }
    case 'SET_TIME_SCALE': {
      const nextScale = Math.max(0.25, action.scale);
      if (nextScale === state.timeScale) {
        return state;
      }

      const now = Date.now();
      const adjustedSlots: Record<string, Slot> = {};

      for (const [slotId, slot] of Object.entries(state.slots)) {
        if (slot.lockedUntil && slot.lockedUntil > now) {
          const remaining = slot.lockedUntil - now;
          const baseRemaining = Math.round(remaining * state.timeScale);
          const scaledRemaining = Math.max(0, Math.round(baseRemaining / nextScale));
          adjustedSlots[slotId] = {
            ...slot,
            lockedUntil: scaledRemaining > 0 ? now + scaledRemaining : now
          };
        } else {
          adjustedSlots[slotId] = slot;
        }
      }

      return {
        ...state,
        timeScale: nextScale,
        slots: adjustedSlots
      };
    }
    case 'ACKNOWLEDGE_CARD_REVEAL': {
      const index = state.pendingReveals.indexOf(action.cardId);
      if (index === -1) {
        return state;
      }

      const nextPending = state.pendingReveals.filter((id, idx) => idx !== index);

      return {
        ...state,
        pendingReveals: nextPending
      };
    }
    default:
      return state;
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState);

  const moveCardToSlot = useCallback((cardId: string, slotId: string) => {
    dispatch({ type: 'MOVE_CARD_TO_SLOT', cardId, slotId });
  }, []);

  const recallCard = useCallback((cardId: string) => {
    dispatch({ type: 'RECALL_CARD', cardId });
  }, []);

  const activateSlot = useCallback((slotId: string) => {
    dispatch({ type: 'ACTIVATE_SLOT', slotId });
  }, []);

  const upgradeSlot = useCallback((slotId: string) => {
    dispatch({ type: 'UPGRADE_SLOT', slotId });
  }, []);

  const advanceTime = useCallback(() => {
    dispatch({ type: 'ADVANCE_TIME' });
  }, []);

  const setTimeScale = useCallback((scale: number) => {
    dispatch({ type: 'SET_TIME_SCALE', scale });
  }, []);

  const acknowledgeCardReveal = useCallback((cardId: string) => {
    dispatch({ type: 'ACKNOWLEDGE_CARD_REVEAL', cardId });
  }, []);

  const getUpgradeCost = useCallback(
    (slotId: string) => {
      const slot = state.slots[slotId];
      return slot ? calculateUpgradeCost(slot) : 0;
    },
    [state.slots]
  );

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      moveCardToSlot,
      recallCard,
      activateSlot,
      upgradeSlot,
      advanceTime,
      getUpgradeCost,
      setTimeScale,
      acknowledgeCardReveal
    }),
    [
      state,
      moveCardToSlot,
      recallCard,
      activateSlot,
      upgradeSlot,
      advanceTime,
      getUpgradeCost,
      setTimeScale,
      acknowledgeCardReveal
    ]
  );

  useEffect(() => {
    const pendingSlots = Object.values(state.slots).filter((slot) => slot.pendingAction);
    if (pendingSlots.length === 0) {
      return;
    }

    const now = Date.now();
    let earliestReadyAt = Number.POSITIVE_INFINITY;

    for (const slot of pendingSlots) {
      const readyAt = slot.lockedUntil ?? now;
      if (readyAt < earliestReadyAt) {
        earliestReadyAt = readyAt;
      }
    }

    if (!Number.isFinite(earliestReadyAt)) {
      return;
    }

    if (earliestReadyAt <= now + SLOT_ACTION_COMPLETION_TOLERANCE_MS) {
      dispatch({ type: 'RESOLVE_PENDING_SLOT_ACTIONS' });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({ type: 'RESOLVE_PENDING_SLOT_ACTIONS' });
    }, Math.max(0, earliestReadyAt - now) + SLOT_ACTION_COMPLETION_TOLERANCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [state.slots]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
