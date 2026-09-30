import type { SkillId } from '../index.js';
import type { ChargeSpec, WaveSpec, WaveTint } from './defs.js';
import { frames, type KitSkill, type MoveDef, type StrikeDef } from './moves.js';

/**
 * The knight's and the warrior's kits, as data. Every number that balances them is in this file:
 * timings, reaches, damage, cut power, slashes and cooldowns.
 */

const deg = (value: number) => (value * Math.PI) / 180;

/** Every move of every kit, by id: the skill it belongs to, then what tells its versions apart. */
export const MOVES: Record<string, MoveDef> = {};
/** The skill a move belongs to. */
export const moveSkill = (move: string) => move.slice(0, move.indexOf(':')) as SkillId;
const register = (id: string, move: MoveDef) => {
  MOVES[id] = move;
  return id;
};

// ── Knight ─────────────────────────────────────────────────────────────────────────────────────
// Fast and precise: two horizontal cuts and a vertical finisher, a blade that cuts skills the
// harder the longer it was held, and a flurry in the shield's place.

/** Seconds the knight's chain waits for its next cut before starting over. */
const KNIGHT_CHAIN_RESET = 0.9;

export const KNIGHT_SWORD_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'tap', at: 0, label: 'Toque · corte' },
    { id: 'low', at: 0.22, label: 'Carga baja · filo corto' },
    { id: 'mid', at: 0.6, label: 'Carga media · corta a medias' },
    { id: 'high', at: 1, label: 'Carga alta · casi corta del todo' },
    { id: 'max', at: 1.4, label: '100 % · corte absoluto' },
  ],
  cap: 1.4,
  breakOnDamage: { cooldown: 0 },
  cancelOnMobility: false,
};

/** By charge tier: tap, low, mid, high, max. */
const SWORD = {
  damage: [1, 1.15, 1.35, 1.6, 2],
  cut: [0.2, 0.3, 0.5, 0.75, 1],
  /** The slash that leaves the blade; a tap launches none. */
  wave: [null, 0, 1, 2, 3] as (number | null)[],
};
/** The slashes of the basic cuts, weakest to strongest. */
const SWORD_WAVES: { range: number; halfWidth: number; damage: number; cut: number; tint: WaveTint }[] = [
  { range: 100, halfWidth: 16, damage: 0.5, cut: 0.3, tint: 'steel' },
  { range: 150, halfWidth: 22, damage: 0.75, cut: 0.5, tint: 'steel' },
  { range: 200, halfWidth: 28, damage: 1, cut: 0.75, tint: 'gold' },
  { range: 250, halfWidth: 34, damage: 1.5, cut: 1, tint: 'violet' },
];

/** A slash that leaves the knight's blade: quick, short and fading as it goes. */
const knightWave = (level: number, vertical: boolean): WaveSpec => {
  const base = SWORD_WAVES[level];
  return {
    // The vertical cut throws a narrow blade of air that reaches farther and bites harder.
    halfWidth: vertical ? 8 + level * 2 : base.halfWidth,
    spread: 0,
    bow: vertical ? 3 : 8,
    thickness: 12,
    range: base.range * (vertical ? 1.3 : 1),
    speed: 520,
    damage: base.damage * (vertical ? 1.5 : 1),
    falloff: [[0, 1], [1, 0.5]],
    knockback: vertical ? 30 : 14,
    cut: base.cut,
    resist: 0.5 + level * 0.25,
    tint: base.tint,
  };
};

const SWORD_STEPS = ['Primer corte', 'Segundo corte', 'Veredicto'];

function knightCut(step: number, tier: number, awake: boolean): MoveDef {
  const vertical = step === 2;
  const start = vertical ? frames(4) : frames(2);
  const end = vertical ? frames(6) : frames(5);
  const strike: StrikeDef = {
    start,
    end,
    // Right to left across the front; the finisher comes down along the aim.
    shape: vertical
      ? { kind: 'lane', length: 84, halfWidth: 13 }
      : { kind: 'arc', from: deg(60), to: deg(-60), inner: 6, reach: 58 },
    damage: (vertical ? 1.5 : 1) * SWORD.damage[tier],
    knockback: vertical ? 40 : 12,
    cut: SWORD.cut[tier],
    crit: vertical,
    lunge: vertical ? 16 : 12,
  };
  // Awake, every cut throws its slash, two steps stronger than its charge alone would.
  const level = awake ? Math.min(SWORD_WAVES.length - 1, (SWORD.wave[tier] ?? -1) + 2) : SWORD.wave[tier];
  return {
    name: SWORD_STEPS[step],
    duration: vertical ? frames(14) : frames(12),
    strikes: [strike],
    waves: level === null ? [] : [{ at: end, wave: knightWave(level, vertical) }],
    speed: 0.85,
    recoverFrom: end,
  };
}

