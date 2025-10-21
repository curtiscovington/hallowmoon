import { resolveAbilityKey } from '../cards/abilities';
import type { CardInstance } from '../types';

export const JOURNAL_CARD_NAME = 'Private Journal';

export function isDreamCard(card: CardInstance | undefined): card is CardInstance {
  return Boolean(card && resolveAbilityKey(card, 'onActivate') === 'study:dream-record');
}

export function isJournalCard(card: CardInstance | undefined): card is CardInstance {
  return Boolean(card && resolveAbilityKey(card, 'onAssist') === 'assist:journal');
}

export function extractDreamTitle(dream: CardInstance): string {
  return dream.name.replace(/^Fleeting Dream:\s*/, '');
}
