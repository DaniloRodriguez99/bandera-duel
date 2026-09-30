import type { SkillId } from '../index.js';
import type { ChargeSpec, WaveSpec, WaveTint } from './defs.js';
import { curve, type Curve } from './geometry.js';
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
    { id: 'mid', at: 0.6, label: 'Carga media · corta a medias', tint: 'gold' },
    { id: 'high', at: 1, label: 'Carga alta · casi corta del todo', tint: 'gold' },
    { id: 'max', at: 1.4, label: '100 % · corte absoluto', tint: 'violet' },
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
    { id: 'mid', at: 0.45, label: 'Media · Cruz Gemela', tint: 'gold' },
    { id: 'max', at: 1.1, label: 'Máxima · Juicio Carmesí', tint: 'crimson' },
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

// ── Warrior ────────────────────────────────────────────────────────────────────────────────────
// A reinforced body: his magic makes him stronger instead of casting anything. Two slow blows of a
// greatsword that, charged, send a red shockwave ahead; a parry that sends an attack back at
// whoever threw it; a slash that keeps growing for as long as he dares to hold it; a launch off
// reinforced legs; and a state where his body turns to iron.

/** Seconds the warrior's chain waits for its second blow before starting over. */
const WARRIOR_CHAIN_RESET = 1.2;

export const WARRIOR_SWORD_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'tap', at: 0, label: 'Toque · golpe pesado' },
    { id: 'low', at: 0.22, label: 'Carga baja · ×1,25' },
    { id: 'mid', at: 0.75, label: 'Carga media · ×1,5 y más alcance', tint: 'scarlet' },
    { id: 'max', at: 1.5, label: 'Carga completa · ×1,75', tint: 'scarlet' },
  ],
  cap: 1.5,
  breakOnDamage: { cooldown: 0 },
  cancelOnMobility: false,
};

/** By charge tier: tap, low, mid, max. */
const GREATSWORD = {
  damage: [1, 1.25, 1.5, 1.75],
  reach: [1, 1.1, 1.2, 1.3],
  /** The shockwave the blow sends ahead; a tap sends none unless the body is reinforced. */
  shock: [null, 0, 1, 2] as (number | null)[],
};
const GREATSWORD_STEPS = ['Barrido', 'Martillo'];
/** The red shockwaves of the charged blows, weakest to strongest; the last one only reinforced. */
const SHOCKWAVES = [
  { range: 100, halfWidth: 26, damage: 0.75, knockback: 20, resist: 0.75 },
  { range: 160, halfWidth: 34, damage: 1.25, knockback: 30, resist: 1 },
  { range: 230, halfWidth: 44, damage: 2, knockback: 42, resist: 1.25 },
  { range: 300, halfWidth: 54, damage: 2.5, knockback: 50, resist: 1.5 },
];

/**
 * Force thrown off a blow. The sweep sends a crescent that opens as it goes; the overhead blow
 * drives a narrow wave along the ground, farther and harder.
 */
const warriorShock = (level: number, hammer: boolean): WaveSpec => {
  const base = SHOCKWAVES[level];
  return {
    halfWidth: base.halfWidth * (hammer ? 0.6 : 1),
    spread: hammer ? 0 : 0.08,
    bow: hammer ? 4 : 12,
    thickness: hammer ? 18 : 14,
    range: base.range * (hammer ? 1.3 : 1),
    speed: 480,
    damage: base.damage * (hammer ? 1.2 : 1),
    falloff: [[0, 1], [1, 0.45]],
    knockback: base.knockback,
    cut: 0,
    resist: base.resist,
    tint: 'scarlet',
  };
};

function warriorBlow(step: number, tier: number, reinforced: boolean): MoveDef {
  const hammer = step === 1;
  // A long wind-up and a longer way back: every blow is a commitment.
  const start = hammer ? frames(12) : frames(9);
  const end = hammer ? frames(14) : frames(13);
  const reach = GREATSWORD.reach[tier];
  // Reinforced, every blow throws its shockwave, one step stronger than the charge alone.
  const shock = GREATSWORD.shock[tier];
  const level = reinforced ? Math.min(SHOCKWAVES.length - 1, (shock ?? -1) + 1) : shock;
  return {
    name: GREATSWORD_STEPS[step],
    duration: hammer ? frames(30) : frames(24),
    // The overhead blow starts where the sweep left the blade, on the left.
    enter: hammer ? deg(-65) : undefined,
    strikes: [{
      start,
      end,
      // A wide sweep across the front, then the blade brought down from overhead along the aim.
      shape: hammer
        ? { kind: 'lane', length: 100 * reach, halfWidth: 18, drop: true }
        : { kind: 'arc', from: deg(65), to: deg(-65), inner: 8, reach: 82 * reach },
      damage: (hammer ? 2.5 : 2) * GREATSWORD.damage[tier],
      knockback: (hammer ? 50 : 34) * (reinforced ? 1.3 : 1),
      // A greatsword breaks bodies, not spells: it cuts nothing out of the air.
      cut: 0,
      lunge: hammer ? 14 : 10,
    }],
    waves: level === null ? [] : [{ at: end, wave: warriorShock(level, hammer) }],
    speed: 0.5,
    recoverFrom: end,
    tint: 'scarlet',
  };
}

