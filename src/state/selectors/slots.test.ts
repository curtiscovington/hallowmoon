import { describe, expect, it } from 'vitest';
import { buildLocationExplorationAvailability, buildSlotSummaries } from './slots';
import { SLOT_TEMPLATES, HERO_TEMPLATE, OPPORTUNITY_TEMPLATES } from '../content';
import type { Slot } from '../types';
import { createCardInstance } from '../content/cards';

function createSlotFromTemplate(
  templateKey: keyof typeof SLOT_TEMPLATES,
  overrides: Partial<Slot> = {}
): Slot {
  const template = SLOT_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown slot template: ${templateKey}`);
  }

  const repair = template.repair
    ? { targetKey: template.repair.targetKey, remaining: template.repair.time, total: template.repair.time }
    : null;

  return {
    id: `slot-${template.key}`,
    key: template.key,
    name: template.name,
    type: template.type,
    description: template.description,
    location: template.location ?? null,
    level: 1,
    upgradeCost: template.upgradeCost,
    traits: [...template.traits],
    accepted: template.accepted,
    occupantId: null,
    assistantId: null,
    unlocked: template.unlocked ?? true,
    state: template.state ?? 'active',
    repair,
    repairStarted: false,
    lockedUntil: null,
    lockDurationMs: null,
    pendingAction: null,
    attachedCardIds: [],
    ...overrides
  };
}

describe('buildLocationExplorationAvailability', () => {
  it('marks locations as explorable when undiscovered sites remain', () => {
    const slots = [createSlotFromTemplate('manor')];
    const availability = buildLocationExplorationAvailability(slots);

    expect(availability.manor).toBe(true);
  });

  it('marks locations as exhausted when all restoration sites are present', () => {
    const slots: Slot[] = [
      createSlotFromTemplate('manor'),
      createSlotFromTemplate('hearth'),
      createSlotFromTemplate('work'),
      createSlotFromTemplate('study'),
      createSlotFromTemplate('ritual'),
      createSlotFromTemplate('bedroom')
    ];

    const availability = buildLocationExplorationAvailability(slots);

    expect(availability.manor).toBe(false);
  });
});

describe('buildSlotSummaries', () => {
  it('derives interaction state, timing, and participants for each slot', () => {
    const now = 1_000_000;
    const slotId = 'slot-manor';
    const baseSlot = createSlotFromTemplate('manor', {
      id: slotId,
      lockedUntil: now + 10_000,
      lockDurationMs: 30_000
    });

    const hero = createCardInstance(HERO_TEMPLATE, 'card-hero', { area: 'slot', slotId });
    const attachment = createCardInstance(OPPORTUNITY_TEMPLATES[0], 'card-attach', {
      area: 'slot',
      slotId
    });

    const slot: Slot = {
      ...baseSlot,
      occupantId: hero.id,
      attachedCardIds: [attachment.id]
    };

    const summaries = buildSlotSummaries({
      slots: [slot],
      cards: {
        [hero.id]: hero,
        [attachment.id]: attachment
      },
      heroCardId: hero.id,
      resources: { coin: 0, lore: 0, glimmer: 0 },
      pausedAt: now - 2_000,
      locationAvailability: { manor: false },
      now
    });

    const summary = summaries[slotId];

    expect(summary).toBeDefined();
    expect(summary.occupant).toEqual(hero);
    expect(summary.attachments).toHaveLength(1);
    expect(summary.attachments[0]).toEqual(attachment);
    expect(summary.isHeroInSlot).toBe(true);
    expect(summary.canExploreLocation).toBe(false);
    expect(summary.isSlotInteractive).toBe(false);
    expect(summary.isLocked).toBe(true);
    expect(summary.lockRemainingMs).toBe(12_000);
    expect(summary.lockTotalMs).toBe(30_000);
    expect(summary.actionLabel).toBe('Explore');
    expect(summary.canActivate).toBe(false);
    expect(summary.availabilityNote).toBeNull();
  });

  it('includes availability context when a location is exhausted but ready for interaction', () => {
    const now = 2_000_000;
    const slotId = 'slot-manor-ready';
    const baseSlot = createSlotFromTemplate('manor', {
      id: slotId
    });

    const hero = createCardInstance(HERO_TEMPLATE, 'card-hero-ready', { area: 'slot', slotId });

    const slot: Slot = {
      ...baseSlot,
      occupantId: hero.id
    };

    const summaries = buildSlotSummaries({
      slots: [slot],
      cards: {
        [hero.id]: hero
      },
      heroCardId: hero.id,
      resources: { coin: 0, lore: 0, glimmer: 0 },
      pausedAt: null,
      locationAvailability: { manor: false },
      now
    });

    const summary = summaries[slotId];

    expect(summary.isSlotInteractive).toBe(true);
    expect(summary.availabilityNote).toBe(
      'All discoverable opportunities have been secured here for now.'
    );
  });
});
