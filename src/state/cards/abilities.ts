import { CardAbilityKey, CardInstance } from '../types';

export type CardAbilityEvent = 'onActivate' | 'onAssist' | 'onExpire';

export interface ResolvedCardAbility {
  onActivate?: CardAbilityKey;
  onAssist?: CardAbilityKey;
  onExpire?: CardAbilityKey;
}

function resolveActivateAbility(card: CardInstance): CardAbilityKey | undefined {
  if (card.ability?.onActivate) {
    return card.ability.onActivate;
  }

  if (card.traits.includes('dream')) {
    return 'study:dream-record';
  }

  if (card.type === 'persona') {
    return 'study:persona-reflection';
  }

  if (card.rewards) {
    return 'study:reward';
  }

  return undefined;
}

function resolveAssistAbility(card: CardInstance): CardAbilityKey | undefined {
  if (card.ability?.onAssist) {
    return card.ability.onAssist;
  }

  if (card.traits.includes('journal')) {
    return 'assist:journal';
  }

  if (card.type === 'persona') {
    return 'assist:persona';
  }

  return undefined;
}

function resolveExpireAbility(card: CardInstance): CardAbilityKey | undefined {
  if (card.ability?.onExpire) {
    return card.ability.onExpire;
  }

  if (!card.permanent) {
    return 'expire:fading';
  }

  return undefined;
}

export function resolveCardAbility(card: CardInstance): ResolvedCardAbility {
  return {
    onActivate: resolveActivateAbility(card),
    onAssist: resolveAssistAbility(card),
    onExpire: resolveExpireAbility(card)
  };
}

export function resolveAbilityKey(
  card: CardInstance,
  event: CardAbilityEvent
): CardAbilityKey | undefined {
  const ability = resolveCardAbility(card);
  return ability[event];
}
