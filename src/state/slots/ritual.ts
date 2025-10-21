import { SlotBehavior } from './behaviors';
import { appendLog, applyResources, spawnOpportunity } from './shared';

const ritualBehavior: SlotBehavior = {
  labels: { activate: 'Conduct Ritual' },
  activate: ({ state, slot, log, context }) => {
    if (!slot.occupantId) {
      return {
        state,
        log: appendLog(log, 'Seat your persona within the circle to conduct a rite.'),
        performed: false
      };
    }

    const card = state.cards[slot.occupantId];
    if (!card || card.type !== 'persona') {
      return {
        state,
        log: appendLog(log, 'A living persona must anchor the ritual.'),
        performed: false
      };
    }

    const loreCost = Math.max(2, 2 + slot.level - 1);
    if (state.resources.lore < loreCost) {
      return {
        state,
        log: appendLog(log, `You require ${loreCost} lore to empower the ritual.`),
        performed: false
      };
    }

    const glimmerGain = 1 + Math.floor(slot.level / 2);
    const nextResources = applyResources(state.resources, {
      lore: -loreCost,
      glimmer: glimmerGain
    });

    const nextLog = appendLog(
      log,
      `${card.name} completes a rite, converting ${loreCost} lore into ${glimmerGain} glimmer.`
    );

    if (context.random() < 0.35) {
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

export default ritualBehavior;
