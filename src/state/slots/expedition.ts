import type { SlotBehavior } from './behaviors';
import { ensurePersonaOccupant, formatResourceDelta } from './helpers';

export const expeditionBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    const occupant = ensurePersonaOccupant(
      { state, slot, log },
      utils,
      {
        message: 'A daring persona must step through the Umbral Gate.',
        invalidMessage: 'Only your persona can brave the Umbral Gate.'
      }
    );
    if ('result' in occupant) {
      return occupant.result;
    }

    const card = occupant.card;

    const glimmerCost = 1;
    if (state.resources.glimmer < glimmerCost) {
      return {
        state,
        log: utils.appendLog(log, 'At least 1 glimmer is needed to light the path beyond the gate.'),
        performed: false
      };
    }

    const coinGain = 1 + slot.level;
    const loreGain = 2 + slot.level;
    const resourceDelta = { glimmer: -glimmerCost, coin: coinGain, lore: loreGain } as const;

    let nextState = {
      ...state,
      resources: utils.applyResources(state.resources, resourceDelta)
    };

    const gainSummary = formatResourceDelta({ coin: coinGain, lore: loreGain });

    let nextLog = utils.appendLog(
      log,
      `${card.name} ventures beyond the Umbral Gate, returning with ${gainSummary}.`
    );

    if (utils.random() < 0.5) {
      const { state: spawnedState, log: spawnedLog } = utils.spawnOpportunity(nextState, nextLog);
      nextState = spawnedState;
      nextLog = spawnedLog;
    }

    return { state: nextState, log: nextLog, performed: true };
  }
};
