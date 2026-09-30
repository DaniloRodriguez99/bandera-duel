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
  tint: WaveTint;
  /** 0 to 1 while a charge is held, and 0 to 1 again for what lies past a full charge. */
  charge: number;
  over: number;
}

/** A blade seen from above at `pitch` over the ground along `aim`: short and flipped behind while raised. */
function pitched(aim: number, pitch: number) {
  const level = Math.cos(pitch);
  return {
    angle: level >= 0 ? aim : aim + Math.PI,
    length: Math.max(0.14, Math.abs(level)) * 1.05,
    lift: Math.max(0, Math.sin(pitch)),
  };
}

/** The blade's pose relative to the aim once a swing is over. */
function ending(swing: Swing) {
  const shape = swing.shape;
  if (shape.kind === 'arc') return { turn: shape.to, length: 1, lift: 0 };
  if (shape.drop) return { turn: 0, length: pitched(0, LANDED).length, lift: 0 };
  return { turn: 0, length: 1.15, lift: 0 };
}

/** The pose a swing is wound up to, just before it goes: where a held charge waits too. */
function woundUp(swing: Swing | undefined) {
  if (!swing) return { turn: 2.5, length: 0.85, lift: 0 };
  const shape = swing.shape;
  if (shape.kind === 'arc') return { turn: shape.from + Math.sign(shape.from - shape.to) * WIND_BACK, length: 1, lift: 0 };
  if (shape.drop) {
    const raised = pitched(0, RAISED);
    return { turn: raised.angle, length: raised.length, lift: raised.lift };
  }
  return { turn: 0, length: 0.3, lift: 0 };
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
      const enter = before ? ending(before) : { turn: move.enter ?? REST, length: 1, lift: 0 };
      const wound = woundUp(swing);
      pose.angle = aim + lerp(enter.turn, wound.turn, ready);
      pose.length = lerp(enter.length, wound.length, ready);
      pose.lift = lerp(enter.lift, wound.lift, ready);
    } else if (t < swing.end) {
      const through = clamp01((t - swing.start) / (swing.end - swing.start));
      if (shape.kind === 'arc') pose.angle = aim + lerp(shape.from, shape.to, through);
      else if (shape.drop) Object.assign(pose, pitched(aim, lerp(RAISED, LANDED, fall(through))));
      else {
        pose.angle = aim;
        pose.length = lerp(0.3, 1.15, through);
      }
    } else {
      // Follow-through, then the blade eases back to rest.
      const back = ease(clamp01((t - swing.end) / Math.max(1e-6, move.duration - swing.end)));
      const end = ending(swing);
      pose.angle = aim + lerp(end.turn, REST, back);
      pose.length = lerp(end.length, 1, back);
    }
    // The trail: what the swing in progress has swept, or the last one while it fades.
    const drawn = t >= swing.start ? swing : before;
    if (drawn && t < drawn.end + LINGER) {
      pose.trail = bladeAt(drawn, p, aim, drawn.start, Math.min(t, drawn.end));
      pose.trailAlpha = t < drawn.end ? 1 : 1 - (t - drawn.end) / LINGER;
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
    const wound = woundUp(swingsOf(coming)[0]);
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
      const end = ending(swing);
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
  if ((glow ?? (energy > 0 ? pose.tint : null)) === 'lightning') {
    // Lightning running along the edge, never the same twice.
    const core = hex(WAVE_COLORS.lightning.core);
    w.lineStyle(1.5, core, 0.85);
    w.beginPath();
    w.moveTo(hilt, 0);
    for (let x = hilt + 5; x < hilt + length; x += 5)
      w.lineTo(x, Math.sin(time * 0.09 + x * 0.7) * 2.6 + Math.sin(time * 0.23 + x) * 1.2);
    w.strokePath();
  }
}
