import { resolveAbilityKey, resolveCardAbility } from '../cards/abilities';
import type { CardAbilityEvent, CardAbilityKey, CardInstance, GameState, Slot } from '../types';
import type {
  SlotBehavior,
  SlotBehaviorUtils,
  SlotCardPlacementContext,
  SlotCardPlacementResult
} from './behaviors';
import { ensureOccupant, formatResourceDelta } from './helpers';
import { JOURNAL_CARD_NAME, extractDreamTitle } from './dreams';

interface AbilityRequirement {
  event: CardAbilityEvent;
  key: CardAbilityKey;
}

interface StudyCardMatcher {
  abilities?: AbilityRequirement[];
}

type AssistantPresence = 'required' | 'forbidden' | 'sameAsIncomingOrAbsent';

interface StudyPlacementConditions {
  occupant?: StudyCardMatcher;
  assistant?: StudyCardMatcher;
  incoming?: StudyCardMatcher;
  assistantPresence?: AssistantPresence;
}

interface StudyPlacementRule {
  id: string;
  conditions: StudyPlacementConditions;
  apply: (context: SlotCardPlacementContext, utils: SlotBehaviorUtils) => SlotCardPlacementResult;
}

function ability(event: CardAbilityEvent, key: CardAbilityKey): AbilityRequirement {
  return { event, key };
}

function ensureAttachmentIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function placeCardInSlot(card: CardInstance, slotId: string): CardInstance {
  return { ...card, location: { area: 'slot', slotId } };
}

function matchesCard(card: CardInstance | null, matcher?: StudyCardMatcher): boolean {
  if (!matcher) {
    return true;
  }
  if (!card) {
    return false;
  }
  if (matcher.abilities) {
    return matcher.abilities.every(({ event, key }) => resolveAbilityKey(card, event) === key);
  }
  return true;
}

function matchesAssistantPresence(
  context: SlotCardPlacementContext,
  requirement: AssistantPresence
): boolean {
  const { assistant, card } = context;
  switch (requirement) {
    case 'required':
      return Boolean(assistant);
    case 'forbidden':
      return !assistant;
    case 'sameAsIncomingOrAbsent':
      return !assistant || assistant.id === card.id;
    default:
      return true;
  }
}

function matchesRule(context: SlotCardPlacementContext, rule: StudyPlacementRule): boolean {
  const { conditions } = rule;

  if (conditions.assistantPresence && !matchesAssistantPresence(context, conditions.assistantPresence)) {
    return false;
  }

  if (!matchesCard(context.occupant, conditions.occupant)) {
    return false;
  }

  if (!matchesCard(context.assistant, conditions.assistant)) {
    return false;
  }

  if (!matchesCard(context.card, conditions.incoming)) {
    return false;
  }

  return true;
}

function passthroughPlacement(context: SlotCardPlacementContext): SlotCardPlacementResult {
  return { state: context.state, log: context.log, handled: false };
}

function handledPlacement(state: GameState, log: string[]): SlotCardPlacementResult {
  return { state: { ...state, log }, log, handled: true };
}

