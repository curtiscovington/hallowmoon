import { SlotBehavior } from './behaviors';
import { appendLog, applyResources, spawnOpportunity } from './shared';

const workBehavior: SlotBehavior = {
  labels: { activate: 'Work Shift' },
  activate: ({ state, slot, log, context }) => {
    if (!slot.occupantId) {
      return {
        state,
        log: appendLog(log, 'Assign your persona to the job before attempting to work it.'),
        performed: false
      };
    }

    const card = state.cards[slot.occupantId];
    if (!card || card.type !== 'persona') {
      return {
        state,
        log: appendLog(log, 'Only a persona can interpret the ledgers of the scriptorium.'),
        performed: false
      };
    }

    const coinGain = 2 + slot.level;
    const loreGain = slot.level >= 2 ? 1 : 0;
    const nextResources = applyResources(state.resources, {
      coin: coinGain,
      lore: loreGain
    });

    const nextLog = appendLog(
      log,
      `${card.name} works the Moonlit Scriptorium, earning ${coinGain} coin${
        loreGain > 0 ? ` and ${loreGain} lore` : ''
      }.`
    );

    if (context.random() < 0.4) {
      const { state: spawnedState, log: spawnedLog } = spawnOpportunity(
        { ...state, resources: nextResources },
        nextLog,
        context.random
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

export default workBehavior;
