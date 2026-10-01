import type { SkillId } from '../index.js';
import type { ChargeSpec, WaveSpec, WaveTint } from './defs.js';
import { curve, type Curve } from './geometry.js';
import { frames, type KitSkill, type MoveDef, type StrikeDef, type StrikeShape } from './moves.js';

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
// A lightning swordsman, fast and precise. Two horizontal cuts that flow into each other and a
// committed finisher brought down diagonally from over the shoulder; a blade that cuts skills the
// harder the longer it was held; a focused cut that can cross the whole arena; and, once a minute,
// a violet awakening that turns every technique into its lightning version.

/** Seconds the knight's chain waits for its next cut before starting over. */
const KNIGHT_CHAIN_RESET = 0.9;

/**
 * Electrified: each lightning blow adds a stack that slows its victim, and a full charge discharges
 * into a short stun; the body then shrugs off new stacks for a moment.
 */
export const SHOCK = {
  max: 3,
  /** Seconds the stacks last, refreshed by every new one. */
  duration: 1,
  /** Share of walking speed each stack takes. */
  slow: 0.1,
  stun: 0.45,
  immunity: 1.2,
};

export const KNIGHT_SWORD_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'tap', at: 0, label: 'Toque · corte' },
    { id: 'low', at: 0.22, label: 'Carga baja · filo corto', tint: 'lightning' },
    { id: 'mid', at: 0.6, label: 'Carga media · corta a medias', tint: 'lightning' },
    { id: 'high', at: 1, label: 'Carga alta · casi corta del todo', tint: 'azure' },
    { id: 'max', at: 1.4, label: '100 % · corte absoluto', tint: 'crimson' },
  ],
  cap: 1.4,
  // He keeps his technique through light blows; only a heavy one breaks it.
  breakOnDamage: { cooldown: 0, over: 1.5 },
  cancelOnMobility: false,
};

/** By charge tier: tap, low, mid, high, max. */
const SWORD = {
  damage: [1, 1.15, 1.35, 1.6, 2],
  cut: [0.2, 0.3, 0.5, 0.75, 1],
  /** The slash that leaves the blade; a tap launches none. */
  wave: [null, 0, 1, 2, 3] as (number | null)[],
};
/** The slashes of the basic cuts, weakest to strongest: lightning, deep blue, then red. */
const SWORD_WAVES: { range: number; halfWidth: number; damage: number; cut: number; tint: WaveTint }[] = [
  { range: 100, halfWidth: 16, damage: 0.5, cut: 0.3, tint: 'lightning' },
  { range: 150, halfWidth: 22, damage: 0.75, cut: 0.5, tint: 'lightning' },
  { range: 200, halfWidth: 28, damage: 1, cut: 0.75, tint: 'azure' },
  { range: 250, halfWidth: 34, damage: 1.5, cut: 1, tint: 'crimson' },
];

/**
 * A slash that leaves the knight's blade. A horizontal cut throws a broad crescent; the finisher,
 * brought down from overhead, drives a narrow, deep streak along the ground that reaches farther and
 * bites harder. Awake, they are violet and electrify.
 */
const knightWave = (level: number, rend: boolean, awake: boolean): WaveSpec => {
  const base = SWORD_WAVES[level];
  const tint = awake ? 'violet' : base.tint;
  if (rend)
    return {
      halfWidth: 7 + level * 2,
      spread: 0,
      bow: 0,
      thickness: 40 + level * 12,
      range: base.range * 1.3,
      speed: 560,
      damage: base.damage * 1.5,
      falloff: [[0, 1], [1, 0.5]],
      knockback: 30,
      cut: base.cut,
      resist: 0.5 + level * 0.25,
      tint,
      shock: awake ? 2 : 0,
      form: 'rend',
    };
  return {
    halfWidth: base.halfWidth,
    spread: 0,
    bow: 8,
    thickness: 12,
    range: base.range,
    speed: 520,
    damage: base.damage,
    falloff: [[0, 1], [1, 0.5]],
    knockback: 14,
    cut: base.cut,
    resist: 0.5 + level * 0.25,
    tint,
    shock: awake ? 1 : 0,
  };
};

/**
 * The three cuts, each starting where the last one left the blade: right to left across the front,
 * back left to right, then raised over the right shoulder and brought down across the body onto the
 * aim. The finisher takes longer to wind up and lands along its whole length at once.
 */
