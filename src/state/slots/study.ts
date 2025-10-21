import { resolveAbilityKey, resolveCardAbility } from '../cards/abilities';
import type { CardInstance, GameState, Slot } from '../types';
import type { SlotBehavior, SlotBehaviorUtils } from './behaviors';
import { JOURNAL_CARD_NAME, extractDreamTitle } from './dreams';

function extractJournalDreams(journal: CardInstance): string[] {
  return journal.traits
    .filter((trait) => trait.startsWith('dream:'))
    .map((trait) => trait.slice('dream:'.length));
}

function formatJournalDescription(entries: string[]): string {
  if (entries.length === 0) {
    return 'Blank pages await recorded dreams.';
  }
  if (entries.length === 1) {
    return `Pages capture the dream of ${entries[0]}.`;
  }
  if (entries.length === 2) {
    return `Entries chronicle the dreams of ${entries[0]} and ${entries[1]}.`;
  }

  const rest = entries.slice(0, -1).join(', ');
  const last = entries[entries.length - 1];
  return `Entries chronicle the dreams of ${rest}, and ${last}.`;
}

function describeJournal(entries: string[]): string {
  return `A bound journal cataloguing lucid recollections. ${formatJournalDescription(entries)}`;
}

function normalizeJournalTraits(journal: CardInstance, entries: string[]): string[] {
  const baseTraits = journal.traits.filter((trait) => !trait.startsWith('dream:'));
  const dedupedBase = Array.from(new Set(baseTraits.filter((trait) => trait !== 'journal' && trait !== 'dream-record')));
  const dreamTraits = entries.map((entry) => `dream:${entry}`);
  return [...dedupedBase, 'journal', 'dream-record', ...dreamTraits];
}

function applyJournalEntries(journal: CardInstance, entries: string[]): CardInstance {
  return {
    ...journal,
    name: JOURNAL_CARD_NAME,
    description: describeJournal(entries),
    traits: normalizeJournalTraits(journal, entries),
    permanent: true,
    remainingTurns: null,
    ability: journal.ability ?? { onAssist: 'assist:journal' }
  };
}

function augmentJournalWithDream(journal: CardInstance, dreamTitle: string): CardInstance {
  const existingEntries = extractJournalDreams(journal);
  const hasEntry = existingEntries.includes(dreamTitle);
  const updatedEntries = hasEntry ? existingEntries : [...existingEntries, dreamTitle];
  return applyJournalEntries(journal, updatedEntries);
}

function createEmptyJournal(utils: SlotBehaviorUtils): CardInstance {
  const template = {
    key: 'private-journal',
    name: JOURNAL_CARD_NAME,
    type: 'inspiration',
    description: describeJournal([]),
    traits: ['journal', 'dream-record'],
    permanent: true,
    ability: {
      onAssist: 'assist:journal'
    }
  } as const;
  const journal = utils.createCard(template);
  return applyJournalEntries(journal, []);
}

function createJournalFromDream(dream: CardInstance, utils: SlotBehaviorUtils): CardInstance {
  const journal = createEmptyJournal(utils);
  return augmentJournalWithDream(journal, extractDreamTitle(dream) || dream.name);
}

function handleDreamRecording(
  state: GameState,
  slot: Slot,
  occupant: CardInstance,
  assistant: CardInstance,
  attachments: CardInstance[],
  log: string[],
  utils: SlotBehaviorUtils
) {
  const existingJournal = attachments.find(
    (attached) => resolveAbilityKey(attached, 'onAssist') === 'assist:journal'
  );
  const updatedCards = { ...state.cards };
  delete updatedCards[occupant.id];

  const stagedIds: string[] = [];
  let nextLog = log;

  if (existingJournal) {
    const augmented = augmentJournalWithDream(existingJournal, extractDreamTitle(occupant) || occupant.name);
    updatedCards[existingJournal.id] = { ...augmented, location: { area: 'lost' } };
    stagedIds.push(existingJournal.id);
    nextLog = utils.appendLog(
      log,
      `${assistant.name} expands ${existingJournal.name} with ${occupant.name}. The entry will be ready once the study concludes.`
    );
  } else {
    const journal = createJournalFromDream(occupant, utils);
    const journalCard: CardInstance = { ...journal, location: { area: 'lost' } };
    updatedCards[journalCard.id] = journalCard;
    stagedIds.push(journalCard.id);
    nextLog = utils.appendLog(
      log,
      `${assistant.name} records ${occupant.name}, preserving it within ${journalCard.name}. The entry will be ready once the study concludes.`
    );
  }

  const cleanedAttachments = slot.attachedCardIds.filter((id) => !(existingJournal && id === existingJournal.id));

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

  const updatedHand = utils.removeFromHand(state.hand, occupant.id);

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

export const studyBehavior: SlotBehavior = {
  activate({ state, slot, log }, utils) {
    if (!slot.occupantId) {
      return { state, log: utils.appendLog(log, 'Place a card upon the Night Archive to study it.'), performed: false };
    }

    const card = state.cards[slot.occupantId];
    if (!card) {
      return { state, log, performed: false };
    }

    const assistant = slot.assistantId ? state.cards[slot.assistantId] ?? null : null;
    const attachmentCards = slot.attachedCardIds
      .map((id) => state.cards[id])
      .filter((attached): attached is CardInstance => Boolean(attached));

    const occupantAbility = resolveCardAbility(card);
    const assistantAbility = assistant ? resolveCardAbility(assistant) : null;

    if (
      occupantAbility.onActivate === 'study:dream-record' &&
      assistant &&
      assistantAbility?.onAssist === 'assist:persona'
    ) {
      return handleDreamRecording(state, slot, card, assistant, attachmentCards, log, utils);
    }

    if (occupantAbility.onActivate === 'study:persona-reflection') {
      const loreGain = 1;
      const nextResources = utils.applyResources(state.resources, { lore: loreGain });
      return {
        state: {
          ...state,
          resources: nextResources
        },
        log: utils.appendLog(log, `${card.name} reflects upon their path, gaining ${loreGain} lore.`),
        performed: true
      };
    }

    let nextState: GameState = { ...state };
    let nextLog = log;

    if (card.rewards?.resources) {
      nextState = {
        ...nextState,
        resources: utils.applyResources(nextState.resources, card.rewards.resources)
      };
      const fragments = Object.entries(card.rewards.resources)
        .map(([key, value]) => `${value} ${key}`)
        .join(' and ');
      nextLog = utils.appendLog(nextLog, `${card.name} is deciphered, yielding ${fragments}.`);
    } else {
      nextLog = utils.appendLog(nextLog, `${card.name} reveals little before dissolving.`);
    }

    if (card.rewards?.discovery) {
      nextState = utils.applyDiscovery(nextState, card.rewards.discovery);
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
        hand: utils.removeFromHand(nextState.hand, card.id)
      },
      log: nextLog,
      performed: true
    };
  }
};
