import type Phaser from 'phaser';
import {
  KIT,
  MOVES,
  WAVE_COLORS,
  bladeAt,
  chargeProgress,
  chargeTier,
  type Blade,
  type MoveDef,
  type Player,
  type StrikeDef,
  type WaveTint,
} from '@bandera/shared';
import { hex } from '@bandera/shared/rpg/colors';

/**
 * How a kit's blade looks while it fights. Everything here is read from the same move data the
 * simulation hits with: the blade is drawn where the strike is, and its trail is the area the
 * strike has swept, so what the sword went through is what it hit.
 */

type Fighter = Pick<Player, 'move' | 'moveT' | 'moveAngle' | 'moveCharge' | 'chargeSkill' | 'chargeT' | 'angle' | 'furyLeft'>;

/** Where the blade rests when nothing is happening, off the aim toward the sword hand. */
const REST = 0.55;
/** How far past its starting angle an arc is drawn back before it goes. */
const WIND_BACK = 0.45;
/** Seconds the trail of a finished strike lingers. */
const LINGER = 0.09;

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** The colour of a move: that of the slash it throws, or plain steel. */
export function moveTint(move: MoveDef, charge: number): WaveTint {
  const thrown = move.waves[0]?.wave;
  if (!thrown) return 'steel';
  return (typeof thrown === 'function' ? thrown(charge) : thrown).tint;
}

export interface BladePose {
  /** Where the blade points, in the world. */
  angle: number;
  /** How much of its length shows: a blade raised overhead is foreshortened. */
  length: number;
  /** The area swept so far by the strike in progress (or just finished), and how fresh it is. */
  trail: Blade | null;
  trailAlpha: number;
  tint: WaveTint;
  /** 0 to 1 while a charge is held. */
  charge: number;
}

/** The pose of a fighter's blade `age` seconds after its last known state. */
export function bladePose(p: Fighter & { x: number; y: number }, age: number): BladePose {
  const pose: BladePose = { angle: p.angle + REST, length: 1, trail: null, trailAlpha: 0, tint: 'steel', charge: 0 };
  const move = p.move ? MOVES[p.move] : undefined;
  if (move?.strikes.length) {
    const t = Math.min(move.duration, p.moveT + age);
    const aim = p.moveAngle;
    pose.tint = moveTint(move, p.moveCharge);
    // The strike being wound up or swung; once they are all done, the last one as it settles.
    const next = move.strikes.findIndex((candidate) => t < candidate.end);
    const index = next === -1 ? move.strikes.length - 1 : next;
    const strike: StrikeDef = move.strikes[index];
    const before: StrikeDef | undefined = move.strikes[index - 1];
    const shape = strike.shape;
    if (t < strike.start) {
      // Anticipation: the blade goes back the other way before it comes through.
      const from = before ? before.end : 0;
      const ready = ease(clamp01((t - from) / Math.max(1e-6, strike.start - from)));
      if (shape.kind === 'arc') {
        const back = Math.sign(shape.from - shape.to) * WIND_BACK;
        pose.angle = aim + lerp(before?.shape.kind === 'arc' ? before.shape.to : REST, shape.from + back, ready);
      } else {
        pose.angle = aim;
        pose.length = lerp(1, 0.3, ready);
      }
    } else if (t < strike.end) {
      const through = clamp01((t - strike.start) / (strike.end - strike.start));
      if (shape.kind === 'arc') pose.angle = aim + lerp(shape.from, shape.to, through);
      else {
        pose.angle = aim;
        pose.length = lerp(0.3, 1.15, through);
      }
    } else {
      // Recovery: the blade eases back to rest.
      const back = ease(clamp01((t - strike.end) / Math.max(1e-6, move.duration - strike.end)));
      pose.angle = aim + lerp(shape.kind === 'arc' ? shape.to : 0, REST, back);
    }
    // The trail: what the strike in progress has swept, or the last one while it fades.
    const drawn = t >= strike.start ? strike : before;
    if (drawn && t < drawn.end + LINGER) {
      pose.trail = bladeAt(drawn, p, aim, drawn.start, Math.min(t, drawn.end));
      pose.trailAlpha = t < drawn.end ? 1 : 1 - (t - drawn.end) / LINGER;
    }
    return pose;
  }
  if (p.chargeSkill && KIT[p.chargeSkill]) {
    const spec = KIT[p.chargeSkill].charge;
    const held = p.chargeT + age;
    pose.charge = chargeProgress(spec, held);
    // Drawn back behind the shoulder, further with every tier.
    const tier = chargeTier(spec, held).index / Math.max(1, spec.tiers.length - 1);
    pose.angle = p.angle + 1.5 + tier * 0.7;
    pose.tint = tier >= 1 ? 'violet' : tier >= 0.5 ? 'gold' : 'steel';
  }
  return pose;
}

/** The swept area of a strike, filled: a ring slice for a horizontal cut, a strip for a vertical one. */
export function drawTrail(g: Phaser.GameObjects.Graphics, trail: Blade, tint: WaveTint, alpha: number) {
  const glow = hex(WAVE_COLORS[tint].glow);
  const core = hex(WAVE_COLORS[tint].core);
  if (trail.kind === 'lane') {
    const cos = Math.cos(trail.angle);
    const sin = Math.sin(trail.angle);
    const corner = (along: number, across: number) => ({
      x: trail.x + cos * along - sin * across,
      y: trail.y + sin * along + cos * across,
    });
    g.fillStyle(glow, 0.3 * alpha);
    g.fillPoints([corner(trail.near, -trail.halfWidth), corner(trail.far, -trail.halfWidth), corner(trail.far, trail.halfWidth), corner(trail.near, trail.halfWidth)], true);
    g.lineStyle(3, core, 0.95 * alpha);
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
  const inner = Array.from({ length: steps + 1 }, (_, index) => at(Math.max(trail.inner, trail.outer * 0.45), steps - index));
  g.fillStyle(glow, 0.24 * alpha);
  g.fillPoints([...outer, ...inner], true);
  // The edge the tip of the blade drew.
  g.lineStyle(3, core, 0.9 * alpha);
  g.strokePoints(outer);
}

/** A slim blade along +x of a graphics object already rotated to the pose. */
export function drawKitBlade(w: Phaser.GameObjects.Graphics, pose: BladePose, reach: number, time: number, awake: boolean) {
  const length = reach * pose.length;
  const glow = hex(WAVE_COLORS[awake ? 'violet' : pose.tint].glow);
  if (pose.charge > 0 || awake) {
    // The charge gathers along the blade.
    const pulse = 0.5 + 0.5 * Math.sin(time * (0.012 + pose.charge * 0.02));
    w.lineStyle(5 + pose.charge * 5, glow, 0.18 + (awake ? 0.12 : pose.charge * 0.3) + pulse * 0.08);
    w.lineBetween(12, 0, 12 + length, 0);
  }
  w.fillStyle(0x6f5b45);
  w.fillRect(5, -2, 8, 4);
  w.fillStyle(0xf3ce86);
  w.fillRect(12, -6, 3, 12);
  w.fillStyle(0xeef0e4);
  w.fillPoints([{ x: 15, y: -2 }, { x: 11 + length, y: -1.5 }, { x: 15 + length, y: 0 }, { x: 11 + length, y: 1.5 }, { x: 15, y: 2 }], true);
  w.lineStyle(1, 0x9aa3ab, 0.9);
  w.lineBetween(16, 0, 11 + length, 0);
}
