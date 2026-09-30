import type Phaser from 'phaser';
import {
  KIT,
  MOVES,
  WAVE_COLORS,
  bladeAt,
  chargeProgress,
  chargeTier,
  kitSkills,
  overcharge,
  type Blade,
  type MoveDef,
  type Player,
  type StrikeShape,
  type Swing,
  type WaveTint,
} from '@bandera/shared';
import { hex } from '@bandera/shared/rpg/colors';

/**
 * How a kit's blade looks while it fights. Everything here is read from the same move data the
 * simulation hits with: the blade is drawn where the strike is, and its trail is the area the
 * strike has swept, so what the sword went through is what it hit.
 *
 * Seen from above, a blade brought down from overhead shortens as it rises (it points at the
 * camera), flips over the head and lengthens again as it comes down in front: that is how a
 * vertical blow reads in this view, instead of a thrust.
 */

type Fighter = Pick<
  Player,
  | 'move' | 'moveT' | 'moveAngle' | 'moveCharge' | 'chargeSkill' | 'chargeT' | 'angle' | 'furyLeft'
  | 'combo' | 'comboLeft' | 'loadout'
>;

/** Where the blade rests when nothing is happening, off the aim toward the sword hand. */
const REST = 0.55;
/** How far past its starting angle an arc is drawn back before it goes. */
const WIND_BACK = 0.45;
/** Seconds the trail of a finished strike lingers. */
const LINGER = 0.09;
/** Raised for a blow from overhead: tilted back past the vertical. */
const RAISED = (100 * Math.PI) / 180;
/** Where that blow ends: a little past level, the tip toward the ground ahead. */
const LANDED = (-12 * Math.PI) / 180;
/**
 * How much of a blade's height shows as screen-up, in lengths of the blade. The arena is seen from
 * above, but bodies stand up in it: a raised blade points up the screen instead of folding flat.
 */
const HEIGHT = 0.9;
/** Seconds the streak of a blow brought down on a slant lingers: long enough to read its path. */
const STREAK_LINGER = 0.2;

const ease = (t: number) => t * t * (3 - 2 * t);
/** Slow out of the top, fast into the blow. */
const fall = (t: number) => t * t;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** The colour of a move: its own, that of the slash it throws, or plain steel. */
export function moveTint(move: MoveDef, charge: number): WaveTint {
  if (move.tint) return move.tint;
  const thrown = move.waves[0]?.wave;
  if (!thrown) return 'steel';
  return (typeof thrown === 'function' ? thrown(charge) : thrown).tint;
}

/** A point of the world. */
interface Spot {
  x: number;
  y: number;
}

export interface BladePose {
  /** Where the blade points, in the world. */
  angle: number;
  /** How much of its length shows: a blade raised overhead is foreshortened. */
  length: number;
  /** 0 to 1: how high it is held, overhead at 1. */
  lift: number;
  /** The area swept so far by the strike in progress (or just finished), and how fresh it is. */
  trail: Blade | null;
  trailAlpha: number;
  /**
   * For a blow brought down on a slant: the way its tip came down, from over the shoulder to the
   * ground, as seen from above (higher up the screen while it is higher up), and how fresh it is.
   */
  streak: Spot[] | null;
  streakAlpha: number;
  tint: WaveTint;
  /** 0 to 1 while a charge is held, and 0 to 1 again for what lies past a full charge. */
  charge: number;
  over: number;
}

/** A blade at `pitch` over the ground along the aim, as a turn off it: short and flipped behind while raised. */
function pitched(pitch: number) {
  const level = Math.cos(pitch);
  return {
    turn: level >= 0 ? 0 : Math.PI,
    length: Math.max(0.14, Math.abs(level)) * 1.05,
    lift: Math.max(0, Math.sin(pitch)),
  };
}

/**
 * A blade brought down on a slant, its plane leaning `tilt` from the vertical (toward the right hand
 * when positive), at `pitch` over the ground: it rises over a shoulder and comes down across the
 * body to land along the aim at full length. Not a vertical blow, not a flat one.
 */
