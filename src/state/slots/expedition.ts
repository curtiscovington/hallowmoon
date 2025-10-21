import type { SlotBehavior } from './behaviors';

export const expeditionBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    if (!slot.occupantId) {
      return {
        state,
        log: utils.appendLog(log, 'A daring persona must step through the Umbral Gate.'),
        performed: false
      };
    }

    const card = state.cards[slot.occupantId];
    if (!card || card.type !== 'persona') {
      return {
        state,
        log: utils.appendLog(log, 'Only your persona can brave the Umbral Gate.'),
        performed: false
      };
    }

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

    let nextState = {
      ...state,
      resources: utils.applyResources(state.resources, {
        glimmer: -glimmerCost,
        coin: coinGain,
        lore: loreGain
      })
    };

    let nextLog = utils.appendLog(
      log,
      `${card.name} ventures beyond the Umbral Gate, returning with ${coinGain} coin and ${loreGain} lore.`
    );

    if (utils.random() < 0.5) {
      const { state: spawnedState, log: spawnedLog } = utils.spawnOpportunity(nextState, nextLog);
      nextState = spawnedState;
      nextLog = spawnedLog;
    }

    return { state: nextState, log: nextLog, performed: true };
  }
};