const CUTS: { name: string; start: number; end: number; duration: number; enter?: number; lunge: number; shape: StrikeShape }[] = [
  { name: 'Primer corte', start: 3, end: 6, duration: 13, lunge: 12, shape: { kind: 'arc', from: deg(60), to: deg(-60), inner: 6, reach: 58 } },
  { name: 'Corte de regreso', start: 2, end: 5, duration: 12, enter: deg(-60), lunge: 12, shape: { kind: 'arc', from: deg(-60), to: deg(60), inner: 6, reach: 58 } },
  {
    name: 'Tajo Descendente',
    start: 6,
    end: 9,
    duration: 18,
    enter: deg(60),
    lunge: 16,
    // Leaning 40° off the vertical: it comes down from over the right shoulder, not straight down.
    shape: { kind: 'lane', length: 88, halfWidth: 14, drop: true, diagonal: deg(40) },
  },
];

function knightCut(step: number, tier: number, awake: boolean): MoveDef {
  const cut = CUTS[step];
  const descending = cut.shape.kind === 'lane';
  const strike: StrikeDef = {
    start: frames(cut.start),
    end: frames(cut.end),
    shape: cut.shape,
    damage: (descending ? 1.5 : 1) * SWORD.damage[tier],
    knockback: descending ? 40 : 12,
    cut: SWORD.cut[tier],
    crit: descending,
    lunge: cut.lunge,
    // Awake, the blade leaves its lightning in whoever it cuts; the finisher, twice.
    shock: awake ? (descending ? 2 : 1) : 0,
  };
  // Awake, every cut throws its slash, two steps stronger than its charge alone would.
  const level = awake ? Math.min(SWORD_WAVES.length - 1, (SWORD.wave[tier] ?? -1) + 2) : SWORD.wave[tier];
  return {
    name: cut.name,
    duration: frames(cut.duration),
    enter: cut.enter,
    strikes: [strike],
    waves: level === null ? [] : [{ at: frames(cut.end), wave: knightWave(level, descending, awake) }],
    speed: 0.85,
    recoverFrom: frames(cut.end),
    tint: awake ? 'violet' : undefined,
  };
}

for (let step = 0; step < CUTS.length; step++)
  for (let tier = 0; tier < KNIGHT_SWORD_CHARGE.tiers.length; tier++)
    for (const awake of [false, true])
      register(`guardian.sword:${step}:${tier}${awake ? ':awake' : ''}`, knightCut(step, tier, awake));

export const KNIGHT_FLURRY_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'low', at: 0, label: 'Toque · Tres Relámpagos' },
    { id: 'mid', at: 0.45, label: 'Media · Cruz Gemela', tint: 'lightning' },
    { id: 'max', at: 1.2, label: 'Máxima · Corte Celestial', tint: 'radiant' },
  ],
  cap: 1.2,
  // A major technique: it holds through anything short of a heavy blow.
  breakOnDamage: { cooldown: 0, over: 2 },
  cancelOnMobility: false,
};
export const KNIGHT_FLURRY_COOLDOWN = 5;

const flurryArc = (from: number, to: number, reach: number) =>
  ({ kind: 'arc', from: deg(from), to: deg(to), inner: 6, reach }) as const;
/** Awake, each quick strike lets a short violet bolt fly from the blade. */
const FLURRY_BOLT: WaveSpec = {
  halfWidth: 14, spread: 0, bow: 6, thickness: 12, range: 110, speed: 640, damage: 0.35,
  falloff: [[0, 1], [1, 0.6]], knockback: 10, cut: 0.4, resist: 0.6, tint: 'violet', shock: 1,
};

/**
 * Three lightning strikes, each its own: a rising cut from low on the right, a wide backhand that
 * turns the body round, and a thrust that carries the whole knight forward. Quick, quick, then the
 * one that counts; each hit leaves a shock, so all three discharge.
 */
