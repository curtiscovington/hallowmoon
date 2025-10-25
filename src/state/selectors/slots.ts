import { LOCATION_DEFINITIONS } from '../slots/location';
import { SLOT_TEMPLATES } from '../content';
import type { CardInstance, LocationTag, Resources, Slot } from '../types';
import { getSlotActionMetadata } from '../../utils/slotActions';

export interface SlotSummary {
  occupant: CardInstance | null;
  assistant: CardInstance | null;
  attachments: CardInstance[];
  isHeroInSlot: boolean;
  canExploreLocation: boolean;
  isSlotInteractive: boolean;
  isLocked: boolean;
  isResolving: boolean;
  actionLabel: string | null;
  canActivate: boolean;
  availabilityNote: string | null;
  lockRemainingMs: number;
  lockTotalMs: number | null;
}

export type LocationExplorationAvailability = Partial<Record<LocationTag, boolean>>;

export function buildLocationExplorationAvailability(slots: Slot[]): LocationExplorationAvailability {
  const availability: LocationExplorationAvailability = {};
  const existingKeys = new Set(slots.map((slot) => slot.key));

  Object.values(LOCATION_DEFINITIONS).forEach((definition) => {
    const hasUndiscoveredSite = definition.discoverableTemplateKeys.some((templateKey) => {
      const template = SLOT_TEMPLATES[templateKey];
      if (!template) {
        return false;
      }

      const restoredTemplate = template.repair ? SLOT_TEMPLATES[template.repair.targetKey] : null;
      const restoredKey = restoredTemplate?.key ?? null;

      if (existingKeys.has(template.key)) {
        return false;
      }

      if (restoredKey && existingKeys.has(restoredKey)) {
        return false;
      }

      return true;
    });

    availability[definition.key] = definition.allowExplorationWhenExhausted || hasUndiscoveredSite;
  });

  return availability;
}

interface BuildSlotSummariesOptions {
  slots: Slot[];
  cards: Record<string, CardInstance>;
  heroCardId: string | null;
  resources: Resources;
  pausedAt: number | null;
  locationAvailability: LocationExplorationAvailability;
  now?: number;
}

export function buildSlotSummaries({
  slots,
  cards,
  heroCardId,
  resources,
  pausedAt,
  locationAvailability,
  now
}: BuildSlotSummariesOptions): Record<string, SlotSummary> {
  const summaries: Record<string, SlotSummary> = {};
  const currentTime = typeof now === 'number' ? now : Date.now();
  const pausedElapsedMs = pausedAt !== null ? Math.max(0, currentTime - pausedAt) : 0;

  for (const slot of slots) {
    const occupant = slot.occupantId ? cards[slot.occupantId] ?? null : null;
    const assistant = slot.assistantId ? cards[slot.assistantId] ?? null : null;
    const attachments = slot.attachedCardIds
      .map((cardId) => cards[cardId])
      .filter((card): card is CardInstance => Boolean(card));
    const isHeroInSlot = Boolean(
      heroCardId && ((occupant && occupant.id === heroCardId) || (assistant && assistant.id === heroCardId))
    );

    const canExplore =
      slot.type === 'location' && slot.state !== 'damaged'
        ? slot.location
          ? locationAvailability[slot.location] ?? true
          : true
        : true;

    const lockRemainingMs = slot.lockedUntil
      ? Math.max(0, slot.lockedUntil - currentTime + pausedElapsedMs)
      : 0;
    const lockTotalMs = slot.lockDurationMs ?? null;
    const isLocked = Boolean(slot.lockedUntil && lockRemainingMs > 0);
    const isResolving = Boolean(slot.pendingAction);
    const isSlotInteractive = slot.unlocked && !isLocked && !isResolving;

    const actionMetadata = getSlotActionMetadata({
      slot,
      occupant,
      assistant,
      attachments,
      resources,
      canExploreLocation: canExplore,
      isSlotInteractive
    });

    summaries[slot.id] = {
      occupant,
      assistant,
      attachments,
      isHeroInSlot,
      canExploreLocation: canExplore,
      isSlotInteractive,
      isLocked,
      isResolving,
      actionLabel: actionMetadata.actionLabel,
      canActivate: actionMetadata.canActivate,
      availabilityNote: actionMetadata.availabilityNote,
      lockRemainingMs,
      lockTotalMs
    } satisfies SlotSummary;
  }

  return summaries;
}
