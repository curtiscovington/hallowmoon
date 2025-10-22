import { formatDurationLabel } from '../../utils/time';
import { SLOT_LOCK_BASE_MS, SLOT_TEMPLATES } from '../content';
import type { GameState, LocationTag, Slot } from '../types';
import type { SlotBehavior, SlotBehaviorUtils } from './behaviors';
import { ensurePersonaOccupant } from './helpers';

interface LocationMessages {
  start: (personaName: string, slotName: string) => string;
  alreadyExploring: (personaName: string, slotName: string) => string;
  nothingToFind: (slotName: string) => string;
  reveal: (context: {
    personaName: string;
    slotName: string;
    revealed: string[];
    remainingDiscoveries: number;
    removeSlot: boolean;
  }) => string;
  nothingFound: (personaName: string, slotName: string) => string;
}

interface LocationDefinition {
  key: LocationTag;
  discoverableTemplateKeys: readonly string[];
  removeWhenComplete: boolean;
  allowExplorationWhenExhausted: boolean;
  messages: LocationMessages;
}

const DEFAULT_MESSAGES: LocationMessages = {
  start: (personaName, slotName) =>
    `${personaName} ventures into ${slotName}, scouting for new opportunities. They will report back soon.`,
  alreadyExploring: (personaName, slotName) => `${personaName} is already scouting ${slotName}.`,
  nothingToFind: (slotName) => `${slotName} holds no new opportunities for now.`,
  reveal: ({ personaName, slotName, revealed, remainingDiscoveries }) => {
    const fragment = revealed.join(', ');
    const suffix = remainingDiscoveries > 0 ? 'More leads await discovery.' : 'The site is fully charted.';
    return `${personaName} explores ${slotName}, revealing ${fragment}. ${suffix}`;
  },
  nothingFound: (personaName, slotName) => `${personaName} finds nothing new within ${slotName}.`
};

function manorMessages(): LocationMessages {
  return {
    start: (personaName, slotName) =>
      `${personaName} ventures deeper into ${slotName}, mapping its passages. They will report back soon.`,
    alreadyExploring: (personaName) => `${personaName} is already charting the manor’s halls.`,
    nothingToFind: () => 'The manor is quiet for now; every discovered room awaits restoration.',
    reveal: ({ personaName, revealed, removeSlot }) => {
      const fragment = revealed.join(', ');
      return removeSlot
        ? `${personaName} charts the manor’s halls, revealing ${fragment} before the manor’s entrance seals behind them.`
        : `${personaName} charts the manor’s halls, revealing ${fragment}. More ruined chambers await discovery.`;
    },
    nothingFound: (personaName) =>
      `${personaName} finds no further chambers awaiting discovery as the manor’s entrance seals behind them.`
  };
}

function townMessages(): LocationMessages {
  return {
    ...DEFAULT_MESSAGES,
    reveal: ({ personaName, slotName, revealed, remainingDiscoveries }) => {
      const fragment = revealed.join(', ');
      if (remainingDiscoveries > 0) {
        return `${personaName} surveys ${slotName}, establishing access to ${fragment}. The streets whisper of more locales.`;
      }
      return `${personaName} surveys ${slotName}, establishing access to ${fragment}. The town’s paths feel familiar now.`;
    }
  };
}

function forestMessages(): LocationMessages {
  return {
    ...DEFAULT_MESSAGES,
    start: (personaName, slotName) =>
      `${personaName} slips into ${slotName}, following moonlit trails in search of hidden clearings.`,
    nothingToFind: (slotName) => `${slotName} keeps its secrets tonight. Perhaps future scouts will have better luck.`,
    nothingFound: (personaName, slotName) =>
      `${personaName} returns from ${slotName} empty-handed. The wilds reveal nothing new for now.`
  };
}

export const LOCATION_KEYS = ['manor', 'town', 'forest'] as const;

