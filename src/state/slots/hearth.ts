import type { SlotBehavior } from './behaviors';
import { ensurePersonaOccupant, formatResourceDelta } from './helpers';

export const hearthBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    const occupant = ensurePersonaOccupant(
      { state, slot, log },
      utils,
      {
        message: 'The sanctum waits for someone to rest within it.',
        invalidMessage: 'Only a living persona can draw the sanctum’s calm.'
      }
    );
    if ('result' in occupant) {
      return occupant.result;
    }

    const card = occupant.card;

    const loreGain = 1 + Math.floor(slot.level / 2);
    const glimmerGain = slot.level >= 3 ? 1 : 0;
    const resourceDelta = {
      lore: loreGain,
      glimmer: glimmerGain
    } as const;

    const nextResources = utils.applyResources(state.resources, resourceDelta);
    const gainSummary = formatResourceDelta(resourceDelta);

    const nextLog = utils.appendLog(
      log,
      `${card.name} communes with the Veiled Sanctum, gaining ${gainSummary}.`
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
};
