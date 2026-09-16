import type { Bounds, Rect, Terrain, Vec } from '../index.js';

/**
 * World zones. Unlike an arena map, a zone is much larger than the screen, carries its own
 * bounds, and is reached from another zone through a portal that may demand a level.
 *
 * Only the starter valley exists for now. The ids of the zones it leads to are declared here so
 * the portals, the world map and the level gates can be written once and filled in later.
 */
export type ZoneId =
  | 'umbral'
  | 'bosque'
  | 'ceniza'
  | 'cienaga'
  | 'kaelun'
  | 'desfiladero'
  | 'vael'
  | 'catacumbas'
  | 'cristal'
  | 'volcan'
  | 'aguja';

/** Families of world monsters. The stats and skill kit of each one live in `mobs.ts`. */
export type MobFamilyId = 'lobezno' | 'jabali';

export interface Spawner {
  familyId: MobFamilyId;
  level: number;
  /** Centre of the camp. Mobs wander back here and are reborn around it. */
  at: Vec;
  /** Mobs spawn within this radius, and stop chasing beyond `leash` from it. */
  radius: number;
  count: number;
  respawnSeconds: number;
  /** What the camp guards, if anything. Shown to the player and used to place loot. */
  guards?: 'chest' | 'shrine' | 'portal';
}

export interface Portal {
  to: ZoneId;
  /** The strip a player walks into to travel. */
  area: Rect;
  /** Below this level the border refuses to let you through. */
  minLevel: number;
  /** Where you appear on the other side. */
  arrive: Vec;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  description: string;
  theme: 'valle' | 'bosque' | 'ceniza' | 'cienaga' | 'ruinas' | 'fuego' | 'hielo' | 'cripta';
  terrain: Terrain;
  /** A sanctuary refuses every player-to-player hit; the wild does not. */
  pvp: 'safe' | 'wild';
  /** Recommended level to set foot here; portals into it enforce it. */
  minLevel: number;
  /** Where a character with no saved position starts. */
  entry: Vec;
  /** Respawn and save point. */
  shrine: Vec;
  spawners: Spawner[];
  portals: Portal[];
  /** Roofed zones (caves) forbid flying; open ones allow it. */
  roofed: boolean;
}

const ZONE_INSET = 20;
/** Bounds for a zone of this size, inset like the arena so nothing touches the edge. */
export const zoneBounds = (width: number, height: number): Bounds => ({
  minX: ZONE_INSET,
  minY: ZONE_INSET,
  maxX: width - ZONE_INSET,
  maxY: height - ZONE_INSET,
});

const UMBRAL_WIDTH = 3840;
const UMBRAL_HEIGHT = 2160;

/**
 * Valle de Umbral: the starter valley. Sanctuary, so nobody can be attacked here, with the
 * shrine at the village and the first camps out in the meadow to the east and south.
 */
const umbralWalls: Rect[] = [
  // Village wall, open to the east towards the meadow.
  { x: 420, y: 520, w: 640, h: 26 },
  { x: 420, y: 520, w: 26, h: 430 },
  { x: 420, y: 924, w: 640, h: 26 },
  // Cottages inside the village.
  { x: 520, y: 620, w: 120, h: 90 },
  { x: 760, y: 620, w: 120, h: 90 },
  { x: 520, y: 790, w: 120, h: 90 },
  // Rocky spine that splits the valley, with a pass in the middle.
  { x: 1700, y: 180, w: 90, h: 620 },
  { x: 1700, y: 1180, w: 90, h: 800 },
  // Boulders scattered across the meadow.
  { x: 2340, y: 640, w: 150, h: 150 },
  { x: 2900, y: 1420, w: 190, h: 120 },
  { x: 1280, y: 1520, w: 130, h: 130 },
  // Cliff along the north edge.
  { x: 200, y: 140, w: 1200, h: 70 },
  { x: 2200, y: 140, w: 1400, h: 70 },
];

export const ZONES: Partial<Record<ZoneId, ZoneDefinition>> = {
  umbral: {
    id: 'umbral',
    name: 'Valle de Umbral',
    description: 'Un valle verde con una aldea, un altar y las primeras bestias mansas.',
    theme: 'valle',
    terrain: { walls: umbralWalls, bounds: zoneBounds(UMBRAL_WIDTH, UMBRAL_HEIGHT) },
    pvp: 'safe',
    minLevel: 1,
    entry: { x: 740, y: 760 },
    shrine: { x: 980, y: 740 },
    roofed: false,
    spawners: [
      { familyId: 'lobezno', level: 1, at: { x: 1440, y: 700 }, radius: 220, count: 3, respawnSeconds: 25 },
      { familyId: 'lobezno', level: 2, at: { x: 2180, y: 1180 }, radius: 240, count: 4, respawnSeconds: 30 },
      { familyId: 'jabali', level: 2, at: { x: 1180, y: 1560 }, radius: 200, count: 3, respawnSeconds: 30 },
      {
        familyId: 'jabali',
        level: 4,
        at: { x: 3080, y: 1500 },
        radius: 200,
        count: 4,
        respawnSeconds: 45,
        guards: 'chest',
      },
    ],
    portals: [
      {
        to: 'bosque',
        area: { x: UMBRAL_WIDTH - 90, y: 860, w: 70, h: 440 },
        minLevel: 5,
        arrive: { x: 120, y: 1080 },
      },
    ],
  },
};

export const DEFAULT_ZONE: ZoneId = 'umbral';
export const ZONE_IDS = Object.keys(ZONES) as ZoneId[];
export const validZone = (value: unknown): value is ZoneId =>
  typeof value === 'string' && ZONE_IDS.includes(value as ZoneId);
/** Every zone that exists today; the rest of the ids are still only portal destinations. */
export const zone = (id: ZoneId): ZoneDefinition => ZONES[id] ?? ZONES[DEFAULT_ZONE]!;