export const LOCATION_DEFINITIONS: Record<LocationTag, LocationDefinition> = {
  manor: {
    key: 'manor',
    discoverableTemplateKeys: [
      'damaged-sanctum',
      'damaged-scriptorium',
      'damaged-archive',
      'damaged-circle',
      'damaged-bedroom'
    ],
    removeWhenComplete: true,
    allowExplorationWhenExhausted: false,
    messages: manorMessages()
  },
  town: {
    key: 'town',
    discoverableTemplateKeys: ['town-chapel', 'town-market'],
    removeWhenComplete: false,
    allowExplorationWhenExhausted: true,
    messages: townMessages()
  },
  forest: {
    key: 'forest',
    discoverableTemplateKeys: [],
    removeWhenComplete: false,
    allowExplorationWhenExhausted: true,
    messages: forestMessages()
  }
};

function getDefinition(location: LocationTag | null): LocationDefinition | null {
  if (!location) {
    return null;
  }
  return LOCATION_DEFINITIONS[location] ?? null;
}

export function getMissingLocationTemplateKeys(
  state: GameState,
  location: LocationTag
): string[] {
  const definition = LOCATION_DEFINITIONS[location];
  if (!definition) {
    return [];
  }

  return definition.discoverableTemplateKeys.filter((templateKey) => {
    const template = SLOT_TEMPLATES[templateKey];
    if (!template) {
      return false;
    }
    const repaired = template.repair ? SLOT_TEMPLATES[template.repair.targetKey] : null;
    const restoredKey = repaired?.key ?? null;

    return !Object.values(state.slots).some(
      (existing) => existing.key === template.key || (restoredKey ? existing.key === restoredKey : false)
    );
  });
}

function exploreLocation(state: GameState, slot: Slot, log: string[], utils: SlotBehaviorUtils) {
  const occupant = ensurePersonaOccupant(
    { state, slot, log },
    utils,
    {
      message: 'Send a persona to scout this location before attempting to explore it.',
      invalidMessage: 'Only a living persona can brave this territory.'
    }
  );
  if ('result' in occupant) {
    return occupant.result;
  }

  const persona = occupant.card;
  const definition = getDefinition(slot.location);

  if (!definition) {
    return {
      state,
      log: utils.appendLog(log, `${slot.name} cannot be explored right now.`),
      performed: false
    };
  }

  const missingKeys = getMissingLocationTemplateKeys(state, definition.key);
  if (missingKeys.length === 0 && !definition.allowExplorationWhenExhausted) {
    return {
      state,
      log: utils.appendLog(log, definition.messages.nothingToFind(slot.name)),
      performed: false
    };
  }

  if (slot.pendingAction) {
    return {
      state,
      log: utils.appendLog(log, definition.messages.alreadyExploring(persona.name, slot.name)),
      performed: false
    };
  }

  const updatedSlots: GameState['slots'] = {
    ...state.slots,
    [slot.id]: {
      ...slot,
      pendingAction: { type: 'explore-location', location: definition.key }
    }
  };

  const nextLog = utils.appendLog(log, definition.messages.start(persona.name, slot.name));

  return {
    state: {
      ...state,
      slots: updatedSlots
    },
    log: nextLog,
    performed: true
  };
}

function repairLocationSite(state: GameState, slot: Slot, log: string[], utils: SlotBehaviorUtils) {
  if (!slot.repair) {
    return { state, log, performed: false };
  }

  const occupant = ensurePersonaOccupant(
    { state, slot, log },
    utils,
    {
      message: 'Assign a persona to clear the debris from this room.',
      invalidMessage: 'A persona must brave the dust and cobwebs to restore the room.'
    }
  );
  if ('result' in occupant) {
    return occupant.result;
  }

  const persona = occupant.card;

  const remainingMs = slot.repair.remaining * SLOT_LOCK_BASE_MS;
  const message = slot.repairStarted
    ? `${persona.name} continues restoring ${slot.name}. ≈ ${formatDurationLabel(remainingMs)} remain.`
    : `${persona.name} begins restoring ${slot.name}. ≈ ${formatDurationLabel(remainingMs)} remain.`;

  if (slot.repairStarted) {
    return { state, log: utils.appendLog(log, message), performed: false };
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
    log: utils.appendLog(log, message),
    performed: true
  };
}

export const locationBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    if (slot.state === 'damaged' && slot.repair) {
      return repairLocationSite(state, slot, log, utils);
    }

    return exploreLocation(state, slot, log, utils);
  }
};
