import { formatDurationLabel } from '../../utils/time';
import { SLOT_LOCK_BASE_MS, SLOT_TEMPLATES } from '../content';
import { GameState, Slot } from '../types';
import { SlotBehavior } from './behaviors';
import { appendLog, instantiateSlot } from './shared';

export const MANOR_ROOM_TEMPLATE_KEYS = [
  'damaged-sanctum',
  'damaged-scriptorium',
  'damaged-archive',
  'damaged-circle',
  'damaged-bedroom'
] as const;

type ManorRoomTemplateKey = (typeof MANOR_ROOM_TEMPLATE_KEYS)[number];

function findMissingManorRooms(state: GameState): ManorRoomTemplateKey[] {
  return MANOR_ROOM_TEMPLATE_KEYS.filter((templateKey) => {
    const template = SLOT_TEMPLATES[templateKey];
    const restoredKey = template.repair ? SLOT_TEMPLATES[template.repair.targetKey].key : null;
    return !Object.values(state.slots).some(
      (existing) => existing.key === template.key || (restoredKey ? existing.key === restoredKey : false)
    );
  });
}

function exploreManor(state: GameState, slot: Slot, log: string[]): { state: GameState; log: string[]; performed: boolean } {
  if (!slot.occupantId) {
    return {
      state,
      log: appendLog(log, 'Send a persona into the manor before attempting to explore it.'),
      performed: false
    };
  }

  const persona = state.cards[slot.occupantId];
  if (!persona || persona.type !== 'persona') {
    return {
      state,
      log: appendLog(log, 'Only a living persona can unveil the manor’s halls.'),
      performed: false
    };
  }

  const missingKeys = findMissingManorRooms(state);
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

function repairManorRoom(state: GameState, slot: Slot, log: string[]): { state: GameState; log: string[]; performed: boolean } {
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

const manorBehavior: SlotBehavior = {
  labels: { activate: 'Explore' },
  activate: ({ state, slot, log }) => {
    if (slot.state === 'damaged' && slot.repair) {
      return repairManorRoom(state, slot, log);
    }
    return exploreManor(state, slot, log);
  },
  getLockDurationMs: ({ slot }) => {
    if (slot.state === 'damaged' && slot.repair) {
      return SLOT_LOCK_BASE_MS * 2;
    }
    return undefined;
  }
};

export function getPendingManorRooms(state: GameState): ManorRoomTemplateKey[] {
  return findMissingManorRooms(state);
}

export function instantiateManorRoom(templateKey: ManorRoomTemplateKey): Slot {
  const template = SLOT_TEMPLATES[templateKey];
  return instantiateSlot(template);
}

export default manorBehavior;
