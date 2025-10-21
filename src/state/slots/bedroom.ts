import { CardInstance } from '../types';
import { SlotBehavior } from './behaviors';
import { appendLog } from './shared';
import { createDreamCard } from './dreams';

const bedroomBehavior: SlotBehavior = {
  labels: { activate: 'Slumber' },
  activate: ({ state, slot, log }) => {
    if (!slot.occupantId) {
      return {
        state,
        log: appendLog(log, 'Let a persona rest within the bedroom to invite a dream.'),
        performed: false
      };
    }

    const persona = state.cards[slot.occupantId];
    if (!persona || persona.type !== 'persona') {
      return {
        state,
        log: appendLog(log, 'Only a persona may slumber deeply enough to dream here.'),
        performed: false
      };
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

    const nextState = {
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
};

export default bedroomBehavior;
