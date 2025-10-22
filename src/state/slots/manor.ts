import { formatDurationLabel } from '../../utils/time';
import { SLOT_LOCK_BASE_MS, SLOT_TEMPLATES } from '../content';
import type { GameState, Slot } from '../types';
import type { SlotBehavior, SlotBehaviorUtils } from './behaviors';
import { ensurePersonaOccupant } from './helpers';

export const MANOR_ROOM_TEMPLATE_KEYS = [
  'damaged-sanctum',
  'damaged-scriptorium',
  'damaged-archive',
  'damaged-circle',
  'damaged-bedroom'
] as const;

type ManorRoomTemplateKey = (typeof MANOR_ROOM_TEMPLATE_KEYS)[number];

function findMissingManorKeys(state: GameState): ManorRoomTemplateKey[] {
  return MANOR_ROOM_TEMPLATE_KEYS.filter((templateKey) => {
    const template = SLOT_TEMPLATES[templateKey];
    const restoredKey = template.repair ? SLOT_TEMPLATES[template.repair.targetKey].key : null;
    return !Object.values(state.slots).some(
      (existing) => existing.key === template.key || (restoredKey ? existing.key === restoredKey : false)
    );
  });
}

function exploreManor(state: GameState, slot: Slot, log: string[], utils: SlotBehaviorUtils) {
  const occupant = ensurePersonaOccupant(
    { state, slot, log },
    utils,
    {
      message: 'Send a persona into the manor before attempting to explore it.',
      invalidMessage: 'Only a living persona can unveil the manor’s halls.'
    }
  );
  if ('result' in occupant) {
    return occupant.result;
  }

  const persona = occupant.card;

  const missingKeys = findMissingManorKeys(state);
  if (missingKeys.length === 0) {
    return {
      state,
      log: utils.appendLog(log, 'The manor is quiet for now; every discovered room awaits restoration.'),
      performed: false
    };
  }

  if (slot.pendingAction) {
    return {
      state,
      log: utils.appendLog(log, `${persona.name} is already charting the manor’s halls.`),
      performed: false
    };
  }

  const updatedSlots: GameState['slots'] = {
    ...state.slots,
    [slot.id]: {
      ...slot,
      pendingAction: { type: 'explore-manor' }
    }
  };

  const nextLog = utils.appendLog(
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

function repairManorRoom(state: GameState, slot: Slot, log: string[], utils: SlotBehaviorUtils) {
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

export const manorBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    if (slot.state === 'damaged' && slot.repair) {
      return repairManorRoom(state, slot, log, utils);
    }

    return exploreManor(state, slot, log, utils);
  }
};
