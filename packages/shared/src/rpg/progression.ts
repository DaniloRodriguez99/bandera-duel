/**
 * Character progression: the numbers behind levelling up.
 *
 * Only what the playable slice needs lives here — level, experience, the five attributes and the
 * pools they feed. Affinities, their seven ranks and the cultivation multiplier arrive with the
 * skill trees; this file is deliberately the boring half.
 */

export type StatId = 'might' | 'agility' | 'perception' | 'spirit' | 'vigor';
export const STAT_IDS: StatId[] = ['might', 'agility', 'perception', 'spirit', 'vigor'];
export type Stats = Record<StatId, number>;

/** A child at level 1: enough to swing a stick, not enough to survive a mistake. */
export const BASE_STATS: Stats = { might: 3, agility: 3, perception: 3, spirit: 3, vigor: 3 };

/** Points the player places by hand on each level up. */
export const POINTS_PER_LEVEL = 3;

export const MAX_LEVEL = 60;

/**
 * Experience needed to go from `level` to the next one. Superlinear, so the starter valley can
 * carry a character for a handful of levels and no further.
 */
export function xpToLevel(level: number) {
  const l = Math.max(1, level);
  return Math.round(40 * Math.pow(l, 1.45));
}

/** Total experience from level 1 up to the start of `level`. */
export function xpTotalTo(level: number) {
  let total = 0;
  for (let l = 1; l < Math.max(1, level); l++) total += xpToLevel(l);
  return total;
}

export interface LevelUp {
  level: number;
  unspent: number;
  gained: number;
}

/**
 * Applies experience and reports every level crossed, so a single big kill can raise more than
 * one level and the notifications still read one by one.
 */
export function applyXp(level: number, xp: number, gained: number): LevelUp & { xp: number } {
  let nextLevel = level;
  let pool = xp + Math.max(0, gained);
  let levels = 0;
  while (nextLevel < MAX_LEVEL && pool >= xpToLevel(nextLevel)) {
    pool -= xpToLevel(nextLevel);
    nextLevel++;
    levels++;
  }
  if (nextLevel >= MAX_LEVEL) pool = 0;
  return {
    level: nextLevel,
    xp: pool,
    unspent: levels * POINTS_PER_LEVEL,
    gained: levels,
  };
}

/** Health comes from Vigor, with a floor so a mage is fragile but not paper. */
export function maxHpFor(stats: Stats) {
  return Math.round((6 + stats.vigor * 1.6) * 10) / 10;
}

/**
 * Mana comes from Spirit. A character who never invested in it still has a trickle, enough to
 * cast the one skill fate handed them, and nowhere near enough to lean on it.
 */
export function maxManaFor(stats: Stats) {
  return Math.round(10 + stats.spirit * 6);
}

/** Mana regenerated per second, out of combat and in. */
export function manaRegenFor(stats: Stats) {
  return Math.round((0.8 + stats.spirit * 0.12) * 100) / 100;
}

/** Movement bonus from Agility, capped so nobody outruns the world. */
export function speedScaleFor(stats: Stats) {
  return 1 + Math.min(0.25, stats.agility * 0.008);
}