for (let step = 0; step < GREATSWORD_STEPS.length; step++)
  for (let tier = 0; tier < WARRIOR_SWORD_CHARGE.tiers.length; tier++)
    for (const reinforced of [false, true])
      register(`vanguard.sword:${step}:${tier}${reinforced ? ':iron' : ''}`, warriorBlow(step, tier, reinforced));

export const WARRIOR_SLASH_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'tap', at: 0, label: 'Toque · creciente corta' },
    { id: 'low', at: 1, label: '1 s · más ancha y más lejos', tint: 'scarlet' },
    { id: 'mid', at: 2, label: '2 s · casi el doble de daño', tint: 'scarlet' },
    { id: 'max', at: 3, label: '3 s · carga completa', tint: 'scarlet' },
    { id: 'over', at: 3.5, label: 'Seguir · sobrecarga, se abre en abanico', tint: 'scarlet' },
    { id: 'colossal', at: 7, label: '7 s · ola que cruza el mapa', tint: 'scarlet' },
  ],
  cap: 7,
  full: 3,
  // A blow ends the charge and costs half of the cooldown a tap would have left.
  breakOnDamage: { cooldown: 0.5 },
  cancelOnMobility: true,
  reveals: true,
};

/**
 * The crescent by the seconds it was held. One table drives its size, its reach, its damage, what
 * it takes to cut it and how long its cooldown is, so they never drift apart: 3 s is a full charge,
 * and from there to 7 s it overcharges into a wave that crosses the arena.
 */
const CRESCENT = {
  halfWidth: [[0, 24], [3, 60], [7, 110]],
  spread: [[0, 0], [3, 0.06], [7, 0.45]],
  bow: [[0, 8], [3, 16], [7, 40]],
  thickness: [[0, 14], [3, 18], [7, 26]],
  range: [[0, 273], [3, 520], [7, 1150]],
  speed: [[0, 420], [3, 460], [7, 520]],
  damage: [[0, 1.5], [3, 3], [7, 5]],
  knockback: [[0, 24], [3, 40], [7, 60]],
  resist: [[0, 0.5], [3, 1], [7, 2]],
  cooldown: [[0, 5], [3, 7], [7, 12]],
} satisfies Record<string, Curve>;

/** The share of its damage the crescent keeps by the share of its reach it has travelled. */
const CRESCENT_FALLOFF: Curve = [[0, 1], [0.3, 0.85], [0.6, 0.6], [1, 0.4]];

/** The cooldown a tap leaves; a longer hold leaves a longer one. */
export const WARRIOR_SLASH_COOLDOWN = curve(CRESCENT.cooldown, 0);

/** The warrior's travelling slash after holding it this many seconds. */
export const warriorWave = (charge: number): WaveSpec => ({
  halfWidth: curve(CRESCENT.halfWidth, charge),
  spread: curve(CRESCENT.spread, charge),
  bow: curve(CRESCENT.bow, charge),
  thickness: curve(CRESCENT.thickness, charge),
  range: curve(CRESCENT.range, charge),
  speed: curve(CRESCENT.speed, charge),
  damage: curve(CRESCENT.damage, charge),
  falloff: CRESCENT_FALLOFF,
  knockback: curve(CRESCENT.knockback, charge),
  // It crushes whoever it reaches; it does not cut their skills.
  cut: 0,
  resist: curve(CRESCENT.resist, charge),
  tint: 'scarlet',
});

/** A turn of the whole body that lets the crescent go at `at`; the bigger ones take longer to come back from. */
const crescent = (name: string, at: number, duration: number, speed: number): MoveDef => ({
  name,
  duration: frames(duration),
  strikes: [],
  waves: [{ at: frames(at), wave: warriorWave }],
  speed,
  recoverFrom: frames(at),
  tint: 'scarlet',
  flourish: {
    start: frames(at - 3),
    end: frames(at),
    shape: { kind: 'arc', from: deg(80), to: deg(-80), inner: 8, reach: 86 },
  },
});
register('vanguard.slash:0', crescent('Creciente', 4, 12, 0.6));
register('vanguard.slash:1', crescent('Creciente Escarlata', 5, 18, 0.4));
register('vanguard.slash:2', crescent('Ola Carmesí', 7, 30, 0.25));

