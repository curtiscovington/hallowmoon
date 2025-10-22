import type { CardInstance, Resources } from '../types';
import type { SlotActionResult, SlotActivationContext, SlotBehaviorUtils } from './behaviors';

interface EnsureOccupantOptions {
  message: string;
}

interface EnsurePersonaOptions extends EnsureOccupantOptions {
  invalidMessage: string;
}

type EnsureOutcome = { card: CardInstance } | { result: SlotActionResult };

export function ensureOccupant(
  context: SlotActivationContext,
  utils: SlotBehaviorUtils,
  options: EnsureOccupantOptions
): EnsureOutcome {
  const { state, slot, log } = context;

  if (!slot.occupantId) {
    return {
      result: {
        state,
        log: utils.appendLog(log, options.message),
        performed: false
      }
    };
  }

  const card = state.cards[slot.occupantId];
  if (!card) {
    return {
      result: {
        state,
        log: utils.appendLog(log, options.message),
        performed: false
      }
    };
  }

  return { card };
}

export function ensurePersonaOccupant(
  context: SlotActivationContext,
  utils: SlotBehaviorUtils,
  options: EnsurePersonaOptions
): EnsureOutcome {
  const occupant = ensureOccupant(context, utils, options);
  if ('result' in occupant) {
    return occupant;
  }

  if (occupant.card.type !== 'persona') {
    const { state, log } = context;
    return {
      result: {
        state,
        log: utils.appendLog(log, options.invalidMessage),
        performed: false
      }
    };
  }

  return occupant;
}

const RESOURCE_ORDER: (keyof Resources)[] = ['coin', 'lore', 'glimmer'];

export function formatResourceDelta(delta: Partial<Resources>): string {
  const fragments = RESOURCE_ORDER.reduce<string[]>((acc, key) => {
    const value = delta[key];
    if (typeof value === 'number' && value !== 0) {
      acc.push(`${value} ${key}`);
    }
    return acc;
  }, []);

  if (fragments.length === 0) {
    return 'nothing';
  }

  if (fragments.length === 1) {
    return fragments[0];
  }

  const last = fragments[fragments.length - 1];
  const rest = fragments.slice(0, -1).join(', ');
  return `${rest} and ${last}`;
}