const threeBolts = (awake: boolean): MoveDef => ({
  name: 'Tres Relámpagos',
  duration: frames(24),
  strikes: [
    { start: frames(3), end: frames(5), shape: flurryArc(100, -20, 58), damage: 0.5, knockback: 0, cut: 0.3, sibling: true, lunge: 8, shock: 1 },
    { start: frames(8), end: frames(11), shape: flurryArc(-110, 40, 64), damage: 0.5, knockback: 0, cut: 0.3, sibling: true, lunge: 6, shock: 1 },
    { start: frames(15), end: frames(17), shape: { kind: 'lane', length: 82, halfWidth: 10 }, damage: 0.75, knockback: 26, cut: 0.4, sibling: true, lunge: 24, shock: 1 },
  ],
  waves: awake ? [5, 11, 17].map((at) => ({ at: frames(at), wave: FLURRY_BOLT })) : [],
  speed: 0.7,
  recoverFrom: frames(17),
  tint: awake ? 'violet' : 'lightning',
});
/** Two heavier cuts that cross, each throwing a short lightning slash. */
const twinCross = (awake: boolean): MoveDef => ({
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
    shock: 1,
  })),
  waves: [0, 1].map((index) => ({
    at: frames(6 + index * 5),
    wave: {
      halfWidth: 26, spread: 0, bow: 8, thickness: 12, range: 110, speed: 520, damage: 0.5,
      falloff: [[0, 1], [1, 0.5]], knockback: 14, cut: 0.5, resist: 0.75,
      tint: awake ? 'violet' : 'lightning', shock: awake ? 1 : 0,
    } satisfies WaveSpec,
  })),
  speed: 0.6,
  recoverFrom: frames(11),
  tint: awake ? 'violet' : 'lightning',
});

/**
 * Corte Celestial: all of the charge put into one horizontal cut, and a narrow white-gold slash that
 * leaves it and crosses the whole arena, fast. Devastating up close (half of a warrior), a scratch at
 * the far wall; it cuts through whatever it crosses. Narrower and faster than any warrior's wave:
 * precision, not force.
 */
export const CELESTIAL_CUT: WaveSpec = {
  halfWidth: 22,
  spread: 0.035,
  bow: 6,
  thickness: 14,
  range: 1100,
  speed: 980,
  damage: 2.5,
  // All of it up close, under half by the middle of the arena, a sixth at the far wall.
  falloff: [[0, 1], [0.1, 0.9], [0.3, 0.5], [0.6, 0.28], [1, 0.16]],
  knockback: 45,
  cut: 1.8,
  resist: 1.6,
  tint: 'radiant',
};
const celestialCut = (awake: boolean): MoveDef => ({
  name: 'Corte Celestial',
  duration: frames(24),
  strikes: [{
    start: frames(6),
    end: frames(9),
    shape: flurryArc(50, -50, 80),
    damage: 2.5,
    knockback: 55,
    cut: 1.8,
    crit: true,
    lunge: 14,
    shock: awake ? 2 : 0,
  }],
  waves: [{
    at: frames(8),
    wave: awake
      ? { ...CELESTIAL_CUT, halfWidth: 28, speed: 1080, tint: 'violet', shock: 2 }
      : CELESTIAL_CUT,
  }],
  speed: 0.4,
  recoverFrom: frames(9),
  tint: awake ? 'violet' : 'radiant',
  // Everything goes into it: no step carries him out of it halfway.
  planted: true,
});
for (const awake of [false, true]) {
  const tag = awake ? ':awake' : '';
  register(`guardian.flurry:0${tag}`, threeBolts(awake));
  register(`guardian.flurry:1${tag}`, twinCross(awake));
  register(`guardian.flurry:2${tag}`, celestialCut(awake));
}

/**
 * Paso Relámpago: the body charges with lightning and lets it all go at once, toward the aim. A tap
 * is a flash step; held, the charge carries it farther and hits harder, and whoever it crosses is
 * left electrified. It runs beside whatever the blade is doing: the cut in progress goes on.
 */