function slanted(pitch: number, tilt: number) {
  const along = Math.cos(pitch);
  const aside = Math.sin(pitch) * Math.sin(tilt);
  return {
    turn: Math.atan2(aside, along),
    length: Math.max(0.14, Math.hypot(along, aside)) * 1.05,
    lift: Math.max(0, Math.sin(pitch) * Math.cos(tilt)),
  };
}

/**
 * Which shoulder a slanted blow comes over for someone aiming along `aim`: the sword hand's, unless
 * that side faces the camera, where a raised blade would fold into the body; then the other one,
 * where its height shows.
 */
const leanSide = (aim: number) => (Math.cos(aim) > 0.35 ? -1 : 1);

/** A blow from overhead at `pitch`: straight down the aim, or on its slant. */
const overhead = (pitch: number, shape: StrikeShape, aim: number) =>
  shape.kind === 'lane' && shape.diagonal ? slanted(pitch, shape.diagonal * leanSide(aim)) : pitched(pitch);

/**
 * Where a blade shows on screen, as the angle and length it is drawn at: its height turned into
 * screen-up, so a raised blade stands up over the head.
 */
export function onScreen(pose: Pick<BladePose, 'angle' | 'length' | 'lift'>) {
  const x = Math.cos(pose.angle) * pose.length;
  const y = Math.sin(pose.angle) * pose.length - pose.lift * HEIGHT;
  return { angle: Math.atan2(y, x), length: Math.min(1.2, Math.max(0.3, Math.hypot(x, y))) };
}

/** The blade's pose relative to the aim once a swing is over. */
function ending(swing: Swing, aim: number) {
  const shape = swing.shape;
  if (shape.kind === 'arc') return { turn: shape.to, length: 1, lift: 0 };
  if (shape.drop) {
    const landed = overhead(LANDED, shape, aim);
    return { turn: landed.turn, length: landed.length, lift: 0 };
  }
  return { turn: 0, length: 1.15, lift: 0 };
}

/** The pose a swing is wound up to, just before it goes: where a held charge waits too. */
function woundUp(swing: Swing | undefined, aim: number) {
  if (!swing) return { turn: 2.5, length: 0.85, lift: 0 };
  const shape = swing.shape;
  if (shape.kind === 'arc') return { turn: shape.from + Math.sign(shape.from - shape.to) * WIND_BACK, length: 1, lift: 0 };
  if (shape.drop) return overhead(RAISED, shape, aim);
  return { turn: 0, length: 0.3, lift: 0 };
}

/**
 * The path the tip of a slanted blow has drawn on screen, from the top of its lift down to
 * `through` of the way, for someone at `origin`: it starts at the blade's own length over the head
 * and grows into the full `reach` of the blow where it meets the ground.
 */
function streakOf(origin: Spot, aim: number, tilt: number, reach: number, through: number): Spot[] {
  const steps = 10;
  const lean = leanSide(aim);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const share = (through * index) / steps;
    const at = slanted(lerp(RAISED, LANDED, fall(share)), tilt * lean);
    const radius = reach * lerp(0.5, 1, share);
    return {
      x: origin.x + Math.cos(aim + at.turn) * at.length * radius,
      y: origin.y + Math.sin(aim + at.turn) * at.length * radius - at.lift * HEIGHT * radius,
    };
  });
}

/** What the blade does in a move: its strikes, or the swing that throws what it throws. */
const swingsOf = (move: MoveDef): readonly Swing[] =>
  move.strikes.length ? move.strikes : move.flourish ? [move.flourish] : [];

/** The chain skill of a fighter, if any: the step it is at decides where its blade waits. */
function chainOf(p: Fighter) {
  const id = kitSkills(p).find((skill) => KIT[skill].chain > 1);
  return id ? { id, skill: KIT[id] } : null;
}

