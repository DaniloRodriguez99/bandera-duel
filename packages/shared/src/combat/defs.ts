import type { Curve } from './geometry.js';

/**
 * What an ability is made of, as data. A skill says how it charges, what it costs and how it meets
 * other skills; the simulation reads these tables instead of carrying one branch per ability.
 */

// ── Charge ─────────────────────────────────────────────────────────────────────────────────────

/** One step of a held ability: what holding at least `at` seconds gives. */
export interface ChargeTier {
  id: string;
  at: number;
  /** Shown beside the ability while this step applies. */
  label: string;
  /** The colour the charge takes while this step applies; plain steel when absent. */
  tint?: WaveTint;
}

export interface ChargeSpec {
  /** Ascending by `at`. The first starts at 0: a tap is a tier like any other. */
  tiers: readonly ChargeTier[];
  /**
   * Seconds the hold stops counting at. Past the last tier the charge still grows up to here, for
   * abilities that keep scaling beyond their named steps.
   */
  cap: number;
  /**
   * Seconds at which the charge is full. Holding on past it overcharges, up to `cap`. Absent: it is
   * full at `cap` and there is nothing beyond.
   */
  full?: number;
  /** Taking damage drops the charge, and costs this share of the ability's cooldown. Null: it holds. */
  breakOnDamage: { cooldown: number } | null;
  /** Using the mobility slot drops the charge. */
  cancelOnMobility: boolean;
  /** Charging it gives its user away through the bushes: the telegraph is the counterplay. */
  reveals?: boolean;
}

/** The step a hold of `seconds` has reached, and its place in the list. */
export function chargeTier(spec: ChargeSpec, seconds: number): { tier: ChargeTier; index: number } {
  let index = 0;
  for (let i = 1; i < spec.tiers.length; i++) if (seconds >= spec.tiers[i].at - 1e-8) index = i;
  return { tier: spec.tiers[index], index };
}

/** Seconds of hold at which a charge counts as full. */
export const chargeFull = (spec: ChargeSpec) => spec.full ?? spec.cap;

/** 0 to 1 up to a full charge, for bars and glows. */
export const chargeProgress = (spec: ChargeSpec, seconds: number) =>
  chargeFull(spec) > 0 ? Math.max(0, Math.min(1, seconds / chargeFull(spec))) : 1;

/** 0 to 1 across what lies past a full charge; always 0 for the abilities that stop there. */
export const overcharge = (spec: ChargeSpec, seconds: number) =>
  spec.cap > chargeFull(spec)
    ? Math.max(0, Math.min(1, (seconds - chargeFull(spec)) / (spec.cap - chargeFull(spec))))
    : 0;

// ── Resources ──────────────────────────────────────────────────────────────────────────────────

export type ResourceId = 'mana' | 'rage' | 'stamina';

export interface ResourceSpec {
  max: number;
  /** Comes back this much per second, once `regenDelay` seconds have passed since it was last spent. */
  regen: number;
  regenDelay: number;
  /** Seconds without gaining any before it starts to drain, and how fast it then does. */
  decayDelay: number;
  decayRate: number;
}

/**
 * What using a skill takes. Charging can cost too: the longer the hold, the more it has spent, and
 * a pool that runs dry freezes the charge where it is. Holding never eats into what the release
 * itself costs, so a skill that could start can always go out.
 */
export interface ResourceCost {
  resource: ResourceId;
  /** Spent when the skill goes out. */
  amount: number;
  /** Needed to start it, when that is more than what it spends. */
  min?: number;
  /** Spent per second while it charges. */
  perSecond?: number;
}

/** What a skill gives back to its user. */
export interface ResourceGain {
  resource: ResourceId;
  /** Per blow that lands. */
  hit?: number;
  /** Instead of `hit`, for a blow that lands as a critical. */
  crit?: number;
  /** Per enemy skill cut, scaled by how much of it was cut. */
  cut?: number;
  /** Per successful parry. */
  parry?: number;
}

export const RESOURCES: Record<ResourceId, ResourceSpec> = {
  // The knight's: earned by fighting, lost by standing back.
  rage: { max: 100, regen: 0, regenDelay: 0, decayDelay: 4, decayRate: 6 },
  // In the arenas each class brings its own pool (`CLASSES.*.mana`) and it comes back by itself a
  // moment after it was spent. In Lugunica the character sheet sizes it and the world refills it.
  mana: { max: 100, regen: 14, regenDelay: 0.8, decayDelay: 0, decayRate: 0 },
  stamina: { max: 100, regen: 0, regenDelay: 0, decayDelay: 0, decayRate: 0 },
};

/** Development controls a room may carry: the mana limit can be switched off to test freely. */
export interface DevTools {
  manaLimit: boolean;
}

// ── Skill against skill ────────────────────────────────────────────────────────────────────────

