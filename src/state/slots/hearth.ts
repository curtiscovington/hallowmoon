import { SlotBehavior } from './behaviors';
import { appendLog, applyResources } from './shared';

const hearthBehavior: SlotBehavior = {
  labels: { activate: 'Commune' },
  activate: ({ state, slot, log }) => {
    if (!slot.occupantId) {
      return {
        state,
        log: appendLog(log, 'The sanctum waits for someone to rest within it.'),
        performed: false
      };
    }

    const card = state.cards[slot.occupantId];
    if (!card || card.type !== 'persona') {
      return {
        state,
        log: appendLog(log, 'Only a living persona can draw the sanctum’s calm.'),
        performed: false
      };
    }

    const loreGain = 1 + Math.floor(slot.level / 2);
    const glimmerGain = slot.level >= 3 ? 1 : 0;

    const nextResources = applyResources(state.resources, {
      lore: loreGain,
      glimmer: glimmerGain
    });

    const fragments = [`${loreGain} lore`];
    if (glimmerGain > 0) {
      fragments.push(`${glimmerGain} glimmer`);
    }

    const nextLog = appendLog(
      log,
      `${card.name} communes with the Veiled Sanctum, gaining ${fragments.join(' and ')}.`
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

export default hearthBehavior;
