import React, { useCallback, useContext, useMemo, useReducer } from 'react';
import {
  CardInstance,
  CardReward,
  Discovery,
  DiscoverySeed,
  GameState,
  Resources,
  Slot,
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
}

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

function instantiateSlot(template: SlotTemplate): Slot {
  return {
    id: `slot-${template.key}`,
    key: template.key,
    name: template.name,
    type: template.type,
    description: template.description,
    level: 1,
    upgradeCost: template.upgradeCost,
    traits: [...template.traits],
    accepted: template.accepted,
    occupantId: null,
    unlocked: true
  };
}

function baseResources(): Resources {
  return { coin: 0, lore: 0, glimmer: 1 };
}

function initialState(): GameState {
  const hero = instantiateCard(HERO_TEMPLATE);
  const whisper = instantiateCard(OPPORTUNITY_TEMPLATES[0]);
  const slots: Record<string, Slot> = {};
  const hearthSlot = instantiateSlot(SLOT_TEMPLATES.hearth);
  const workSlot = instantiateSlot(SLOT_TEMPLATES.work);
  const studySlot = instantiateSlot(SLOT_TEMPLATES.study);
  const ritualSlot = instantiateSlot(SLOT_TEMPLATES.ritual);

  slots[hearthSlot.id] = hearthSlot;
  slots[workSlot.id] = workSlot;
  slots[studySlot.id] = studySlot;
  slots[ritualSlot.id] = ritualSlot;

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
      'You awaken within the Veiled Sanctum. The cult expects a new tale of moonlit ambition.'
    ],
    discoveries: []
  };
}

type Action =
  | { type: 'MOVE_CARD_TO_SLOT'; cardId: string; slotId: string }
  | { type: 'RECALL_CARD'; cardId: string }
  | { type: 'ACTIVATE_SLOT'; slotId: string }
  | { type: 'UPGRADE_SLOT'; slotId: string }
  | { type: 'ADVANCE_TIME' };

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

function workHearth(state: GameState, slot: Slot, log: string[]): { state: GameState; log: string[] } {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'The sanctum waits for someone to rest within it.') };
  }

  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'Only a living persona can draw the sanctum’s calm.')
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
    log: nextLog
  };
}

function workJob(state: GameState, slot: Slot, log: string[]): { state: GameState; log: string[] } {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'Assign your persona to the job before attempting to work it.') };
  }
  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'Only a persona can interpret the ledgers of the scriptorium.')
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
    return { state: spawnedState, log: spawnedLog };
  }

  return {
    state: {
      ...state,
      resources: nextResources
    },
    log: nextLog
  };
}

function studySlot(state: GameState, slot: Slot, log: string[]): { state: GameState; log: string[] } {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'Place a card upon the Night Archive to study it.') };
  }

  const card = state.cards[slot.occupantId];
  if (!card) {
    return { state, log };
  }

  if (card.type === 'persona') {
    const loreGain = 1;
    const nextResources = applyResources(state.resources, { lore: loreGain });
    return {
      state: {
        ...state,
        resources: nextResources
      },
      log: appendLog(log, `${card.name} reflects upon their path, gaining ${loreGain} lore.`)
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
      occupantId: null
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
    log: nextLog
  };
}

function ritualSlot(state: GameState, slot: Slot, log: string[]): { state: GameState; log: string[] } {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'Seat your persona within the circle to conduct a rite.') };
  }
  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'A living persona must anchor the ritual.')
    };
  }

  const loreCost = Math.max(2, 2 + slot.level - 1);
  if (state.resources.lore < loreCost) {
    return {
      state,
      log: appendLog(log, `You require ${loreCost} lore to empower the ritual.`)
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
    return { state: spawnedState, log: spawnedLog };
  }

  return {
    state: {
      ...state,
      resources: nextResources
    },
    log: nextLog
  };
}

function expeditionSlot(state: GameState, slot: Slot, log: string[]): { state: GameState; log: string[] } {
  if (!slot.occupantId) {
    return { state, log: appendLog(log, 'A daring persona must step through the Umbral Gate.') };
  }
  const card = state.cards[slot.occupantId];
  if (!card || card.type !== 'persona') {
    return { state, log: appendLog(log, 'Only your persona can brave the Umbral Gate.') };
  }

  const glimmerCost = 1;
  if (state.resources.glimmer < glimmerCost) {
    return {
      state,
      log: appendLog(log, 'At least 1 glimmer is needed to light the path beyond the gate.')
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

  return { state: nextState, log: nextLog };
}

function activateSlot(state: GameState, slotId: string): { state: GameState; log: string[] } {
  const slot = state.slots[slotId];
  if (!slot || !slot.unlocked) {
    return { state, log: appendLog(state.log, 'That slot is not yet available.') };
  }

  const log = state.log;

  switch (slot.type) {
    case 'hearth':
      return workHearth(state, slot, log);
    case 'work':
      return workJob(state, slot, log);
    case 'study':
      return studySlot(state, slot, log);
    case 'ritual':
      return ritualSlot(state, slot, log);
    case 'expedition':
      return expeditionSlot(state, slot, log);
    default:
      return { state, log };
  }
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
          updatedSlots[previousSlot.id] = {
            ...previousSlot,
            occupantId: null
          };
        }
      }

      if (slot.occupantId && slot.occupantId !== card.id) {
        const displaced = updatedCards[slot.occupantId];
        if (displaced) {
          updatedCards = {
            ...updatedCards,
            [displaced.id]: {
              ...displaced,
              location: { area: 'hand' }
            },
            [card.id]: { ...card, location: { area: 'slot', slotId: slot.id } }
          };
          updatedHand = addToHand(updatedHand, displaced.id);
        }
      } else {
        updatedCards = {
          ...updatedCards,
          [card.id]: {
            ...card,
            location: { area: 'slot', slotId: slot.id }
          }
        };
      }

      updatedSlots[slot.id] = {
        ...slot,
        occupantId: card.id
      };

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

      let updatedSlots = state.slots;
      if (card.location.area === 'slot') {
        const slot = state.slots[card.location.slotId];
        if (slot) {
          updatedSlots = {
            ...state.slots,
            [slot.id]: { ...slot, occupantId: null }
          };
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
      let updatedCards = { ...state.cards };
      let updatedSlots = { ...state.slots };
      let updatedHand = [...state.hand];
      let updatedLog = appendLog(state.log, `The candle gutters as cycle ${state.cycle + 1} begins.`);

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
              updatedSlots = {
                ...updatedSlots,
                [slot.id]: { ...slot, occupantId: null }
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

      if (Math.random() < 0.65) {
        const spawnResult = spawnOpportunity(nextState, nextState.log);
        nextState = { ...spawnResult.state, log: spawnResult.log };
      }

      return nextState;
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
      getUpgradeCost
    }),
    [state, moveCardToSlot, recallCard, activateSlot, upgradeSlot, advanceTime, getUpgradeCost]
  );

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
