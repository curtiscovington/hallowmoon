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

export const HERO_PERSONA_TEMPLATES: readonly CardTemplate[] = [
  {
    key: 'persona-watcher',
    name: 'The Watcher',
    type: 'persona',
    description: '“You see what others overlook. The world speaks to those who listen.”',
    traits: ['permanent', 'persona'],
    permanent: true
  },
  {
    key: 'persona-weaver',
    name: 'The Weaver',
    type: 'persona',
    description: '“You shape connections unseen — threads of fate, thought, and will.”',
    traits: ['permanent', 'persona'],
    permanent: true
  },
  {
    key: 'persona-outcast',
    name: 'The Outcast',
    type: 'persona',
    description:
      '“You walk apart, unbound by the threads that bind others. The world turned its back — so you learned to face it alone.”',
    traits: ['permanent', 'persona'],
    permanent: true
  }
];

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