/** The parry. */
export const WARRIOR_PARRY = {
  /** Seconds the guard stays up after the press. */
  window: 0.3,
  /** Each attack turned gives this much of the window back, never past its full length: a whole volley can be returned. */
  extend: 0.15,
  /** The front it covers, centred on the aim. */
  arc: Math.PI,
  /** Seconds before the next one: after a parry that met nothing, and after one that worked. */
  cooldown: 3,
  successCooldown: 0.6,
  /** How much faster an attack flies back, and how far off its way back it turns to find whoever threw it. */
  speed: 1.25,
  turn: deg(60),
  /** Times one attack can be turned; after that nothing stops it. */
  bounces: 3,
  /** A blade stopped on the guard: the seconds its owner staggers, and how far back. */
  stagger: 0.5,
  push: 40,
};
register('vanguard.counter:0', {
  name: 'Revancha',
  duration: frames(9),
  strikes: [],
  waves: [],
  // The guard goes up without slowing him down.
  speed: 1,
  recoverFrom: frames(9),
  effect: 'parry',
  tint: 'gold',
});

/** The launch: the legs load for a moment, then the body goes off like a thrown boulder. */
export const WARRIOR_LAUNCH_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'tap', at: 0, label: 'Toque · embestida corta' },
    { id: 'max', at: 0.6, label: 'Mantener · embestida larga', tint: 'scarlet' },
  ],
  cap: 0.6,
  breakOnDamage: { cooldown: 0 },
  cancelOnMobility: false,
};
export const WARRIOR_LAUNCH = {
  cooldown: 2.5,
  /** Units travelled on a tap and after a full hold. */
  near: 90,
  far: 210,
  speed: 620,
  /** Whoever he runs into takes a little and is thrown out of the way. */
  hit: { damage: 0.5, knockback: 40 },
};
register('vanguard.dash:0', {
  name: 'Avance Imparable',
  // Three frames of loading the legs; the launch itself outlasts the move.
  duration: frames(4),
  strikes: [],
  waves: [],
  speed: 0.2,
  recoverFrom: frames(4),
  tint: 'scarlet',
  dash: {
    at: frames(3),
    speed: WARRIOR_LAUNCH.speed,
    distance: (charge) =>
      WARRIOR_LAUNCH.near + (WARRIOR_LAUNCH.far - WARRIOR_LAUNCH.near) * Math.min(1, charge / WARRIOR_LAUNCH_CHARGE.cap),
    // No i-frames: he goes through things by being harder than them.
    iframes: false,
    hit: WARRIOR_LAUNCH.hit,
  },
});

/** The reinforced body: a red mandala climbs it, and for a while nothing moves him. */
export const WARRIOR_REINFORCE = {
  duration: 6,
  /** Share of every blow he still takes. */
  taken: 0.6,
  cooldown: 16,
};
register('vanguard.reinforce:0', {
  name: 'Cuerpo de Hierro',
  duration: frames(12),
  strikes: [],
  waves: [],
  speed: 0.3,
  recoverFrom: frames(12),
  effect: 'reinforce',
  tint: 'scarlet',
});

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
  'vanguard.sword': {
    charge: WARRIOR_SWORD_CHARGE,
    chain: GREATSWORD_STEPS.length,
    chainReset: WARRIOR_CHAIN_RESET,
    move: (step, tier, reinforced) => `vanguard.sword:${step}:${tier}${reinforced ? ':iron' : ''}`,
    cooldown: () => 0,
  },
  'vanguard.slash': {
    charge: WARRIOR_SLASH_CHARGE,
    chain: 1,
    chainReset: 0,
    // A tap, a charge up to full, and everything past it.
    move: (_step, tier) => `vanguard.slash:${tier === 0 ? 0 : tier <= 3 ? 1 : 2}`,
    cooldown: (_tier, charge) => curve(CRESCENT.cooldown, charge),
  },
  'vanguard.counter': {
    charge: PRESS,
    chain: 1,
    chainReset: 0,
    move: () => 'vanguard.counter:0',
    cooldown: () => WARRIOR_PARRY.cooldown,
    instant: true,
    interrupts: true,
  },
  'vanguard.dash': {
    charge: WARRIOR_LAUNCH_CHARGE,
    chain: 1,
    chainReset: 0,
    move: () => 'vanguard.dash:0',
    cooldown: () => WARRIOR_LAUNCH.cooldown,
    interrupts: true,
    alongside: true,
  },
  'vanguard.reinforce': {
    charge: PRESS,
    chain: 1,
    chainReset: 0,
    move: () => 'vanguard.reinforce:0',
    cooldown: () => WARRIOR_REINFORCE.cooldown,
    instant: true,
  },
};
