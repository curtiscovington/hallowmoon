import type { CardInstance, GameState, Resources, Slot, SlotType, DiscoverySeed } from '../types';
import type { CardTemplate } from '../content/cards';
import type { SlotTemplate } from '../content/slots';

import { bedroomBehavior } from './bedroom';
import { expeditionBehavior } from './expedition';
import { hearthBehavior } from './hearth';
import { manorBehavior } from './manor';
import { ritualBehavior } from './ritual';
import { studyBehavior } from './study';
import { workBehavior } from './work';

export interface SlotActionResult {
  state: GameState;
  log: string[];
  performed: boolean;
}

export interface SlotActivationContext {
  state: GameState;
  slot: Slot;
  log: string[];
}

export interface SlotBehaviorAcceptanceContext {
  state: GameState;
  slot: Slot;
}

export interface SlotCardPlacementContext {
  state: GameState;
  slot: Slot;
  card: CardInstance;
  occupant: CardInstance | null;
  assistant: CardInstance | null;
  attachments: CardInstance[];
  log: string[];
}

export interface SlotBehaviorLabels {
  activation?: string;
  locked?: string;
}

export interface SlotCardPlacementResult {
  state: GameState;
  log: string[];
  handled: boolean;
}

export interface SlotBehavior {
  activate: (context: SlotActivationContext, utils: SlotBehaviorUtils) => SlotActionResult;
  getLockDurationMs?: (context: SlotActivationContext, utils: SlotBehaviorUtils) => number | null | undefined;
  acceptsCard?: (
    card: CardInstance,
    context: SlotBehaviorAcceptanceContext,
    utils: SlotBehaviorUtils
  ) => boolean;
  onCardPlaced?: (
    context: SlotCardPlacementContext,
    utils: SlotBehaviorUtils
  ) => SlotCardPlacementResult;
  labels?: SlotBehaviorLabels;
}

export interface SlotBehaviorUtils {
  appendLog: (log: string[], message: string) => string[];
  applyResources: (current: Resources, delta: Partial<Resources>) => Resources;
  applyDiscovery: (state: GameState, seed: DiscoverySeed) => GameState;
  random: () => number;
  spawnOpportunity: (state: GameState, log: string[]) => { state: GameState; log: string[] };
  createCard: (template: CardTemplate) => CardInstance;
  createSlot: (template: SlotTemplate) => Slot;
  addToHand: (hand: string[], cardId: string, toFront?: boolean) => string[];
  removeFromHand: (hand: string[], cardId: string) => string[];
}

export type SlotBehaviorRegistry = Partial<Record<SlotType, SlotBehavior>>;

export const SLOT_BEHAVIORS: SlotBehaviorRegistry = {
  hearth: hearthBehavior,
  work: workBehavior,
  study: studyBehavior,
  ritual: ritualBehavior,
  expedition: expeditionBehavior,
  manor: manorBehavior,
  bedroom: bedroomBehavior
};

