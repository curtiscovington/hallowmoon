import { CardAbilityEvent, CardAbilityKey, CardArchetype } from '../types';

export type CardAbilityCondition =
  | { type: 'trait'; value: string }
  | { type: 'card-type'; value: CardArchetype }
  | { type: 'has-rewards'; value: boolean }
  | { type: 'permanent'; value: boolean };

export interface CardAbilityFallbackDefinition {
  event: CardAbilityEvent;
  ability: CardAbilityKey;
  conditions: CardAbilityCondition[];
  description?: string;
}

export const CARD_ABILITY_FALLBACKS: CardAbilityFallbackDefinition[] = [
  {
    event: 'onActivate',
    ability: 'study:dream-record',
    conditions: [{ type: 'trait', value: 'dream' }],
    description: 'Dream-tagged cards record their visions when studied.'
  },
  {
    event: 'onActivate',
    ability: 'study:persona-reflection',
    conditions: [{ type: 'card-type', value: 'persona' }],
    description: 'Personas reflect on their journeys when studied.'
  },
  {
    event: 'onActivate',
    ability: 'study:reward',
    conditions: [{ type: 'has-rewards', value: true }],
    description: 'Cards that promise rewards yield them when studied.'
  },
  {
    event: 'onAssist',
    ability: 'assist:journal',
    conditions: [{ type: 'trait', value: 'journal' }],
    description: 'Journals assist with recording dreams.'
  },
  {
    event: 'onAssist',
    ability: 'assist:persona',
    conditions: [{ type: 'card-type', value: 'persona' }],
    description: 'Personas lend aid when assisting other cards.'
  },
  {
    event: 'onExpire',
    ability: 'expire:fading',
    conditions: [{ type: 'permanent', value: false }],
    description: 'Non-permanent cards fade when their time runs out.'
  }
];
