import type { Rect, Terrain, Vec } from '../index.js';
import { ZONES, zone, type ZoneDefinition, type ZoneId } from './zones.js';

/**
 * What the ground of a zone looks like, tile by tile.
 *
 * Deterministic from the zone's id, so the client paints the world and draws the minimap from the
 * same picture, and a test can pin it. Purely visual: what blocks a body is still the zone's walls,
 * and every wall is painted as the obstacle its biome makes (rock, trees, a burned house), so what
 * looks solid is exactly what is solid. Water here is shallow and walkable, as in Warcraft III.
 */

export const TILE = 40;

export const TILES = [
  'grass',
  'grassDark',
  'grassLight',
  'flowers',
  'dirt',
  'road',
  'water',
  'waterDeep',
  'sand',
  'moss',
  'ash',
  'ashDark',
  'ember',
  'mud',
  'bog',
  'obstacle',
] as const;
export type TileKind = (typeof TILES)[number];

export interface TileMap {
  cols: number;
  rows: number;
  /** Index into TILES, row by row. */
  tiles: Uint8Array;
}

const T = Object.fromEntries(TILES.map((name, i) => [name, i])) as Record<TileKind, number>;

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1): big soft blobs at `scale` tiles. */
function noise(x: number, y: number, scale: number, seed: number) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

const seedOf = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);

const cache = new Map<ZoneId, TileMap>();
const roadCache = new Map<ZoneId, Vec[][]>();

/**
 * The worn paths from the shrine to every camp and portal, as polylines: the ground draws them as
 * smooth strokes and the minimap as a line of tiles.
 */
export function roadPaths(zoneId: ZoneId): Vec[][] {
  let paths = roadCache.get(zoneId);
  if (paths) return paths;
  const def = zone(zoneId);
  const seed = seedOf(def.id);
  paths = landmarks(def)
    .slice(1)
    .map((target) => {
      const from = def.shrine;
      const steps = Math.max(2, Math.ceil(Math.hypot(target.x - from.x, target.y - from.y) / (TILE * 1.5)));
      const nx = -(target.y - from.y);
      const ny = target.x - from.x;
      const len = Math.hypot(nx, ny) || 1;
      const points: Vec[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const wobble = (noise(i, 0, 3, seed + Math.round(target.x)) - 0.5) * 2.4 * TILE * Math.sin(Math.PI * t);
        points.push({ x: from.x + (target.x - from.x) * t + (nx / len) * wobble, y: from.y + (target.y - from.y) * t + (ny / len) * wobble });
      }
      return points;
    });
  roadCache.set(zoneId, paths);
  return paths;
}

export function tileMap(zoneId: ZoneId): TileMap {
  let map = cache.get(zoneId);
  if (!map) cache.set(zoneId, (map = paint(zone(zoneId))));
  return map;
}

/** Places that must stay readable: never under water, and joined by roads. */
function landmarks(def: ZoneDefinition): Vec[] {
  return [
    def.shrine,
    def.entry,
    ...def.spawners.map((s) => s.at),
    ...def.portals.map((p) => ({ x: p.area.x + p.area.w / 2, y: p.area.y + p.area.h / 2 })),
    // Where other zones' portals drop a traveller: arriving in a lake would strand them.
    ...Object.values(ZONES).flatMap((other) => other?.portals.filter((p) => p.to === def.id).map((p) => p.arrive) ?? []),
  ];
}