for (let step = 0; step < 3; step++)
  for (let tier = 0; tier < KNIGHT_SWORD_CHARGE.tiers.length; tier++)
    for (const awake of [false, true])
      register(`guardian.sword:${step}:${tier}${awake ? ':awake' : ''}`, knightCut(step, tier, awake));

export const KNIGHT_FLURRY_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'low', at: 0, label: 'Toque · Tres Relámpagos' },
    { id: 'mid', at: 0.45, label: 'Media · Cruz Gemela' },
    { id: 'max', at: 1.1, label: 'Máxima · Juicio Carmesí' },
  ],
  cap: 1.1,
  breakOnDamage: { cooldown: 0 },
  cancelOnMobility: false,
};
export const KNIGHT_FLURRY_COOLDOWN = 5;

const flurryArc = (from: number, to: number, reach: number) =>
  ({ kind: 'arc', from: deg(from), to: deg(to), inner: 6, reach }) as const;

/** Three quick cuts that walk into the rival: light each, and only the last one pushes. */
register('guardian.flurry:0', {
  name: 'Tres Relámpagos',
  duration: frames(15),
  strikes: [0, 1, 2].map((index): StrikeDef => ({
    start: frames(2 + index * 3),
    end: frames(4 + index * 3),
    shape: index === 1 ? flurryArc(-55, 55, 62) : flurryArc(55, -55, 62),
    damage: 0.5,
    knockback: index === 2 ? 26 : 0,
    cut: 0.3,
    sibling: true,
    lunge: 12,
  })),
  waves: [],
  speed: 0.7,
  recoverFrom: frames(10),
});
/** Two heavier cuts that cross, each throwing a short slash. */
register('guardian.flurry:1', {
  name: 'Cruz Gemela',
  duration: frames(19),
  strikes: [0, 1].map((index): StrikeDef => ({
    start: frames(3 + index * 5),
    end: frames(6 + index * 5),
    shape: index ? flurryArc(-70, 40, 78) : flurryArc(70, -40, 78),
    damage: 1,
    knockback: index ? 34 : 0,
    cut: 0.6,
    sibling: true,
    lunge: 14,
  })),
  waves: [0, 1].map((index) => ({
    at: frames(6 + index * 5),
    wave: {
      halfWidth: 26, spread: 0, bow: 8, thickness: 12, range: 110, speed: 520, damage: 0.5,
      falloff: [[0, 1], [1, 0.5]], knockback: 14, cut: 0.5, resist: 0.75, tint: 'gold',
    } satisfies WaveSpec,
  })),
  speed: 0.6,
  recoverFrom: frames(11),
});
/** One cut with everything behind it: the widest blade, a critical, and a slash that parts skills. */
register('guardian.flurry:2', {
  name: 'Juicio Carmesí',
  duration: frames(24),
  strikes: [{
    start: frames(6),
    end: frames(9),
    shape: flurryArc(75, -75, 96),
    damage: 2.5,
    knockback: 55,
    cut: 1.5,
    crit: true,
    lunge: 18,
  }],
  waves: [{
    at: frames(9),
    wave: {
      halfWidth: 42, spread: 0, bow: 12, thickness: 16, range: 320, speed: 560, damage: 2,
      falloff: [[0, 1], [1, 0.6]], knockback: 40, cut: 1.5, resist: 1.5, tint: 'crimson',
    },
  }],
  speed: 0.4,
  recoverFrom: frames(9),
});

/** The awakening: a breath while the mandala passes through the body, then the blade wakes. */
export const KNIGHT_AWAKEN = { duration: 8, damage: 1.2, rage: 100 };
register('guardian.fury:0', {
  name: 'Despertar',
  duration: frames(12),
  strikes: [],
  waves: [],
  speed: 0.5,
  recoverFrom: frames(12),
  effect: 'awaken',
});
const PRESS: ChargeSpec = {
  tiers: [{ id: 'press', at: 0, label: '' }],
  cap: 0,
  breakOnDamage: null,
  cancelOnMobility: false,
};

/** The skills that run as moves, and how each turns a press into one. */
export const KIT: Record<string, KitSkill> = {
  'guardian.sword': {
    charge: KNIGHT_SWORD_CHARGE,
    chain: 3,
    chainReset: KNIGHT_CHAIN_RESET,
    move: (step, tier, awake) => `guardian.sword:${step}:${tier}${awake ? ':awake' : ''}`,
    cooldown: () => 0,
  },
  'guardian.flurry': {
    charge: KNIGHT_FLURRY_CHARGE,
    chain: 1,
    chainReset: 0,
    move: (_step, tier) => `guardian.flurry:${tier}`,
    cooldown: () => KNIGHT_FLURRY_COOLDOWN,
  },
  'guardian.fury': {
    charge: PRESS,
    chain: 1,
    chainReset: 0,
    move: () => 'guardian.fury:0',
    cooldown: () => 0,
    instant: true,
  },
};