/** The pose of a fighter's blade `age` seconds after its last known state. */
export function bladePose(p: Fighter & { x: number; y: number }, age: number): BladePose {
  const pose: BladePose = {
    angle: p.angle + REST,
    length: 1,
    lift: 0,
    trail: null,
    trailAlpha: 0,
    streak: null,
    streakAlpha: 0,
    tint: 'steel',
    charge: 0,
    over: 0,
  };
  const move = p.move ? MOVES[p.move] : undefined;
  if (move) {
    const t = Math.min(move.duration, p.moveT + age);
    const aim = p.moveAngle;
    pose.tint = moveTint(move, p.moveCharge);
    if (move.effect === 'parry') {
      // The guard: the blade held across the front, following where he faces now.
      pose.angle = p.angle - 1.2;
      pose.length = 0.95;
      return pose;
    }
    const swings = swingsOf(move);
    if (move.effect === 'awaken') {
      // The awakening: the sword held up before him while the lightning goes through.
      const rise = ease(clamp01(t / (move.duration * 0.3)));
      pose.angle = aim + lerp(REST, 0, rise);
      pose.length = lerp(1, 0.25, rise);
      pose.lift = rise;
      return pose;
    }
    if (!swings.length) {
      // A launch: the blade low and back while the legs load, then trailing behind.
      const loading = move.dash && t < move.dash.at;
      pose.angle = aim + (loading ? 2.5 : Math.PI * 0.85);
      pose.length = 0.85;
      return pose;
    }
    // The swing being wound up or swung; once they are all done, the last one as it settles.
    const next = swings.findIndex((candidate) => t < candidate.end);
    const index = next === -1 ? swings.length - 1 : next;
    const swing = swings[index];
    const before: Swing | undefined = swings[index - 1];
    const shape = swing.shape;
    if (t < swing.start) {
      // Anticipation: from wherever the blade is, back past where the swing starts.
      const from = before ? before.end : 0;
      const ready = ease(clamp01((t - from) / Math.max(1e-6, swing.start - from)));
      const enter = before ? ending(before, aim) : { turn: move.enter ?? REST, length: 1, lift: 0 };
      const wound = woundUp(swing, aim);
      pose.angle = aim + lerp(enter.turn, wound.turn, ready);
      pose.length = lerp(enter.length, wound.length, ready);
      pose.lift = lerp(enter.lift, wound.lift, ready);
    } else if (t < swing.end) {
      const through = clamp01((t - swing.start) / (swing.end - swing.start));
      if (shape.kind === 'arc') pose.angle = aim + lerp(shape.from, shape.to, through);
      else if (shape.drop) {
        const at = overhead(lerp(RAISED, LANDED, fall(through)), shape, aim);
        pose.angle = aim + at.turn;
        pose.length = at.length;
        pose.lift = at.lift;
      }
      else {
        pose.angle = aim;
        pose.length = lerp(0.3, 1.15, through);
      }
    } else {
      // Follow-through, then the blade eases back to rest.
      const back = ease(clamp01((t - swing.end) / Math.max(1e-6, move.duration - swing.end)));
      const end = ending(swing, aim);
      pose.angle = aim + lerp(end.turn, REST, back);
      pose.length = lerp(end.length, 1, back);
    }
    // The trail: what the swing in progress has swept, or the last one while it fades.
    const drawn = t >= swing.start ? swing : before;
    const fell = drawn?.shape.kind === 'lane' && drawn.shape.drop ? drawn.shape : null;
    // A blow brought down on a slant only marks the ground once it gets there.
    const landing = fell?.kind === 'lane' && fell.diagonal ? drawn!.start + (drawn!.end - drawn!.start) * 0.6 : -Infinity;
    if (drawn && t < drawn.end + LINGER && t >= landing) {
      pose.trail = bladeAt(drawn, p, aim, drawn.start, Math.min(t, drawn.end));
      pose.trailAlpha = t < drawn.end ? 1 : 1 - (t - drawn.end) / LINGER;
    }
    // It leaves the path of its fall in the air a moment longer.
    if (drawn && fell?.kind === 'lane' && fell.diagonal && t < drawn.end + STREAK_LINGER) {
      const through = clamp01((t - drawn.start) / (drawn.end - drawn.start));
      pose.streak = streakOf(p, aim, fell.diagonal, fell.length, through);
      pose.streakAlpha = t < drawn.end ? 1 : 1 - (t - drawn.end) / STREAK_LINGER;
    }
    return pose;
  }
  if (p.chargeSkill && KIT[p.chargeSkill]) {
    // A held charge waits wound up for the swing it will let go: the next step of a chain, or the
    // skill's own.
    const skill = KIT[p.chargeSkill];
    const held = p.chargeT + age;
    const step = skill.chain > 1 ? p.combo % skill.chain : 0;
    const coming = MOVES[skill.move(step, chargeTier(skill.charge, held).index, p.furyLeft > 0)];
    const wound = woundUp(swingsOf(coming)[0], p.angle);
    pose.angle = p.angle + wound.turn;
    pose.length = wound.length;
    pose.lift = wound.lift;
    pose.charge = chargeProgress(skill.charge, held);
    pose.over = overcharge(skill.charge, held);
    pose.tint = chargeTier(skill.charge, held).tier.tint ?? 'steel';
    return pose;
  }
  const chain = chainOf(p);
  if (chain && p.comboLeft > 0) {
    // Between two steps of a chain the blade stays where the last one left it, drifting back.
    const last = MOVES[chain.skill.move((p.combo + chain.skill.chain - 1) % chain.skill.chain, 0, false)];
    const swing = swingsOf(last).at(-1);
    if (swing) {
      const end = ending(swing, p.angle);
      const drift = ease(clamp01(1 - p.comboLeft / Math.max(1e-6, chain.skill.chainReset)));
      pose.angle = p.angle + lerp(end.turn, REST, drift);
      pose.length = lerp(end.length, 1, drift);
    }
  }
  return pose;
}

