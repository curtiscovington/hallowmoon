import { CARD_ABILITY_FALLBACKS, type CardAbilityCondition } from '../content/abilities';
import { CardAbilityEvent, CardAbilityKey, CardInstance } from '../types';

export interface ResolvedCardAbility {
  onActivate?: CardAbilityKey;
  onAssist?: CardAbilityKey;
  onExpire?: CardAbilityKey;
}

function matchesCondition(card: CardInstance, condition: CardAbilityCondition): boolean {
  switch (condition.type) {
    case 'trait':
      return card.traits.includes(condition.value);
    case 'card-type':
      return card.type === condition.value;
    case 'has-rewards':
      return Boolean(card.rewards) === condition.value;
    case 'permanent':
      return card.permanent === condition.value;
    default:
      return false;
  }
}

function inferAbility(card: CardInstance, event: CardAbilityEvent): CardAbilityKey | undefined {
  for (const fallback of CARD_ABILITY_FALLBACKS) {
    if (fallback.event !== event) {
      continue;
    }
    if (fallback.conditions.every((condition) => matchesCondition(card, condition))) {
      return fallback.ability;
    }
  }
  return undefined;
}

export function resolveCardAbility(card: CardInstance): ResolvedCardAbility {
  return {
    onActivate: card.ability?.onActivate ?? inferAbility(card, 'onActivate'),
    onAssist: card.ability?.onAssist ?? inferAbility(card, 'onAssist'),
    onExpire: card.ability?.onExpire ?? inferAbility(card, 'onExpire')
  };
}

export function resolveAbilityKey(
  card: CardInstance,
  event: CardAbilityEvent
): CardAbilityKey | undefined {
  if (card.ability?.[event]) {
    return card.ability[event];
  }
  return inferAbility(card, event);
}
