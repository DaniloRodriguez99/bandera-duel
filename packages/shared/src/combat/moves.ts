import type { ChargeSpec, WaveSpec, WaveTint } from './defs.js';
import type { Blade, Point } from './geometry.js';

/**
 * A move: everything one press of an attack does, laid out in time. The simulation runs it, tests
 * its blades and launches its slashes; the client draws the weapon from the same timeline.
 */

/** The simulation's step. Moves are written in whole steps so nothing lands between two of them. */
export const TICK = 1 / 30;
export const frames = (count: number) => count * TICK;

/**
 * Where a blade passes. An arc sweeps from `from` to `to`, both relative to the aim (positive is
 * the swordsman's right). A lane runs along the aim out to `length`: a thrust reaches out from the
 * hilt to the tip, while a blade brought down from overhead (`drop`) lands along all of it at once.
 */
export type StrikeShape =
  | { kind: 'arc'; from: number; to: number; inner: number; reach: number }
  | { kind: 'lane'; length: number; halfWidth: number; drop?: boolean };

export interface StrikeDef {
  /** Seconds into the move the blade starts and stops cutting. */
  start: number;
  end: number;
  shape: StrikeShape;
  damage: number;
  knockback: number;
  /** Cut power against the enemy skills the blade crosses; 0 cuts nothing. */
  cut: number;
  crit?: boolean;
  /**
   * One of several blows of the same move: on a body an earlier one already hit, it lands through
   * the hurt protection that blow left.
   */
  sibling?: boolean;
  /** Forward step taken while it cuts. */
  lunge?: number;
}

/** A slash that leaves the blade at `at`. A function makes it from the seconds the move was charged. */
export interface MoveWave {
  at: number;
  wave: WaveSpec | ((charge: number) => WaveSpec);
}

export interface MoveDef {
  /** Shown while it runs, and the key of its animation. */
  name: string;
  duration: number;
  strikes: readonly StrikeDef[];
  waves: readonly MoveWave[];
  /** Movement speed factor while it runs. */
  speed: number;
  /** From here on it is only recovering: mobility or a parry may cut in. */
  recoverFrom: number;
  /**
   * What starting it does besides swinging: raises the parry, or turns on its fighter's empowered
   * state (the knight's awakened blade, the warrior's reinforced body).
   */
  effect?: 'awaken' | 'parry' | 'reinforce';
  /** A launch: at `at` the body travels `distance` along the move's aim, and shoves whoever it runs into. */
  dash?: MoveDash;
  /**
   * Where the blade is when the move begins, relative to the aim: the step before it in its chain
   * left it there, so the wind-up starts from that side instead of from rest.
   */
  enter?: number;
  /** The colour of its trail, when it throws no slash to take it from. */
  tint?: WaveTint;
  /**
   * The swing the blade makes when the move has no strike of its own: the turn that throws a slash
   * from a distance. It is drawn, never tested against anyone.
   */
  flourish?: Swing;
}

/** When and where a blade passes: the part of a strike that is its shape in time. */
export type Swing = Pick<StrikeDef, 'start' | 'end' | 'shape'>;

export interface MoveDash {
  at: number;
  speed: number;
  /** By the seconds the move was charged. */
  distance: (charge: number) => number;
  /** Invulnerable while travelling. */
  iframes: boolean;
  /** What running into an enemy does, once per enemy per launch. */
  hit?: { damage: number; knockback: number };
}

/** How a kit skill turns a press into moves. */
export interface KitSkill {
  charge: ChargeSpec;
  /** Steps of its chain; 1 when every use is the same move. */
  chain: number;
  /** Seconds after a step ends before the chain starts over. */
  chainReset: number;
  /** The move for a step of the chain, released at a charge tier. `awake`: the empowered state. */
  move(step: number, tier: number, awake: boolean): string;
  /** Seconds before it can be used again, by the tier it went out at. */
  cooldown(tier: number, charge: number): number;
  /** Goes out the moment its key goes down, with no charge to hold. */
  instant?: boolean;
  /** May cut into another move's recovery instead of waiting for it to end. */
  interrupts?: boolean;
  /**
   * Mobility: while another skill is being charged it still goes out, uncharged, when its key is
   * let go, and that charge is kept unless it says a mobility cancels it.
   */
  alongside?: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * The slice of a strike's path the blade covers between two moments of its move, for someone
 * standing at `origin` and aiming along `aim`. Null while the blade is not cutting.
 */
export function bladeAt(strike: Swing, origin: Point, aim: number, since: number, until: number): Blade | null {
  if (until <= strike.start + 1e-8 || since >= strike.end - 1e-8) return null;
  const span = strike.end - strike.start;
  const from = clamp01((since - strike.start) / span);
  const to = clamp01((until - strike.start) / span);
  const shape = strike.shape;
  if (shape.kind === 'arc') {
    const turn = shape.to - shape.from;
    return {
      kind: 'arc',
      x: origin.x,
      y: origin.y,
      from: aim + shape.from + turn * from,
      to: aim + shape.from + turn * to,
      inner: shape.inner,
      outer: shape.reach,
    };
  }
  return {
    kind: 'lane',
    x: origin.x,
    y: origin.y,
    angle: aim,
    // Brought down from overhead, the blade lands along its whole length at once.
    near: shape.drop ? 0 : shape.length * from,
    far: shape.drop ? shape.length : shape.length * to,
    halfWidth: shape.halfWidth,
  };
}

/** How far the longest blade of a move reaches, for previews and for the ones who dodge it. */
export const moveReach = (move: MoveDef) =>
  Math.max(0, ...move.strikes.map((strike) => (strike.shape.kind === 'arc' ? strike.shape.reach : strike.shape.length)));
