import type { SlotBehavior } from './behaviors';

export const workBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    if (!slot.occupantId) {
      return {
        state,
        log: utils.appendLog(log, 'Assign your persona to the job before attempting to work it.'),
        performed: false
      };
    }

    const card = state.cards[slot.occupantId];
    if (!card || card.type !== 'persona') {
      return {
        state,
        log: utils.appendLog(log, 'Only a persona can interpret the ledgers of the scriptorium.'),
        performed: false
      };
    }

    const coinGain = 2 + slot.level;
    const loreGain = slot.level >= 2 ? 1 : 0;
    const nextResources = utils.applyResources(state.resources, {
      coin: coinGain,
      lore: loreGain
    });

    const nextLog = utils.appendLog(
      log,
      `${card.name} works the Moonlit Scriptorium, earning ${coinGain} coin${
        loreGain > 0 ? ` and ${loreGain} lore` : ''
      }.`
    );

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
