import { SLOT_TEMPLATES } from '../content';
import { resolveAbilityKey, resolveCardAbility } from '../cards/abilities';
import { DiscoverySeed, GameState, Slot } from '../types';
import { now } from '../runtime';
import { SlotBehavior } from './behaviors';
import { appendLog, applyResources, instantiateSlot, removeFromHand } from './shared';
import { augmentJournalWithDream, createJournalFromDream, extractDreamTitle, isJournalCard } from './dreams';

function maybeUnlockExpeditionSlot(state: GameState): GameState {
  const hasSlot = Object.values(state.slots).some((entry) => entry.type === 'expedition');
  if (hasSlot) {
    return state;
  }

  const discovery = state.discoveries.find((entry) => entry.key === 'umbral-gate');
  if (!discovery) {
    return state;
  }

  const expeditionTemplate = SLOT_TEMPLATES.expedition;
  const expeditionSlot = instantiateSlot(expeditionTemplate);
  const updatedSlots = {
    ...state.slots,
    [expeditionSlot.id]: expeditionSlot
  };

  return {
    ...state,
    slots: updatedSlots,
    log: appendLog(state.log, 'The Umbral Gate yawns open, offering expeditions into the Hollow Ways.')
  };
}

function applyDiscovery(state: GameState, seed: DiscoverySeed): GameState {
  const alreadyKnown = state.discoveries.some((entry) => entry.key === seed.key);
  if (alreadyKnown) {
    return state;
  }

  const discovery = {
    id: `${seed.key}-${now().toString(36)}`,
    key: seed.key,
    name: seed.name,
    description: seed.description,
    cycle: state.cycle
  };

  const updatedState: GameState = {
    ...state,
    discoveries: [discovery, ...state.discoveries],
    log: appendLog(state.log, `Discovery gained: ${seed.name}. ${seed.description}`)
  };

  return maybeUnlockExpeditionSlot(updatedState);
}

const studyBehavior: SlotBehavior = {
  labels: { activate: 'Study' },
  activate: ({ state, slot, log }) => {
    if (!slot.occupantId) {
      return {
        state,
        log: appendLog(log, 'Place a card upon the Night Archive to study it.'),
        performed: false
      };
    }

    const card = state.cards[slot.occupantId];
    if (!card) {
      return { state, log, performed: false };
    }

    const assistant = slot.assistantId ? state.cards[slot.assistantId] ?? null : null;
    const attachmentCards = slot.attachedCardIds
      .map((id) => state.cards[id])
      .filter((attached): attached is NonNullable<typeof attached> => Boolean(attached));

    const occupantAbility = resolveCardAbility(card);
    const assistantAbility = assistant ? resolveCardAbility(assistant) : null;

    if (
      occupantAbility.onActivate === 'study:dream-record' &&
      assistant &&
      assistantAbility?.onAssist === 'assist:persona'
    ) {
      const existingJournal = attachmentCards.find(
        (attached) => resolveAbilityKey(attached, 'onAssist') === 'assist:journal'
      );
      const updatedCards = { ...state.cards };
      delete updatedCards[card.id];

      const stagedIds: string[] = [];
      let nextLog = log;

      if (existingJournal) {
        const augmented = augmentJournalWithDream(existingJournal, extractDreamTitle(card) || card.name);
        updatedCards[existingJournal.id] = { ...augmented, location: { area: 'lost' } };
        stagedIds.push(existingJournal.id);
        nextLog = appendLog(
          log,
          `${assistant.name} expands ${existingJournal.name} with ${card.name}. The entry will be ready once the study concludes.`
        );
      } else {
        const journal = createJournalFromDream(card);
        const journalCard = { ...journal, location: { area: 'lost' as const } };
        updatedCards[journalCard.id] = journalCard;
        stagedIds.push(journalCard.id);
        nextLog = appendLog(
          log,
          `${assistant.name} records ${card.name}, preserving it within ${journalCard.name}. The entry will be ready once the study concludes.`
        );
      }

      const cleanedAttachments = slot.attachedCardIds.filter((id) => {
        if (existingJournal && id === existingJournal.id) {
          return false;
        }
        return true;
      });

      const updatedSlots = {
        ...state.slots,
        [slot.id]: {
          ...slot,
          occupantId: assistant.id,
          assistantId: null,
          attachedCardIds: cleanedAttachments,
          pendingAction: {
            type: 'deliver-cards',
            cardIds: stagedIds,
            reveal: true
          }
        }
      };

      const updatedHand = removeFromHand(state.hand, card.id);

      return {
        state: {
          ...state,
          cards: {
            ...updatedCards,
            [assistant.id]: { ...assistant, location: { area: 'slot', slotId: slot.id } }
          },
          slots: updatedSlots,
          hand: updatedHand
        },
        log: nextLog,
        performed: true
      };
    }

    if (card.type === 'persona') {
      const loreGain = 1;
      const nextResources = applyResources(state.resources, { lore: loreGain });
      return {
        state: {
          ...state,
          resources: nextResources
        },
        log: appendLog(log, `${card.name} reflects upon their path, gaining ${loreGain} lore.`),
        performed: true
      };
    }

    let nextState: GameState = { ...state };
    let nextLog = log;

    if (card.rewards?.resources) {
      nextState = {
        ...nextState,
        resources: applyResources(nextState.resources, card.rewards.resources)
      };
      const fragments = Object.entries(card.rewards.resources)
        .map(([key, value]) => `${value} ${key}`)
        .join(' and ');
      nextLog = appendLog(nextLog, `${card.name} is deciphered, yielding ${fragments}.`);
    } else {
      nextLog = appendLog(nextLog, `${card.name} reveals little before dissolving.`);
    }

    if (card.rewards?.discovery) {
      nextState = applyDiscovery(nextState, card.rewards.discovery);
      nextLog = nextState.log;
    }

    const updatedSlots = {
      ...nextState.slots,
      [slot.id]: {
        ...slot,
        occupantId: null,
        assistantId: null,
        attachedCardIds: []
      }
    };

    const updatedCards = { ...nextState.cards };
    delete updatedCards[card.id];

    return {
      state: {
        ...nextState,
        slots: updatedSlots,
        cards: updatedCards,
        hand: removeFromHand(nextState.hand, card.id)
      },
      log: nextLog,
      performed: true
    };
  },
  acceptsCard: ({ card, slot }) => {
    if (slot.assistantId && slot.assistantId === card.id) {
      return false;
    }
    if (isJournalCard(card)) {
      return true;
    }
    return true;
  }
};

export default studyBehavior;
