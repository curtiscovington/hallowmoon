import type { CardInstance, Resources, Slot } from '../state/types';

export interface SlotActionContext {
  slot: Slot;
  occupant: CardInstance | null;
  assistant: CardInstance | null;
  attachments: CardInstance[];
  resources: Resources;
  canExploreLocation: boolean;
  isSlotInteractive: boolean;
}

export interface SlotActionMetadata {
  actionLabel: string | null;
  canActivate: boolean;
  availabilityNote: string | null;
}

function formatCardTypeLabel(card: CardInstance | null): string | null {
  if (!card) {
    return null;
  }
  return card.type.charAt(0).toUpperCase() + card.type.slice(1);
}

function deriveActionLabel({
  slot,
  occupant,
  assistant,
  attachments
}: Pick<SlotActionContext, 'slot' | 'occupant' | 'assistant' | 'attachments'>): string | null {
  if (!occupant) {
    return null;
  }

  switch (slot.type) {
    case 'study': {
      const personaPresent =
        (occupant && occupant.type === 'persona') || (assistant && assistant.type === 'persona');
      const occupantIsDream = Boolean(occupant && occupant.traits.includes('dream'));
      const occupantIsJournal = Boolean(occupant && occupant.traits.includes('journal'));
      const hasJournalAttachment = attachments.some((card) => card.traits.includes('journal'));

      if (personaPresent && occupantIsDream && hasJournalAttachment) {
        return 'Record Dream';
      }
      if (personaPresent && (occupantIsJournal || hasJournalAttachment)) {
        return 'Annotate Journal';
      }
      if (occupantIsDream) {
        return 'Interpret Dream';
      }
      return 'Study';
    }
    case 'work':
      return 'Work';
    case 'hearth':
      return 'Rest';
    case 'location':
      return slot.state === 'damaged' ? 'Clear' : 'Explore';
    case 'bedroom':
      return 'Slumber';
    default:
      return 'Activate';
  }
}

export function getSlotActionMetadata(context: SlotActionContext): SlotActionMetadata {
  const { slot, occupant, assistant, attachments, resources, canExploreLocation, isSlotInteractive } =
    context;

  const actionLabel = deriveActionLabel({ slot, occupant, assistant, attachments });

  if (!occupant) {
    return { actionLabel, canActivate: false, availabilityNote: null };
  }

  if (!isSlotInteractive) {
    return { actionLabel, canActivate: false, availabilityNote: null };
  }

  switch (slot.type) {
    case 'hearth':
    case 'work':
    case 'bedroom': {
      const canActivate = occupant.type === 'persona';
      return {
        actionLabel,
        canActivate,
        availabilityNote: canActivate ? null : 'Only a persona may make use of this slot.'
      };
    }
    case 'location': {
      if (occupant.type !== 'persona') {
        return { actionLabel, canActivate: false, availabilityNote: 'Only a persona can tend to this site.' };
      }
      if (slot.state !== 'damaged' && !canExploreLocation) {
        return {
          actionLabel,
          canActivate: false,
          availabilityNote: 'All discoverable opportunities have been secured here for now.'
        };
      }
      return { actionLabel, canActivate: true, availabilityNote: null };
    }
    case 'ritual': {
      if (occupant.type !== 'persona') {
        return { actionLabel, canActivate: false, availabilityNote: 'A persona must anchor the ritual.' };
      }
      const loreCost = Math.max(2, 2 + slot.level - 1);
      if (resources.lore < loreCost) {
        return {
          actionLabel,
          canActivate: false,
          availabilityNote: `Requires ${loreCost} lore to perform this ritual.`
        };
      }
      return { actionLabel, canActivate: true, availabilityNote: null };
    }
    case 'expedition': {
      if (occupant.type !== 'persona') {
        return { actionLabel, canActivate: false, availabilityNote: 'Only a persona can brave the Umbral Gate.' };
      }
      const glimmerCost = 1;
      if (resources.glimmer < glimmerCost) {
        return {
          actionLabel,
          canActivate: false,
          availabilityNote: 'Requires 1 glimmer to light the path beyond the gate.'
        };
      }
      return { actionLabel, canActivate: true, availabilityNote: null };
    }
    default:
      return { actionLabel, canActivate: true, availabilityNote: null };
  }
}

export function describeCardForStatus(card: CardInstance | null): string | null {
  if (!card) {
    return null;
  }
  const typeLabel = formatCardTypeLabel(card);
  return typeLabel ? `${card.name} (${typeLabel})` : card.name;
}
