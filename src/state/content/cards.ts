import { CardAbilityMetadata, CardInstance, CardReward } from '../types';

export interface CardTemplate {
  key: string;
  name: string;
  type: CardInstance['type'];
  description: string;
  traits: string[];
  permanent: boolean;
  lifetime?: number;
  rewards?: CardReward;
  ability?: CardAbilityMetadata;
}

export const HERO_TEMPLATE: CardTemplate = {
  key: 'persona-initiate',
  name: 'Initiate of the Veiled Star',
  type: 'persona',
  description:
    'You. A fledgling adept weaving meaning from scraps of forgotten constellations.',
  traits: ['permanent', 'persona'],
  permanent: true
};

export const OPPORTUNITY_TEMPLATES: readonly CardTemplate[] = [
  {
    key: 'fading-whisper',
    name: 'Fading Whisper',
    type: 'inspiration',
    description: 'Study before it unravels to gather 2 lore and a glimmer of moonlight.',
    traits: ['fleeting', 'memory'],
    permanent: false,
    lifetime: 2,
    ability: {
      onActivate: 'study:reward',
      onExpire: 'expire:fading'
    },
    rewards: {
      resources: { lore: 2, glimmer: 1 }
    }
  },
  {
    key: 'glimmering-spark',
    name: 'Glimmering Spark',
    type: 'relic',
    description: 'A mote of wandering starlight. Study to harvest 2 glimmer.',
    traits: ['fleeting', 'starlight'],
    permanent: false,
    lifetime: 3,
    ability: {
      onActivate: 'study:reward',
      onExpire: 'expire:fading'
    },
    rewards: {
      resources: { glimmer: 2 }
    }
  },
  {
    key: 'cartographer-echo',
    name: 'Cartographer’s Echo',
    type: 'inspiration',
    description:
      'A half-remembered map etched in frost. Studying it may reveal new expedition grounds.',
    traits: ['fleeting', 'map'],
    permanent: false,
    lifetime: 4,
    ability: {
      onActivate: 'study:reward',
      onExpire: 'expire:fading'
    },
    rewards: {
      resources: { lore: 1 },
      discovery: {
        key: 'umbral-gate',
        name: 'Umbral Gate Sigil',
        description: 'The sigil unlocks an expedition slot leading into the Hollow Ways.'
      }
    }
  }
];

export function createCardInstance(
  template: CardTemplate,
  id: string,
  location: CardInstance['location']
): CardInstance {
  return {
    id,
    key: template.key,
    name: template.name,
    type: template.type,
    description: template.description,
    traits: [...template.traits],
    permanent: template.permanent,
    remainingTurns: template.permanent ? null : template.lifetime ?? null,
    rewards: template.rewards,
    ability: template.ability,
    location
  };
}

