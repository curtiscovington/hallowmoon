import { CardInstance, GameState, Slot, SlotType } from '../types';
import { Clock, RandomSource } from '../runtime';
import bedroomBehavior from './bedroom';
import expeditionBehavior from './expedition';
import hearthBehavior from './hearth';
import manorBehavior from './manor';
import ritualBehavior from './ritual';
import studyBehavior from './study';
import workBehavior from './work';

export interface SlotActionResult {
  state: GameState;
  log: string[];
  performed: boolean;
}

export interface SlotBehaviorContext {
  random: RandomSource;
  now: Clock;
}

export interface SlotActivationArgs {
  state: GameState;
  slot: Slot;
  log: string[];
  context: SlotBehaviorContext;
}

export interface SlotLockDurationArgs {
  state: GameState;
  slot: Slot;
  context?: SlotBehaviorContext;
}

export interface SlotAcceptanceArgs {
  state: GameState;
  slot: Slot;
  card: CardInstance;
}

export interface SlotBehaviorLabels {
  activate?: string;
}

export interface SlotBehavior {
  activate: (args: SlotActivationArgs) => SlotActionResult;
  getLockDurationMs?: (args: SlotLockDurationArgs) => number | undefined;
  acceptsCard?: (args: SlotAcceptanceArgs) => boolean;
  labels?: SlotBehaviorLabels;
}

const defaultSlotBehaviors: Record<SlotType, SlotBehavior> = {
  hearth: hearthBehavior,
  work: workBehavior,
  study: studyBehavior,
  ritual: ritualBehavior,
  expedition: expeditionBehavior,
  manor: manorBehavior,
  bedroom: bedroomBehavior
};

let registry: Partial<Record<SlotType, SlotBehavior>> = { ...defaultSlotBehaviors };

export function getSlotBehavior(type: SlotType): SlotBehavior | undefined {
  return registry[type];
}

export function registerSlotBehavior(type: SlotType, behavior: SlotBehavior): void {
  registry[type] = behavior;
}

export function unregisterSlotBehavior(type: SlotType): void {
  delete registry[type];
}

export function resetSlotBehaviors(): void {
  registry = { ...defaultSlotBehaviors };
}

export function getDefaultSlotBehaviors(): Record<SlotType, SlotBehavior> {
  return { ...defaultSlotBehaviors };
}