export const KNIGHT_STEP_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'tap', at: 0, label: 'Toque · paso relámpago' },
    { id: 'max', at: 0.7, label: 'Cargado · relámpago largo que electriza', tint: 'lightning' },
  ],
  cap: 0.7,
  // Lightning gathering in the legs: nothing but a stun lets it go.
  breakOnDamage: null,
  cancelOnMobility: false,
};
export const KNIGHT_STEP = { cooldown: 3, near: 170, far: 300, speed: 950 };
const lightningStep = (charged: boolean, awake: boolean): MoveDef => ({
  name: charged ? 'Relámpago' : 'Paso Relámpago',
  duration: frames(1),
  strikes: [],
  waves: [],
  speed: 1,
  recoverFrom: 0,
  tint: awake ? 'violet' : 'lightning',
  dash: {
    at: 0,
    speed: KNIGHT_STEP.speed * (awake ? 1.1 : 1),
    distance: (charge) =>
      (KNIGHT_STEP.near + (KNIGHT_STEP.far - KNIGHT_STEP.near) * Math.min(1, charge / KNIGHT_STEP_CHARGE.cap)) *
      (awake ? 1.2 : 1),
    iframes: false,
    hit: {
      damage: (charged ? 1.5 : 1) + (awake ? 0.5 : 0),
      knockback: charged ? 30 : 16,
      shock: (charged ? 2 : 1) + (awake ? 1 : 0),
    },
  },
});
for (const awake of [false, true])
  for (const charged of [false, true])
    register(`guardian.dash:${charged ? 1 : 0}${awake ? ':awake' : ''}`, lightningStep(charged, awake));

/**
 * Despertar del Relámpago: once a minute, a mandala passes slowly down through the body and violet
 * lightning takes it. For twenty seconds every technique is its lightning version: violet, stronger,
 * electrifying.
 */
export const KNIGHT_AWAKEN = {
  duration: 20,
  /** What every blade and slash of his deals while awake. */
  damage: 1.25,
  cooldown: 60,
};
register('guardian.fury:0', {
  name: 'Despertar del Relámpago',
  duration: frames(27),
  strikes: [],
  waves: [],
  speed: 0.35,
  recoverFrom: frames(27),
  effect: 'awaken',
  tint: 'violet',
  // He stands still while the lightning goes through him.
  planted: true,
});
const PRESS: ChargeSpec = {
  tiers: [{ id: 'press', at: 0, label: '' }],
  cap: 0,
  breakOnDamage: null,
  cancelOnMobility: false,
};

// ── Warrior ────────────────────────────────────────────────────────────────────────────────────
// A reinforced body: his magic makes him stronger instead of casting anything. Two slow blows of a
// greatsword that, charged, send a red shockwave ahead; a guard held up to take an attack and send
// it back harder the longer it was held; a slash that keeps growing for as long as he dares to
// hold it, and that cuts through what it meets once it is strong enough; a launch off reinforced
// legs; and a state where his body turns to a titan's.

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
const GREATSWORD_STEPS = ['Barrido del Titán', 'Caída de Montaña'];
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
    { id: 'tap', at: 0, label: 'Toque · creciente corta, corta flechas', tint: 'bloodViolet' },
    { id: 'low', at: 1, label: '1 s · más ancha, corta orbes', tint: 'scarlet' },
    { id: 'mid', at: 2, label: '2 s · casi el doble de daño', tint: 'scarlet' },
    { id: 'max', at: 3, label: '3 s · completa: parte tajos y olas', tint: 'blaze' },
    { id: 'over', at: 3.5, label: 'Seguir · sobrecarga, se abre en abanico', tint: 'blaze' },
    { id: 'colossal', at: 7, label: '7 s · ola que cruza el mapa y lo parte todo', tint: 'inferno' },
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
  /**
   * Its cut: enough for arrows from a tap and for charged orbs from a second on, but only a full
   * charge gives it the power to split slashes and waves, and the colossal wave splits them all.
   */
  cut: [[0, 0.8], [1, 1.05], [2.95, 1.2], [3, 1.6], [7, 2.2]],
  cooldown: [[0, 5], [3, 7], [7, 12]],
} satisfies Record<string, Curve>;

/**
 * The crescent's colour by the seconds it was held, changing where its power does: blood and violet
 * while short, red from a second on, blazing once it is complete and splits waves, white-hot and
 * violet as the colossal wave.
 */
const crescentTint = (charge: number): WaveTint =>
  charge >= 7 - 1e-6 ? 'inferno' : charge >= 3 - 1e-6 ? 'blaze' : charge >= 1 - 1e-6 ? 'scarlet' : 'bloodViolet';

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
  cut: curve(CRESCENT.cut, charge),
  resist: curve(CRESCENT.resist, charge),
  tint: crescentTint(charge),
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