/** The swept area of a strike, filled: a ring slice for a horizontal cut, a strip for a vertical one. */
export function drawTrail(g: Phaser.GameObjects.Graphics, trail: Blade, tint: WaveTint, alpha: number, heavy = false) {
  const glow = hex(WAVE_COLORS[tint].glow);
  const core = hex(WAVE_COLORS[tint].core);
  const edge = heavy ? 5 : 3;
  if (trail.kind === 'lane') {
    const cos = Math.cos(trail.angle);
    const sin = Math.sin(trail.angle);
    const corner = (along: number, across: number) => ({
      x: trail.x + cos * along - sin * across,
      y: trail.y + sin * along + cos * across,
    });
    g.fillStyle(glow, (heavy ? 0.38 : 0.3) * alpha);
    g.fillPoints([corner(trail.near, -trail.halfWidth), corner(trail.far, -trail.halfWidth), corner(trail.far, trail.halfWidth), corner(trail.near, trail.halfWidth)], true);
    g.lineStyle(edge, core, 0.95 * alpha);
    g.lineBetween(corner(trail.near, 0).x, corner(trail.near, 0).y, corner(trail.far, 0).x, corner(trail.far, 0).y);
    return;
  }
  const turn = Math.atan2(Math.sin(trail.to - trail.from), Math.cos(trail.to - trail.from));
  const steps = Math.max(2, Math.ceil(Math.abs(turn) / 0.18));
  const at = (radius: number, index: number) => {
    const angle = trail.from + (turn * index) / steps;
    return { x: trail.x + Math.cos(angle) * radius, y: trail.y + Math.sin(angle) * radius };
  };
  const outer = Array.from({ length: steps + 1 }, (_, index) => at(trail.outer, index));
  const inner = Array.from({ length: steps + 1 }, (_, index) => at(Math.max(trail.inner, trail.outer * (heavy ? 0.35 : 0.45)), steps - index));
  g.fillStyle(glow, (heavy ? 0.32 : 0.24) * alpha);
  g.fillPoints([...outer, ...inner], true);
  // The edge the tip of the blade drew.
  g.lineStyle(edge, core, 0.9 * alpha);
  g.strokePoints(outer);
}

