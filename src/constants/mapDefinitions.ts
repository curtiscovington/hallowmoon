import overworldMap from '../assets/maps/overworld.svg';
import manorMap from '../assets/maps/manor.svg';
import townMap from '../assets/maps/town.svg';
import forestMap from '../assets/maps/forest.svg';
import { LocationTag } from '../state/types';

type MapImageCredit = string | undefined;

export type MapId = 'overworld' | 'manor' | 'town' | 'forest';

export interface MapImage {
  src: string;
  alt: string;
  credit?: MapImageCredit;
}

export interface MapSlotAnchor {
  slotKeys: readonly string[];
  x: number; // percentage 0-100 relative to intrinsic width
  y: number; // percentage 0-100 relative to intrinsic height
}

export interface MapDefinition {
  id: MapId;
  name: string;
  description: string;
  image: MapImage;
  anchors: readonly MapSlotAnchor[];
  focusLocations: readonly LocationTag[];
}

const manorAnchors: MapSlotAnchor[] = [
  { slotKeys: ['damaged-sanctum', 'veiled-sanctum'], x: 30, y: 38 },
  { slotKeys: ['damaged-scriptorium', 'scribe-post'], x: 52, y: 34 },
  { slotKeys: ['damaged-archive', 'night-archive'], x: 32, y: 62 },
  { slotKeys: ['damaged-circle', 'moonlit-circle'], x: 56, y: 64 },
  { slotKeys: ['damaged-bedroom', 'astral-chamber'], x: 74, y: 60 },
  { slotKeys: ['chart-room'], x: 20, y: 52 }
];

const townAnchors: MapSlotAnchor[] = [
  { slotKeys: ['moonlit-town'], x: 50, y: 48 },
  { slotKeys: ['lunar-church'], x: 36, y: 42 },
  { slotKeys: ['moonlit-shop'], x: 62, y: 60 }
];

const forestAnchors: MapSlotAnchor[] = [
  { slotKeys: ['whispering-forest'], x: 58, y: 48 }
];

const overworldAnchors: MapSlotAnchor[] = [
  { slotKeys: ['the-manor'], x: 26, y: 57 },
  { slotKeys: ['moonlit-town'], x: 59, y: 42 },
  { slotKeys: ['whispering-forest'], x: 80, y: 53 }
];

export const MAP_SEQUENCE: MapId[] = ['overworld', 'manor', 'town', 'forest'];

export const MAP_DEFINITIONS: Record<MapId, MapDefinition> = {
  overworld: {
    id: 'overworld',
    name: 'Overworld',
    description: 'Track broad territories and anchor expeditions across the vale.',
    image: {
      src: overworldMap,
      alt: 'Stylised moonlit map showing a manor hill, riverside town, and forest glade.'
    },
    anchors: overworldAnchors,
    focusLocations: ['manor', 'town', 'forest']
  },
  manor: {
    id: 'manor',
    name: 'The Manor',
    description: 'Survey the estate grounds to manage sanctums, archives, and expedition prep.',
    image: {
      src: manorMap,
      alt: 'Blueprint illustration of manor rooms connected by luminous hallways.'
    },
    anchors: manorAnchors,
    focusLocations: ['manor']
  },
  town: {
    id: 'town',
    name: 'Moonlit Town',
    description: 'Navigate the village plaza to reach chapel rites and the moonlit market.',
    image: {
      src: townMap,
      alt: 'Gridded town plaza lit by moonlight with highlighted districts.'
    },
    anchors: townAnchors,
    focusLocations: ['town']
  },
  forest: {
    id: 'forest',
    name: 'Whispering Forest',
    description: 'Scout the wilds and manage expeditions into the tangled ways.',
    image: {
      src: forestMap,
      alt: 'Dense forest canopy illustrated in teal gradients with winding paths.'
    },
    anchors: forestAnchors,
    focusLocations: ['forest']
  }
};

export function findAnchorForSlot(map: MapDefinition, slotKey: string): MapSlotAnchor | null {
  return map.anchors.find((anchor) => anchor.slotKeys.includes(slotKey)) ?? null;
}
