import type { SlotBehavior } from './behaviors';

export const hearthBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    if (!slot.occupantId) {
      return {
        state,
        log: utils.appendLog(log, 'The sanctum waits for someone to rest within it.'),
        performed: false
      };
    }

    const card = state.cards[slot.occupantId];
    if (!card || card.type !== 'persona') {
      return {
        state,
        log: utils.appendLog(log, 'Only a living persona can draw the sanctum’s calm.'),
        performed: false
      };
    }

    const loreGain = 1 + Math.floor(slot.level / 2);
    const glimmerGain = slot.level >= 3 ? 1 : 0;

    const nextResources = utils.applyResources(state.resources, {
      lore: loreGain,
      glimmer: glimmerGain
    });

    const fragments = [`${loreGain} lore`];
    if (glimmerGain > 0) {
      fragments.push(`${glimmerGain} glimmer`);
    }

    const nextLog = utils.appendLog(
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