export type InteractionType = 'projectile' | 'wave' | 'melee' | 'area';

/** How an attack answers being cut or parried. Every attack in the game carries one. */
export interface InteractionProfile {
  interactionType: InteractionType;
  canBeCut: boolean;
  canBeParried: boolean;
  /** Parried, it flies back at its source; otherwise a parry only stops it. */
  canBeReflected: boolean;
  /** A full cut removes it; otherwise the most a cut does is weaken it. */
  canBeDestroyed: boolean;
  /** The cut power needed to cut it apart. */
  cutResistance: number;
  /** The parry power needed to turn it. */
  parryResistance: number;
  /** Between two attacks that cut each other, the higher one wins. */
  priority: number;
}

const profile = (values: Partial<InteractionProfile> & Pick<InteractionProfile, 'interactionType'>): InteractionProfile => ({
  canBeCut: true,
  canBeParried: true,
  canBeReflected: true,
  canBeDestroyed: true,
  cutResistance: 1,
  parryResistance: 1,
  priority: 1,
  ...values,
});

export const INTERACTIONS = {
  /** Arrows, plain bolts of fire and ice, a monster's thrown stone. */
  lightShot: profile({ interactionType: 'projectile', cutResistance: 0.75 }),
  /** Charged orbs, wind arrows, the zombie mage's fireball. */
  heavyShot: profile({ interactionType: 'projectile', cutResistance: 1, priority: 2 }),
  /** A travelling slash; each one brings its own resistance. */
  wave: profile({ interactionType: 'wave', priority: 3 }),
  /** A blade in the hand: it can be stopped, never sent back. */
  melee: profile({ interactionType: 'melee', canBeCut: false, canBeReflected: false, canBeDestroyed: false }),
  /** Singularidad, traps: nothing to cut or to turn. */
  area: profile({
    interactionType: 'area',
    canBeCut: false,
    canBeParried: false,
    canBeReflected: false,
    canBeDestroyed: false,
    cutResistance: Infinity,
    parryResistance: Infinity,
    priority: 9,
  }),
} satisfies Record<string, InteractionProfile>;

/** Below this share of what a full cut needs, a blade only throws sparks off a skill. */
export const CUT_FLOOR = 0.2;

export type CutOutcome =
  /** Cut apart. */
  | { result: 'destroy'; share: 1 }
  /** Still there, carrying `1 - share` of its damage. */
  | { result: 'weaken'; share: number }
  | { result: 'none'; share: 0 };

/** What a cut of this power does to an attack: nothing, a share of its strength, or all of it. */
export function cutOutcome(power: number, target: InteractionProfile): CutOutcome {
  if (!target.canBeCut || !(power > 0) || !(target.cutResistance > 0) || !Number.isFinite(target.cutResistance))
    return { result: 'none', share: 0 };
  const ratio = power / target.cutResistance;
  if (ratio >= 1 - 1e-8) return target.canBeDestroyed ? { result: 'destroy', share: 1 } : { result: 'weaken', share: 1 };
  if (ratio < CUT_FLOOR) return { result: 'none', share: 0 };
  return { result: 'weaken', share: ratio };
}

export type ParryOutcome = 'redirect' | 'block' | 'none';

/** What a parry of this power does to an attack: send it back, just stop it, or fail. */
export function parryOutcome(power: number, target: InteractionProfile): ParryOutcome {
  if (!target.canBeParried || power < target.parryResistance) return 'none';
  return target.canBeReflected ? 'redirect' : 'block';
}

// ── Waves ──────────────────────────────────────────────────────────────────────────────────────

export type WaveTint = 'steel' | 'gold' | 'crimson' | 'violet' | 'scarlet';

/** Each kind of slash in its colours: the bright core of the blade and the glow around it. */
export const WAVE_COLORS: Record<WaveTint, { core: string; glow: string }> = {
  steel: { core: '#f4f6ee', glow: '#b9c4c4' },
  gold: { core: '#fff3c4', glow: '#f3ce86' },
  crimson: { core: '#ffd7d2', glow: '#e0473e' },
  violet: { core: '#f0d8ff', glow: '#a64fe0' },
  scarlet: { core: '#ffe1d6', glow: '#d8261f' },
};

/** A travelling slash as it leaves the blade. */
export interface WaveSpec {
  /** Half the front's width at the blade, and how much it widens per unit travelled. */
  halfWidth: number;
  spread: number;
  /** How far the middle of the crescent runs ahead of its tips. */
  bow: number;
  thickness: number;
  range: number;
  speed: number;
  /** Damage at the blade, and the share of it left by the share of the range travelled. */
  damage: number;
  falloff: Curve;
  knockback: number;
  /** Cut power it carries against the skills it crosses. */
  cut: number;
  /** What it takes to cut it apart. */
  resist: number;
  tint: WaveTint;
}
