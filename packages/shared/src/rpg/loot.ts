import { SKILLS_WORLD, schoolOpen, type Rarity } from './skills.js';
import { COPY_CHARGE_CAP, ITEMS, type ItemDefinition } from './items.js';
import type { ChestTier } from './zones.js';
import type { Character } from './character.js';

export type { ChestTier };

export interface ChestRules {
  name: string;
  /** Seconds standing next to it, untouched, to open it. */
  openSeconds: number;
  /** Seconds before an emptied chest can return (it also waits for its camp to be whole). */
  respawnSeconds: number;
  drops: number;
  /** Chance of one drop more than `drops`, up to `maxDrops`. */
  secondChance: number;
  maxDrops: number;
  weights: Partial<Record<Rarity, number>>;
  /** Share of drops that are grimoires rather than equipment. */
  grimoireShare: number;
  /** Chance, once per chest, that the last drop becomes a Fragment of Reflection. */
  copyChance: number;
  /** The first drop is at least epic. */
  forceEpic: boolean;
}

export const CHEST_TIERS: Record<ChestTier, ChestRules> = {
  comun: {
    name: 'Cofre común',
    openSeconds: 1.5,
    respawnSeconds: 180,
    drops: 1,
    secondChance: 0.35,
    maxDrops: 2,
    weights: { comun: 80, rara: 20 },
    grimoireShare: 0.45,
    copyChance: 0,
    forceEpic: false,
  },
  raro: {
    name: 'Cofre raro',
    openSeconds: 2.5,
    respawnSeconds: 420,
    drops: 2,
    secondChance: 0,
    maxDrops: 2,
    weights: { comun: 30, rara: 55, epica: 15 },
    grimoireShare: 0.5,
    copyChance: 0,
    forceEpic: false,
  },
  legendario: {
    name: 'Cofre legendario',
    openSeconds: 4,
    respawnSeconds: 1200,
    drops: 3,
    secondChance: 0,
    maxDrops: 3,
    weights: { rara: 45, epica: 40, legendaria: 15 },
    grimoireShare: 0.5,
    copyChance: 0.015,
    forceEpic: true,
  },
};

const RARITY_ORDER: Rarity[] = ['comun', 'rara', 'epica', 'legendaria', 'unica'];

export interface LootRoll {
  tier: ChestTier;
  campLevel: number;
  character: Pick<Character, 'skills' | 'affinities' | 'trees' | 'copyCharges'>;
  random: () => number;
}

function pickWeighted<T>(entries: [T, number][], random: () => number): T | undefined {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return undefined;
  let roll = random() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll < 0) return value;
  }
  return entries.at(-1)?.[0];
}

/**
 * What a chest gives. Pure and seedable. Equipment near the camp's level; grimoires favour
 * doors the character already has open, never teach a monster's skill or the impostor's eye, and
 * never what the character already knows. An empty pool steps down a rarity, and in the end a
 * practice manual is always there.
 */
export function rollLoot({ tier, campLevel, character, random }: LootRoll): string[] {
  const rules = CHEST_TIERS[tier];
  const count = Math.min(rules.maxDrops, rules.drops + (random() < rules.secondChance ? 1 : 0));
  const drops: string[] = [];
  for (let i = 0; i < count; i++) {
    let rarity = pickWeighted(Object.entries(rules.weights) as [Rarity, number][], random) ?? 'comun';
    if (i === 0 && rules.forceEpic && RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf('epica')) rarity = 'epica';
    const grimoire = random() < rules.grimoireShare;
    drops.push(pickItem(rarity, grimoire, campLevel, character, drops, random));
  }
  const canCopy = !!character.skills.ojo_impostor && character.copyCharges < COPY_CHARGE_CAP;
  if (canCopy && rules.copyChance > 0 && random() < rules.copyChance) drops[drops.length - 1] = 'fragmento_reflejo';
  return drops;
}

function pickItem(
  rarity: Rarity,
  grimoire: boolean,
  campLevel: number,
  character: LootRoll['character'],
  already: string[],
  random: () => number,
): string {
  for (let r = RARITY_ORDER.indexOf(rarity); r >= 0; r--) {
    const at = RARITY_ORDER[r];
    const pool = grimoire ? grimoirePool(at, character, already) : equipmentPool(at, campLevel);
    const choice = pickWeighted(pool, random);
    if (choice) return choice.id;
  }
  return 'manual_practica';
}

function equipmentPool(rarity: Rarity, campLevel: number): [ItemDefinition, number][] {
  const fits = Object.values(ITEMS).filter(
    (item) => item.slot && !item.starter && item.rarity === rarity && item.level <= campLevel + 2,
  );
  // Close to the camp's level, but an old common is better than nothing.
  return fits.map((item) => [item, item.level >= campLevel - 8 ? 3 : 1]);
}

function grimoirePool(rarity: Rarity, character: LootRoll['character'], already: string[]): [ItemDefinition, number][] {
  const pool: [ItemDefinition, number][] = [];
  for (const item of Object.values(ITEMS)) {
    if (item.kind !== 'grimorio' || item.rarity !== rarity || !item.grimoire) continue;
    const effect = item.grimoire;
    if (effect.kind === 'copy') continue;
    if (effect.kind === 'teach') {
      const skill = SKILLS_WORLD[effect.skillId];
      if (!skill || character.skills[skill.id] || already.includes(item.id)) continue;
      const open = skill.school === 'cuerpo' || schoolOpen(skill, character.affinities, character.trees);
      pool.push([item, open ? 3 : 1]);
    } else pool.push([item, effect.kind === 'affinity' ? 0.4 : 0.6]);
  }
  return pool;
}
