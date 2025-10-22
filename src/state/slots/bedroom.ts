import type { SlotBehavior, SlotBehaviorUtils } from './behaviors';
import { ensurePersonaOccupant } from './helpers';

const DREAM_TITLES = [
  'Silver Staircases',
  'Echoing Halls',
  'Frosted Lanterns',
  'Lunar Choirs',
  'Velvet Storms',
  'Shattered Constellations'
] as const;

type DreamTitle = (typeof DREAM_TITLES)[number];

function selectDreamTitle(utils: SlotBehaviorUtils): DreamTitle {
  const index = Math.floor(utils.random() * DREAM_TITLES.length);
  return DREAM_TITLES[index];
}

function createDreamCard(utils: SlotBehaviorUtils) {
  const title = selectDreamTitle(utils);
  return utils.createCard({
    key: 'fleeting-dream',
    name: `Fleeting Dream: ${title}`,
    type: 'inspiration',
    description: `A fleeting vision of ${title.toLowerCase()}. Document it before it fades.`,
    traits: ['dream', 'fleeting'],
    permanent: false,
    lifetime: 3,
    ability: {
      onActivate: 'study:dream-record',
      onExpire: 'expire:fading'
    }
  });
}

export const bedroomBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    const occupant = ensurePersonaOccupant(
      { state, slot, log },
      utils,
      {
        message: 'Let a persona rest within the bedroom to invite a dream.',
        invalidMessage: 'Only a persona may slumber deeply enough to dream here.'
      }
    );
    if ('result' in occupant) {
      return occupant.result;
    }

    const persona = occupant.card;

    const dream = createDreamCard(utils);
    const stagedDream = { ...dream, location: { area: 'lost' } };

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

    const nextLog = utils.appendLog(
      log,
      `${persona.name} slumbers in ${slot.name}. A dream will surface when their rest concludes.`
    );

    return { state: nextState, log: nextLog, performed: true };
  }
};
