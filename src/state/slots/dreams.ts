import { CardInstance } from '../types';
import { CardTemplate } from '../content';
import { instantiateCard, randomFrom } from './shared';

const DREAM_TITLES = [
  'Silver Staircases',
  'Echoing Halls',
  'Frosted Lanterns',
  'Lunar Choirs',
  'Velvet Storms',
  'Shattered Constellations'
] as const;

const JOURNAL_CARD_NAME = 'Private Journal';

export function isDreamCard(card: CardInstance | undefined): card is CardInstance {
  return Boolean(card && card.traits.includes('dream'));
}

export function isJournalCard(card: CardInstance | undefined): card is CardInstance {
  return Boolean(card && card.traits.includes('journal'));
}

export function extractDreamTitle(dream: CardInstance): string {
  return dream.name.replace(/^Fleeting Dream:\s*/, '');
}

export function createDreamCard(): CardInstance {
  const title = randomFrom(DREAM_TITLES);
  const template: CardTemplate = {
    key: 'fleeting-dream',
    name: `Fleeting Dream: ${title}`,
    type: 'inspiration',
    description: `A fleeting vision of ${title.toLowerCase()}. Document it before it fades.`,
    traits: ['dream', 'fleeting'],
    permanent: false,
    lifetime: 3
  };
  return instantiateCard(template);
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
    remainingTurns: null
  };
}

export function augmentJournalWithDream(journal: CardInstance, dreamTitle: string): CardInstance {
  const existingEntries = extractJournalDreams(journal);
  const hasEntry = existingEntries.includes(dreamTitle);
  const updatedEntries = hasEntry ? existingEntries : [...existingEntries, dreamTitle];
  return applyJournalEntries(journal, updatedEntries);
}

export function createEmptyJournal(): CardInstance {
  const template: CardTemplate = {
    key: 'private-journal',
    name: JOURNAL_CARD_NAME,
    type: 'inspiration',
    description: describeJournal([]),
    traits: ['journal', 'dream-record'],
    permanent: true
  };
  const journal = instantiateCard(template);
  return applyJournalEntries(journal, []);
}

export function createJournalFromDream(dream: CardInstance): CardInstance {
  const recordedTitle = extractDreamTitle(dream) || dream.name;
  const template: CardTemplate = {
    key: 'private-journal',
    name: JOURNAL_CARD_NAME,
    type: 'inspiration',
    description: describeJournal([recordedTitle]),
    traits: ['journal', 'dream-record', `dream:${recordedTitle}`],
    permanent: true
  };
  const journal = instantiateCard(template);
  return applyJournalEntries(journal, [recordedTitle]);
}
