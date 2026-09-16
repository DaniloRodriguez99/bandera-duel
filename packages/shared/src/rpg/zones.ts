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
export type MobFamilyId = 'lobezno' | 'jabali' | 'arana' | 'saqueador' | 'ghoul';

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

const BOSQUE_WIDTH = 4200;
const BOSQUE_HEIGHT = 2400;
/** Bosque Susurrante: thick tree clusters, and the spider cave walled off in the north-east. */
const bosqueWalls: Rect[] = [
  { x: 600, y: 300, w: 260, h: 220 },
  { x: 1100, y: 1500, w: 300, h: 260 },
  { x: 1500, y: 500, w: 220, h: 300 },
  { x: 2100, y: 1100, w: 280, h: 200 },
  { x: 2600, y: 300, w: 240, h: 260 },
  { x: 2900, y: 1700, w: 320, h: 240 },
  { x: 3400, y: 800, w: 260, h: 280 },
  // Cueva de las Arañas: a walled hollow open to the south.
  { x: 3500, y: 140, w: 500, h: 60 },
  { x: 3500, y: 140, w: 60, h: 440 },
  { x: 3940, y: 140, w: 60, h: 440 },
];

const CENIZA_WIDTH = 4000;
const CENIZA_HEIGHT = 2400;
/** Campos de Ceniza: burned farmhouses and the collapsed corner of a barn. */
const cenizaWalls: Rect[] = [
  { x: 700, y: 600, w: 200, h: 160 },
  { x: 1400, y: 1600, w: 240, h: 180 },
  { x: 2000, y: 700, w: 300, h: 60 },
  { x: 2000, y: 700, w: 60, h: 300 },
  { x: 2800, y: 1400, w: 220, h: 220 },
  { x: 3300, y: 500, w: 200, h: 180 },
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
        // Clear of the boulder at x 2900–3090: placed inside it, the camp's boars were born in rock.
        at: { x: 3240, y: 1500 },
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
        arrive: { x: 160, y: 1080 },
      },
    ],
  },
  bosque: {
    id: 'bosque',
    name: 'Bosque Susurrante',
    description: 'Lobos en manada, jabalíes y la Cueva de las Arañas. Acá ya nadie te protege.',
    theme: 'bosque',
    terrain: { walls: bosqueWalls, bounds: zoneBounds(BOSQUE_WIDTH, BOSQUE_HEIGHT) },
    pvp: 'wild',
    minLevel: 5,
    entry: { x: 160, y: 1080 },
    shrine: { x: 380, y: 1080 },
    roofed: false,
    spawners: [
      { familyId: 'lobezno', level: 5, at: { x: 900, y: 1100 }, radius: 240, count: 4, respawnSeconds: 30 },
      { familyId: 'jabali', level: 6, at: { x: 1900, y: 1900 }, radius: 240, count: 3, respawnSeconds: 35 },
      {
        familyId: 'arana',
        level: 7,
        at: { x: 3750, y: 380 },
        radius: 160,
        count: 5,
        respawnSeconds: 30,
        guards: 'chest',
      },
      { familyId: 'lobezno', level: 8, at: { x: 2700, y: 1300 }, radius: 260, count: 5, respawnSeconds: 40 },
      { familyId: 'saqueador', level: 9, at: { x: 3300, y: 2000 }, radius: 220, count: 3, respawnSeconds: 45 },
    ],
    portals: [
      { to: 'umbral', area: { x: 20, y: 880, w: 50, h: 400 }, minLevel: 1, arrive: { x: 3640, y: 1080 } },
      {
        to: 'ceniza',
        area: { x: BOSQUE_WIDTH - 90, y: 1000, w: 70, h: 400 },
        minLevel: 10,
        arrive: { x: 160, y: 1200 },
      },
    ],
  },
  ceniza: {
    id: 'ceniza',
    name: 'Campos de Ceniza',
    description: 'Granjas quemadas, saqueadores y el primer elite que no perdona errores.',
    theme: 'ceniza',
    terrain: { walls: cenizaWalls, bounds: zoneBounds(CENIZA_WIDTH, CENIZA_HEIGHT) },
    pvp: 'wild',
    minLevel: 10,
    entry: { x: 160, y: 1200 },
    shrine: { x: 360, y: 1200 },
    roofed: false,
    spawners: [
      { familyId: 'jabali', level: 11, at: { x: 1000, y: 1200 }, radius: 260, count: 4, respawnSeconds: 40 },
      { familyId: 'saqueador', level: 12, at: { x: 2200, y: 900 }, radius: 220, count: 4, respawnSeconds: 45 },
      { familyId: 'arana', level: 13, at: { x: 3000, y: 2000 }, radius: 200, count: 5, respawnSeconds: 40 },
      // Ghouls wandered out of the swamp beyond the eastern portal. Stealing from one opens the
      // hidden road that ends in the vampire.
      { familyId: 'ghoul', level: 14, at: { x: 3650, y: 1900 }, radius: 200, count: 4, respawnSeconds: 45 },
      {
        familyId: 'saqueador',
        level: 14,
        at: { x: 3500, y: 1100 },
        radius: 240,
        count: 5,
        respawnSeconds: 60,
        guards: 'chest',
      },
    ],
    portals: [
      { to: 'bosque', area: { x: 20, y: 1000, w: 50, h: 400 }, minLevel: 5, arrive: { x: 3980, y: 1200 } },
      {
        to: 'cienaga',
        area: { x: CENIZA_WIDTH - 90, y: 1000, w: 70, h: 400 },
        minLevel: 15,
        arrive: { x: 160, y: 1200 },
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
