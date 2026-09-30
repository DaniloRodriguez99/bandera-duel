/**
 * The shapes of combat, as plain numbers: a blade's sweep, the strip a vertical cut covers and the
 * front of a travelling slash. The simulation tests hits against them and the client draws them
 * from the same functions, so what the sword went through is what it hit.
 *
 * Pure on purpose: nothing here knows about players, walls or the rules.
 */

export interface Point {
  x: number;
  y: number;
}

/** Ascending `[x, y]` points, read as straight lines between them and flat beyond both ends. */
export type Curve = readonly (readonly [number, number])[];

export function curve(points: Curve, x: number): number {
  if (!points.length) return 0;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x > x1) continue;
    const [x0, y0] = points[i - 1];
    return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

/** An angle folded into (−π, π]. */
export const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * The slice a blade passes through: around `x`,`y`, from angle `from` to angle `to` (the short way
 * round, so under half a turn), between two radii.
 */
export interface Sector extends Point {
  from: number;
  to: number;
  inner: number;
  outer: number;
}

/** Whether a round body touches the slice. */
export function sectorHit(sector: Sector, target: Point, radius: number): boolean {
  const dx = target.x - sector.x;
  const dy = target.y - sector.y;
  const gap = Math.hypot(dx, dy);
  if (gap > sector.outer + radius || gap + radius < sector.inner) return false;
  // Standing on the hilt: every direction is this body's direction.
  if (gap <= radius) return true;
  const sweep = wrapAngle(sector.to - sector.from);
  // A body this wide covers this much of the turn at its distance.
  const slack = Math.asin(Math.min(1, radius / gap));
  const offCentre = wrapAngle(Math.atan2(dy, dx) - (sector.from + sweep / 2));
  return Math.abs(offCentre) <= Math.abs(sweep) / 2 + slack;
}

/** The strip ahead of `x`,`y` along `angle`, from `near` to `far`, `halfWidth` to each side. */
export interface Lane extends Point {
  angle: number;
  near: number;
  far: number;
  halfWidth: number;
}

/** Where a point sits seen from an origin facing `angle`: how far ahead and how far to its right. */
export function localTo(origin: Point, angle: number, point: Point) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { along: dx * cos + dy * sin, across: -dx * sin + dy * cos };
}

export function laneHit(lane: Lane, target: Point, radius: number): boolean {
  const { along, across } = localTo(lane, lane.angle, target);
  return along >= lane.near - radius && along <= lane.far + radius && Math.abs(across) <= lane.halfWidth + radius;
}

export type Blade = ({ kind: 'arc' } & Sector) | ({ kind: 'lane' } & Lane);
export const bladeHit = (blade: Blade, target: Point, radius: number) =>
  blade.kind === 'arc' ? sectorHit(blade, target, radius) : laneHit(blade, target, radius);

/**
 * Whether something small flying from `from` to `to` crosses a blade's shape. Sampled along the
 * way, so a thin slice is not skipped between the two ends.
 */
export function bladeCrosses(blade: Blade, from: Point, to: Point, radius: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (bladeHit(blade, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, radius)) return true;
  }
  return false;
}

/**
 * A travelling slash, as the line it draws across its path. It leaves `x`,`y` heading `angle`;
 * its front is `halfWidth` wide to each side, widens by `spread` per unit travelled, and bows
 * forward in the middle by `bow`, so the tips trail the centre like a crescent.
 */
export interface WaveShape extends Point {
  angle: number;
  halfWidth: number;
  spread: number;
  bow: number;
  thickness: number;
}

export const waveHalfWidth = (wave: WaveShape, travelled: number) => wave.halfWidth + wave.spread * travelled;

/** How far ahead of the origin the front is at `across` (−1 to 1 over its width) once it has `travelled`. */
export const waveFront = (wave: WaveShape, travelled: number, across: number) =>
  travelled - wave.bow * across * across;

/** A point of the front, in the world. */
export function wavePoint(wave: WaveShape, travelled: number, across: number): Point {
  const ahead = waveFront(wave, travelled, across);
  const aside = across * waveHalfWidth(wave, travelled);
  const cos = Math.cos(wave.angle);
  const sin = Math.sin(wave.angle);
  return { x: wave.x + cos * ahead - sin * aside, y: wave.y + sin * ahead + cos * aside };
}

/**
 * Where each part of the front set out from. That part travels in a straight line from here, so a
 * wall between this point and a body shadows the body from it.
 */
export const waveSource = (wave: WaveShape, across: number): Point => wavePoint(wave, 0, across);

/**
 * Whether the front, advancing from `before` to `after`, passes over a round body. Returns the
 * body's place across the front (−1 to 1), or null when the front misses it.
 */
export function waveTouch(
  wave: WaveShape,
  before: number,
  after: number,
  target: Point,
  radius: number,
): number | null {
  const { along, across } = localTo(wave, wave.angle, target);
  // As wide as the front is where the body stands, not where this step ends: a slash that widens
  // as it goes must not reach back to the side of what it has already passed.
  const halfWidth = waveHalfWidth(wave, Math.max(0, Math.min(after, along)));
  if (Math.abs(across) > halfWidth + radius) return null;
  const place = halfWidth > 0 ? clamp(across / halfWidth, -1, 1) : 0;
  const lag = wave.bow * place * place;
  const reach = wave.thickness / 2 + radius;
  return along >= before - lag - reach && along <= after - lag + reach ? place : null;
}

/** A stretch cut out of a wave's front, across its width, and the share of its damage taken away. */
export interface WaveGap {
  from: number;
  to: number;
  strength: number;
}

/** The share of its damage a wave still carries at this place of its front. */
export function waveStrength(gaps: readonly WaveGap[], across: number): number {
  let left = 1;
  for (const gap of gaps) if (across >= gap.from && across <= gap.to) left = Math.min(left, 1 - gap.strength);
  return Math.max(0, left);
}