/**
 * The guard. Pressed, it goes up at once for a short window: timed right, it sends an attack back.
 * Held, it stays up while an orange mandala hardens the body, and the longer it was held the harder
 * it returns what it meets. By the seconds held: its power (what it can turn, see INTERACTIONS),
 * and what a returned attack comes back with.
 */
export const WARRIOR_PARRY = {
  /** Seconds the guard stays up after it is let go (all of it, on a tap). */
  window: 0.3,
  /** Each attack turned gives this much of the window back, never past its full length: a whole volley can be returned. */
  extend: 0.15,
  /** The front it covers, centred on the aim. */
  arc: Math.PI,
  /** Seconds before the next guard once it drops: after one that turned something, and after one that met nothing. */
  successCooldown: 0.6,
  cooldown: [[0, 3], [2.2, 5]] as Curve,
  /** How much faster an attack flies back, and how far off its way back it turns to find whoever threw it. */
  speed: 1.25,
  turn: deg(60),
  /** Times one attack can be turned; after that nothing stops it. */
  bounces: 3,
  /** A blade stopped on the guard: the seconds its owner staggers, and how far back. */
  stagger: 0.5,
  push: 40,
  /** By seconds held. Not in a straight line: the first moments count the most. */
  power: [[0, 1], [0.4, 1.25], [1, 1.55], [1.6, 1.85], [2.2, 2.1]] as Curve,
  /** What it comes back with, on top of the plain parry: faster, harder, bigger. */
  returnSpeed: [[0, 1], [1, 1.25], [2.2, 1.6]] as Curve,
  returnDamage: [[0, 1], [0.4, 1.1], [1, 1.35], [1.6, 1.6], [2.2, 2]] as Curve,
  returnSize: [[0, 1], [1, 1.25], [2.2, 1.6]] as Curve,
};
export const WARRIOR_PARRY_CHARGE: ChargeSpec = {
  tiers: [
    { id: 'tap', at: 0, label: 'Toque · parry justo a tiempo' },
    { id: 'firm', at: 0.4, label: 'Firme · devuelve orbes cargados', tint: 'gold' },
    { id: 'unbroken', at: 1, label: 'Inquebrantable · más rápido y más fuerte', tint: 'blaze' },
    { id: 'absolute', at: 1.6, label: 'Absoluto · devuelve hasta una Singularidad', tint: 'inferno' },
  ],
  cap: 2.2,
  // Hit from where the guard does not cover, the stance breaks and the guard costs its cooldown.
  breakOnDamage: { cooldown: 1, over: 0.9 },
  cancelOnMobility: false,
  // Nobody holds a guard forever: at its cap, or out of mana to hold it, it lets go by itself.
  autoRelease: true,
};
register('vanguard.counter:0', {
  name: 'Parry',
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
  name: 'Embestida Sísmica',
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

/** The titan's body: a red mandala climbs it, and for a while nothing moves him. */
export const WARRIOR_REINFORCE = {
  duration: 6,
  /** Share of every blow he still takes. */
  taken: 0.6,
  cooldown: 16,
};
register('vanguard.reinforce:0', {
  name: 'Cuerpo de Titán',
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
    move: (_step, tier, awake) => `guardian.flurry:${tier}${awake ? ':awake' : ''}`,
    cooldown: () => KNIGHT_FLURRY_COOLDOWN,
  },
  'guardian.dash': {
    charge: KNIGHT_STEP_CHARGE,
    chain: 1,
    chainReset: 0,
    move: (_step, tier, awake) => `guardian.dash:${tier}${awake ? ':awake' : ''}`,
    cooldown: () => KNIGHT_STEP.cooldown,
    alongside: true,
    concurrent: true,
  },
  'guardian.fury': {
    charge: PRESS,
    chain: 1,
    chainReset: 0,
    move: () => 'guardian.fury:0',
    cooldown: () => KNIGHT_AWAKEN.cooldown,
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
    charge: WARRIOR_PARRY_CHARGE,
    chain: 1,
    chainReset: 0,
    move: () => 'vanguard.counter:0',
    // A guard that turned something comes back soon; one that met nothing costs more the longer
    // it was held.
    cooldown: (_tier, charge, p) => (p.countered > 0 ? WARRIOR_PARRY.successCooldown : curve(WARRIOR_PARRY.cooldown, charge)),
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