const STUDY_PLACEMENT_RULES: StudyPlacementRule[] = [
  {
    id: 'journal-becomes-occupant',
    conditions: {
      occupant: { abilities: [ability('onAssist', 'assist:persona')] },
      incoming: { abilities: [ability('onAssist', 'assist:journal')] },
      assistantPresence: 'forbidden'
    },
    apply: (context, utils) => {
      const { state, slot, card, occupant } = context;
      if (!occupant) {
        return passthroughPlacement(context);
      }

      const updatedHand = utils.removeFromHand(state.hand, card.id);
      const updatedCards: GameState['cards'] = {
        ...state.cards,
        [occupant.id]: placeCardInSlot(occupant, slot.id),
        [card.id]: placeCardInSlot(card, slot.id)
      };

      const nextAttachments = ensureAttachmentIds(slot.attachedCardIds.filter((id) => id !== card.id));

      const updatedSlots: GameState['slots'] = {
        ...state.slots,
        [slot.id]: {
          ...slot,
          occupantId: card.id,
          assistantId: occupant.id,
          attachedCardIds: nextAttachments
        }
      };

      const updatedState: GameState = {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand
      };

      const nextLog = utils.appendLog(
        state.log,
        `${card.name} is opened for ${occupant.name}, ready to capture their studies.`
      );

      return handledPlacement(updatedState, nextLog);
    }
  },
  {
    id: 'dream-becomes-occupant',
    conditions: {
      occupant: { abilities: [ability('onAssist', 'assist:persona')] },
      incoming: { abilities: [ability('onActivate', 'study:dream-record')] },
      assistantPresence: 'forbidden'
    },
    apply: (context, utils) => {
      const { state, slot, card, occupant } = context;
      if (!occupant) {
        return passthroughPlacement(context);
      }

      const updatedHand = utils.removeFromHand(state.hand, card.id);
      const updatedCards: GameState['cards'] = {
        ...state.cards,
        [occupant.id]: placeCardInSlot(occupant, slot.id),
        [card.id]: placeCardInSlot(card, slot.id)
      };

      const nextAttachments = ensureAttachmentIds(slot.attachedCardIds.filter((id) => id !== card.id));

      const updatedSlots: GameState['slots'] = {
        ...state.slots,
        [slot.id]: {
          ...slot,
          occupantId: card.id,
          assistantId: occupant.id,
          attachedCardIds: nextAttachments
        }
      };

      const updatedState: GameState = {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand
      };

      const nextLog = utils.appendLog(
        state.log,
        `${card.name} is entrusted to ${occupant.name} for study.`
      );

      return handledPlacement(updatedState, nextLog);
    }
  },
  {
    id: 'journal-attaches-to-dream',
    conditions: {
      occupant: { abilities: [ability('onActivate', 'study:dream-record')] },
      assistant: { abilities: [ability('onAssist', 'assist:persona')] },
      incoming: { abilities: [ability('onAssist', 'assist:journal')] },
      assistantPresence: 'required'
    },
    apply: (context, utils) => {
      const { state, slot, card, assistant, occupant } = context;
      if (!assistant || !occupant) {
        return passthroughPlacement(context);
      }

      const updatedHand = utils.removeFromHand(state.hand, card.id);
      const updatedCards: GameState['cards'] = {
        ...state.cards,
        [card.id]: placeCardInSlot(card, slot.id)
      };

      const nextAttachments = ensureAttachmentIds([
        ...slot.attachedCardIds.filter((id) => id !== card.id),
        card.id
      ]);

      const updatedSlots: GameState['slots'] = {
        ...state.slots,
        [slot.id]: {
          ...slot,
          attachedCardIds: nextAttachments
        }
      };

      const updatedState: GameState = {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand
      };

      const nextLog = utils.appendLog(
        state.log,
        `${card.name} lies open for ${assistant.name}, ready to capture ${occupant.name}.`
      );

      return handledPlacement(updatedState, nextLog);
    }
  },
  {
    id: 'persona-joins-dream',
    conditions: {
      occupant: { abilities: [ability('onActivate', 'study:dream-record')] },
      incoming: { abilities: [ability('onAssist', 'assist:persona')] },
      assistantPresence: 'sameAsIncomingOrAbsent'
    },
    apply: (context, utils) => {
      const { state, slot, card, occupant } = context;
      if (!occupant) {
        return passthroughPlacement(context);
      }

      const updatedHand = utils.removeFromHand(state.hand, card.id);
      const updatedCards: GameState['cards'] = {
        ...state.cards,
        [card.id]: placeCardInSlot(card, slot.id)
      };

      const updatedSlots: GameState['slots'] = {
        ...state.slots,
        [slot.id]: {
          ...slot,
          assistantId: card.id
        }
      };

      const updatedState: GameState = {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand
      };

      const nextLog = utils.appendLog(
        state.log,
        `${card.name} joins ${occupant.name} to interpret the dream.`
      );

      return handledPlacement(updatedState, nextLog);
    }
  },
  {
    id: 'dream-replaces-journal',
    conditions: {
      occupant: { abilities: [ability('onAssist', 'assist:journal')] },
      assistant: { abilities: [ability('onAssist', 'assist:persona')] },
      incoming: { abilities: [ability('onActivate', 'study:dream-record')] },
      assistantPresence: 'required'
    },
    apply: (context, utils) => {
      const { state, slot, card, assistant, occupant } = context;
      if (!assistant || !occupant) {
        return passthroughPlacement(context);
      }

      const updatedHand = utils.removeFromHand(state.hand, card.id);

      const updatedCards: GameState['cards'] = {
        ...state.cards,
        [occupant.id]: placeCardInSlot(occupant, slot.id),
        [card.id]: placeCardInSlot(card, slot.id)
      };

      const nextAttachments = ensureAttachmentIds([
        ...slot.attachedCardIds.filter((id) => id !== card.id && id !== occupant.id),
        occupant.id
      ]);

      const updatedSlots: GameState['slots'] = {
        ...state.slots,
        [slot.id]: {
          ...slot,
          occupantId: card.id,
          assistantId: assistant.id,
          attachedCardIds: nextAttachments
        }
      };

      const updatedState: GameState = {
        ...state,
        cards: updatedCards,
        slots: updatedSlots,
        hand: updatedHand
      };

      const nextLog = utils.appendLog(
        state.log,
        `${card.name} is placed for ${assistant.name} to chronicle within ${occupant.name}.`
      );

      return handledPlacement(updatedState, nextLog);
    }
  }
];

function applyStudyPlacementRules(
  context: SlotCardPlacementContext,
  utils: SlotBehaviorUtils
): SlotCardPlacementResult {
  for (const rule of STUDY_PLACEMENT_RULES) {
    if (matchesRule(context, rule)) {
      return rule.apply(context, utils);
    }
  }

  return passthroughPlacement(context);
}

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

export function createEmptyJournal(utils: SlotBehaviorUtils): CardInstance {
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

  const cleanedAttachments = ensureAttachmentIds(
    slot.attachedCardIds.filter((id) => !(existingJournal && id === existingJournal.id))
  );

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
    const occupant = ensureOccupant(
      { state, slot, log },
      utils,
      { message: 'Place a card upon the Night Archive to study it.' }
    );
    if ('result' in occupant) {
      return occupant.result;
    }

    const card = occupant.card;

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

    if (card.permanent) {
      return {
        state,
        log: utils.appendLog(
          log,
          `Permanent records resist the archive's hunger. Pair ${card.name} with a fleeting dream to expand its insights.`
        ),
        performed: false
      };
    }

    let nextState: GameState = { ...state };
    let nextLog = log;

    if (card.rewards?.resources) {
      nextState = {
        ...nextState,
        resources: utils.applyResources(nextState.resources, card.rewards.resources)
      };
      const fragments = formatResourceDelta(card.rewards.resources);
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
  },
  onCardPlaced(context, utils) {
    return applyStudyPlacementRules(context, utils);
  }
};
