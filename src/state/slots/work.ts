import type { SlotBehavior } from './behaviors';
import { ensurePersonaOccupant, formatResourceDelta } from './helpers';

export const workBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    const occupant = ensurePersonaOccupant(
      { state, slot, log },
      utils,
      {
        message: 'Assign your persona to the job before attempting to work it.',
        invalidMessage: 'Only a persona can interpret the ledgers of the scriptorium.'
      }
    );
    if ('result' in occupant) {
      return occupant.result;
    }

    const card = occupant.card;

    const coinGain = 2 + slot.level;
    const loreGain = slot.level >= 2 ? 1 : 0;
    const resourceDelta = { coin: coinGain, lore: loreGain } as const;
    const nextResources = utils.applyResources(state.resources, resourceDelta);
    const summary = formatResourceDelta(resourceDelta);

    const nextLog = utils.appendLog(log, `${card.name} works the Moonlit Scriptorium, earning ${summary}.`);

    if (utils.random() < 0.4) {
      const { state: spawnedState, log: spawnedLog } = utils.spawnOpportunity(
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
};
