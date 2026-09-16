import type { MobFamilyId } from './zones.js';

/**
 * World monsters. They reuse the `Zombie` record and its brain (targeting, flanking, pathing),
 * so a family only has to say what its numbers are and how they grow.
 *
 * Stats are never stored derived on the entity: a family plus a level is enough to compute them,
 * the same way `swordZombieStats(level)` already works for the necromancer's sword zombie.
 */
export interface MobFamily {
  id: MobFamilyId;
  name: string;
  /** Level 1 values; `mobStats` grows them from here. */
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  /** Reach of its attack and the pause between attacks. */
  range: number;
  cooldown: number;
  windup: number;
  /** How far it notices a player. */
  aggro: number;
  /** How far it will chase from its camp before walking back and healing. */
  leash: number;
  /** Experience granted at level 1. */
  xp: number;
  /** A pack fans out around its target instead of queueing at it. */
  packs: boolean;
}

export const MOB_FAMILIES: Record<MobFamilyId, MobFamily> = {
  lobezno: {
    id: 'lobezno',
    name: 'Lobezno',
    hp: 2,
    damage: 0.5,
    speed: 150,
    radius: 12,
    range: 24,
    cooldown: 1,
    windup: 0.25,
    aggro: 260,
    leash: 620,
    xp: 8,
    packs: true,
  },
  jabali: {
    id: 'jabali',
    name: 'Jabalí',
    hp: 4,
    damage: 1,
    speed: 105,
    radius: 15,
    range: 30,
    cooldown: 1.6,
    windup: 0.45,
    aggro: 200,
    leash: 520,
    xp: 14,
    packs: false,
  },
};

/** Growth per level. Gentle enough that two levels of difference is a fight, not a wall. */
const HP_PER_LEVEL = 0.38;
const DAMAGE_PER_LEVEL = 0.22;
const SPEED_PER_LEVEL = 0.03;
const SPEED_CAP = 0.3;
const XP_PER_LEVEL = 0.55;

/** Everything a mob of this family and level is worth, derived on demand. */
export function mobStats(familyId: MobFamilyId, level: number) {
  const family = MOB_FAMILIES[familyId];
  const up = Math.max(0, level - 1);
  return {
    family,
    hp: Math.round(family.hp * (1 + HP_PER_LEVEL * up) * 10) / 10,
    damage: Math.round(family.damage * (1 + DAMAGE_PER_LEVEL * up) * 100) / 100,
    speed: family.speed * (1 + Math.min(SPEED_CAP, SPEED_PER_LEVEL * up)),
    radius: family.radius,
    range: family.range,
    cooldown: family.cooldown,
    windup: family.windup,
    aggro: family.aggro,
    leash: family.leash,
  };
}

/** Experience a kill grants, before any penalty for out-levelling the prey. */
export function mobXp(familyId: MobFamilyId, level: number) {
  return Math.round(MOB_FAMILIES[familyId].xp * (1 + XP_PER_LEVEL * Math.max(0, level - 1)));
}

/**
 * Killing something far below you stops paying. Five levels above the mob and it is worthless,
 * so grinding the starter valley cannot carry a character through the whole world.
 */
export function xpFor(familyId: MobFamilyId, mobLevel: number, killerLevel: number) {
  const gap = killerLevel - mobLevel;
  if (gap >= 5) return 0;
  const scale = gap <= 0 ? 1 : 1 - gap * 0.2;
  return Math.max(1, Math.round(mobXp(familyId, mobLevel) * scale));
}