/**
 * The fall of a slanted blow: a blade of light along the path its tip drew, thin where it started
 * over the shoulder and full where it met the ground, with the edge bright.
 */
export function drawStreak(g: Phaser.GameObjects.Graphics, origin: Spot, streak: Spot[], tint: WaveTint, alpha: number) {
  const glow = hex(WAVE_COLORS[tint].glow);
  const core = hex(WAVE_COLORS[tint].core);
  const last = streak.length - 1;
  // The inner edge closes in on the hilt: the ribbon is what the blade swept, not only its tip.
  const inner = streak.map((point, index) => {
    const keep = 0.72 - 0.3 * (index / last);
    return { x: origin.x + (point.x - origin.x) * keep, y: origin.y + (point.y - origin.y) * keep };
  });
  g.fillStyle(glow, 0.34 * alpha);
  g.fillPoints([...streak, ...inner.reverse()], true);
  for (let index = 1; index <= last; index++) {
    const share = index / last;
    g.lineStyle(1 + share * 3.5, core, (0.35 + share * 0.6) * alpha);
    g.lineBetween(streak[index - 1].x, streak[index - 1].y, streak[index].x, streak[index].y);
  }
}

/**
 * A blade along +x of a graphics object already rotated to the pose: the knight's slim sword, or
 * the warrior's greatsword, broad and heavy. `glow` colours the energy gathered along it.
 */
export function drawKitBlade(
  w: Phaser.GameObjects.Graphics,
  pose: BladePose,
  reach: number,
  time: number,
  glow: WaveTint | null,
  heavy = false,
) {
  const length = reach * pose.length;
  const width = heavy ? 3.6 : 2;
  const energy = pose.charge + pose.over;
  if (energy > 0 || glow) {
    // The charge gathers along the blade; past a full charge it keeps swelling.
    const tint = hex(WAVE_COLORS[glow ?? pose.tint].glow);
    const pulse = 0.5 + 0.5 * Math.sin(time * (0.012 + Math.min(1, energy) * 0.02));
    w.lineStyle(5 + energy * 5 + (heavy ? 3 : 0), tint, 0.18 + (glow ? 0.12 : Math.min(1, energy) * 0.3) + pulse * 0.08);
    w.lineBetween(12, 0, 12 + length, 0);
  }
  w.fillStyle(0x6f5b45);
  w.fillRect(5, -2, heavy ? 10 : 8, 4);
  w.fillStyle(0xf3ce86);
  w.fillRect(heavy ? 14 : 12, heavy ? -8 : -6, heavy ? 4 : 3, heavy ? 16 : 12);
  const hilt = heavy ? 18 : 15;
  w.fillStyle(heavy ? 0xdfe3dc : 0xeef0e4);
  w.fillPoints(
    [
      { x: hilt, y: -width },
      { x: hilt - 4 + length, y: -width * 0.75 },
      { x: hilt + length, y: 0 },
      { x: hilt - 4 + length, y: width * 0.75 },
      { x: hilt, y: width },
    ],
    true,
  );
  w.lineStyle(1, 0x9aa3ab, 0.9);
  w.lineBetween(hilt + 1, 0, hilt - 4 + length, 0);
  const crackle = glow ?? (energy > 0 ? pose.tint : null);
  if (crackle === 'lightning' || crackle === 'violet') {
    // Lightning running along the edge, never the same twice.
    const core = hex(WAVE_COLORS[crackle].core);
    w.lineStyle(1.5, core, 0.85);
    w.beginPath();
    w.moveTo(hilt, 0);
    for (let x = hilt + 5; x < hilt + length; x += 5)
      w.lineTo(x, Math.sin(time * 0.09 + x * 0.7) * 2.6 + Math.sin(time * 0.23 + x) * 1.2);
    w.strokePath();
  }
}