function paint(def: ZoneDefinition): TileMap {
  const b = def.terrain.bounds;
  const cols = Math.ceil((b.maxX + b.minX) / TILE);
  const rows = Math.ceil((b.maxY + b.minY) / TILE);
  const tiles = new Uint8Array(cols * rows);
  const seed = seedOf(def.id);
  const marks = landmarks(def);
  const nearMark = (cx: number, cy: number, radius: number) =>
    marks.some((m) => Math.hypot(m.x - cx, m.y - cy) < radius);

  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      const ground = noise(col, row, 9, seed);
      const detail = hash(col, row, seed + 3);
      const wet = noise(col, row, 14, seed + 11);
      let kind: TileKind;
      switch (def.theme) {
        case 'bosque':
          kind = ground > 0.62 ? 'grassDark' : ground < 0.3 ? 'moss' : 'grass';
          if (detail > 0.985) kind = 'flowers';
          if (wet > 0.74 && !nearMark(cx, cy, 260)) kind = wet > 0.8 ? 'waterDeep' : 'water';
          break;
        case 'cienaga':
          kind = ground > 0.58 ? 'mud' : ground < 0.3 ? 'moss' : 'grassDark';
          if (wet > 0.58 && !nearMark(cx, cy, 240)) kind = wet > 0.7 ? 'waterDeep' : 'bog';
          if (detail > 0.99) kind = 'flowers';
          break;
        case 'ceniza':
          kind = ground > 0.6 ? 'ashDark' : ground < 0.28 ? 'dirt' : 'ash';
          if (detail > 0.992) kind = 'ember';
          break;
        default:
          kind = ground > 0.66 ? 'grassDark' : ground < 0.26 ? 'grassLight' : 'grass';
          if (detail > 0.975) kind = 'flowers';
          if (wet > 0.76 && !nearMark(cx, cy, 280)) kind = wet > 0.82 ? 'waterDeep' : 'water';
      }
      tiles[row * cols + col] = T[kind];
    }

  // Shores: water next to land turns to sand (valley) or moss (forest), so ponds have an edge.
  const at = (col: number, row: number) => tiles[row * cols + col];
  const shore = def.theme === 'bosque' ? T.moss : T.sand;
  const copy = tiles.slice();
  for (let row = 1; row < rows - 1; row++)
    for (let col = 1; col < cols - 1; col++) {
      const here = at(col, row);
      if (here === T.water || here === T.waterDeep) continue;
      if (here === T.bog) continue;
      const wetNear = [at(col + 1, row), at(col - 1, row), at(col, row + 1), at(col, row - 1)].some(
        (t) => t === T.water || t === T.waterDeep,
      );
      if (wetNear && def.theme !== 'ceniza') copy[row * cols + col] = shore;
    }
  tiles.set(copy);

  // Roads, one tile wide on the tile picture; the ground paints them as smooth strokes.
  const road = def.theme === 'ceniza' ? T.dirt : T.road;
  for (const path of roadPaths(def.id))
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b2 = path[i];
      const steps = Math.ceil(Math.hypot(b2.x - a.x, b2.y - a.y) / (TILE / 3));
      for (let k = 0; k <= steps; k++) {
        const col = Math.floor((a.x + ((b2.x - a.x) * k) / steps) / TILE);
        const row = Math.floor((a.y + ((b2.y - a.y) * k) / steps) / TILE);
        if (col >= 0 && row >= 0 && col < cols && row < rows) tiles[row * cols + col] = road;
      }
    }

  // Obstacles last: whatever blocks a body is painted solid, over roads and water alike.
  const solid = (r: Rect) => {
    for (let row = Math.floor(r.y / TILE); row < Math.ceil((r.y + r.h) / TILE); row++)
      for (let col = Math.floor(r.x / TILE); col < Math.ceil((r.x + r.w) / TILE); col++)
        if (col >= 0 && row >= 0 && col < cols && row < rows) tiles[row * cols + col] = T.obstacle;
  };
  for (const wall of def.terrain.walls) solid(wall);
  return { cols, rows, tiles };
}

/** Colours per tile and biome, shared by the ground and the minimap. */
export const TILE_COLORS: Record<ZoneDefinition['theme'], Partial<Record<TileKind, number>>> & {
  base: Record<TileKind, number>;
} = {
  base: {
    grass: 0x3f7a35,
    grassDark: 0x2f6128,
    grassLight: 0x5a8f3c,
    flowers: 0x6b9c44,
    dirt: 0x7a6040,
    road: 0x8a7050,
    water: 0x3f79a8,
    waterDeep: 0x2a5a88,
    sand: 0xb8a672,
    moss: 0x355a2c,
    ash: 0x5c5650,
    ashDark: 0x45403b,
    ember: 0x8f3b24,
    mud: 0x4a4230,
    bog: 0x3d5446,
    obstacle: 0x23261f,
  },
  valle: {},
  bosque: { grass: 0x2f6128, grassDark: 0x1f4a1f, grassLight: 0x3f7a35, road: 0x6e5838, water: 0x2f6a78, waterDeep: 0x205461, obstacle: 0x14301a },
  ceniza: { dirt: 0x6e5a44, obstacle: 0x2a2320 },
  cienaga: { grassDark: 0x34452e, moss: 0x2f3f2a, waterDeep: 0x24403a, sand: 0x57503a, road: 0x5a4d36, flowers: 0x6d7a45, obstacle: 0x1b1f1a },
  ruinas: {},
  fuego: {},
  hielo: {},
  cripta: {},
};

export const tileColor = (theme: ZoneDefinition['theme'], kind: TileKind) => TILE_COLORS[theme][kind] ?? TILE_COLORS.base[kind];

const waterCache = new Map<ZoneId, Rect[]>();

/** The zone's water as rectangles, one per run of water tiles in a row. Roads over it are fords. */
export function waterRects(zoneId: ZoneId): Rect[] {
  let rects = waterCache.get(zoneId);
  if (rects) return rects;
  const map = tileMap(zoneId);
  const wet = new Set([T.water, T.waterDeep]);
  rects = [];
  for (let row = 0; row < map.rows; row++) {
    let col = 0;
    while (col < map.cols) {
      if (!wet.has(map.tiles[row * map.cols + col])) {
        col++;
        continue;
      }
      let run = 1;
      while (col + run < map.cols && wet.has(map.tiles[row * map.cols + col + run])) run++;
      rects.push({ x: col * TILE, y: row * TILE, w: run * TILE, h: TILE });
      col += run;
    }
  }
  waterCache.set(zoneId, rects);
  return rects;
}

const groundCache = new Map<string, Terrain>();

/**
 * The ground a body moves on in a zone. Water stops everyone except those who can ride it; one
 * object per zone and case, so the pathfinding grid is built once for each.
 */
export function worldTerrain(zoneId: ZoneId, surfs = false): Terrain {
  const key = `${zoneId}:${surfs}`;
  let terrain = groundCache.get(key);
  if (!terrain) {
    const base = zone(zoneId).terrain;
    terrain = surfs ? { walls: base.walls, bounds: base.bounds } : { walls: base.walls, bounds: base.bounds, water: waterRects(zoneId) };
    groundCache.set(key, terrain);
  }
  return terrain;
}
