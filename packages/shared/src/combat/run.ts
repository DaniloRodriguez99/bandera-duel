import type { Player, SkillId, SlotInputState } from '../index.js';
import { chargeTier } from './defs.js';
import { KIT, KNIGHT_AWAKEN, MOVES, WARRIOR_PARRY, WARRIOR_REINFORCE } from './kits.js';

/**
 * Runs the kit skills of one player for one tick. Every such skill goes the same way:
 *
 *   input → aim captured → charge tier → resource check → move → blades and slashes → recovery
 *
 * It only advances the player's own state and says what happened; whoever owns the arena resolves
 * the hits. That keeps it safe to run on the client as prediction.
 */

/** How long a press that came too early waits for the running move to end. */
export const INPUT_BUFFER = 0.25;
const EPS = 1e-8;
const IDLE: SlotInputState = { pressed: false, held: false, released: false };

/** A stretch of a strike swept this tick. */
export interface KitSweep {
  move: string;
  strike: number;
  since: number;
  until: number;
  angle: number;
}

/** A launch beginning this tick. */
export interface KitDash {
  angle: number;
  distance: number;
  speed: number;
  iframes: boolean;
  hit?: { damage: number; knockback: number; shock?: number };
}

export interface KitResult {
  sweeps: KitSweep[];
  /** Slashes leaving the blade this tick. */
  waves: { move: string; index: number; angle: number; charge: number }[];
  /** The move that began this tick. */
  started: string | null;
  /** The step forward to take this tick, along the running move's aim. */
  lunge: number;
  lungeAngle: number;
  /** The first tick of a hold, so everyone hears the charge begin. */
  chargeStarted: SkillId | null;
  /** The fighter's empowered state began: the knight's awakening, the warrior's reinforcement. */
  empowered: boolean;
  dash: KitDash | null;
}

export interface KitContext {
  /** The aimDirection this tick. */
  angle: number;
  dt: number;
  /** Whether a skill may start now: off cooldown, paid for, its slot not kept busy. */
  ready(id: SkillId): boolean;
  /** Puts a skill on cooldown. */
  cool(id: SkillId, seconds: number): void;
  /** Takes what a skill costs as it goes out. */
  pay(id: SkillId): void;
  /** Pays for holding a skill `seconds` longer; false when the pool cannot, and the charge stops growing. */
  hold(id: SkillId, seconds: number): boolean;
}

/** Whether nothing the player is doing stops mobility or a parry from cutting in. */
export const moveRecovering = (p: Pick<Player, 'move' | 'moveT'>) =>
  !p.move || p.moveT >= MOVES[p.move].recoverFrom - EPS;

/**
 * Drops the charge being held. A charge that something else ended stays ended while its key is
 * still down: it takes a new press, so a release afterwards never fires what was left of it.
 */
export function dropCharge(p: Player) {
  if (!p.chargeSkill) return;
  p.chargeBroken = p.chargeSkill;
  p.chargeSkill = '';
  p.chargeT = 0;
}

/** Drops whatever the player was winding up or charging, as a stun or a death does. */
export function clearKit(p: Player) {
  dropCharge(p);
  p.move = '';
  p.moveT = 0;
  p.buffered = '';
  p.bufferLeft = 0;
  p.combo = 0;
  p.comboLeft = 0;
}

function startMove(p: Player, id: SkillId, charge: number, ctx: KitContext, out: KitResult) {
  const skill = KIT[id];
  const tier = chargeTier(skill.charge, charge).index;
  const step = skill.chain > 1 ? p.combo % skill.chain : 0;
  // Each kit decides what its empowered state changes in a move.
  const move = skill.move(step, tier, p.furyLeft > 0);
  const def = MOVES[move];
  p.move = move;
  p.moveT = 0;
  // The aim is taken here, at the moment the move goes out, and kept until it ends.
  p.moveAngle = ctx.angle;
  p.moveCharge = charge;
  if (skill.chain > 1) {
    p.combo = (step + 1) % skill.chain;
    p.comboLeft = def.duration + skill.chainReset;
  }
  const cooldown = skill.cooldown(tier, charge);
  if (cooldown > 0) ctx.cool(id, cooldown);
  ctx.pay(id);
  if (def.effect === 'awaken' || def.effect === 'reinforce') {
    p.empowered = def.effect;
    p.furyLeft = def.effect === 'awaken' ? KNIGHT_AWAKEN.duration : WARRIOR_REINFORCE.duration;
    out.empowered = true;
  } else if (def.effect === 'parry') {
    // Hordas: each rank of the warrior's own upgrade holds the guard up longer.
    p.counterLeft = WARRIOR_PARRY.window * (1 + (p.pve?.classRanks.vanguard ?? 0) * 0.15);
  }
  // Mobility drops the charge of a skill that cannot survive it.
  if (skill.alongside && p.chargeSkill && p.chargeSkill !== id && KIT[p.chargeSkill].charge.cancelOnMobility)
    dropCharge(p);
  out.started = move;
}

export function stepKit(
  p: Player,
  skills: readonly SkillId[],
  input: Partial<Record<SkillId, SlotInputState>>,
  ctx: KitContext,
): KitResult {
  const out: KitResult = {
    sweeps: [],
    waves: [],
    started: null,
    lunge: 0,
    lungeAngle: p.moveAngle,
    chargeStarted: null,
    empowered: false,
    dash: null,
  };
  const { dt } = ctx;
  // The chain waits while its own skill is being charged: a full charge outlasts the wait, and
  // the third cut must still be the one that goes out.
  const chaining = p.chargeSkill !== '' && KIT[p.chargeSkill].chain > 1;
  if (p.comboLeft > 0 && !chaining) {
    p.comboLeft = Math.max(0, p.comboLeft - dt);
    if (p.comboLeft <= EPS) {
      p.comboLeft = 0;
      p.combo = 0;
    }
  }
  if (p.bufferLeft > 0) {
    p.bufferLeft = Math.max(0, p.bufferLeft - dt);
    if (p.bufferLeft <= EPS) {
      p.bufferLeft = 0;
      p.buffered = '';
    }
  }

  // The running move: what its blades sweep this tick, the slashes it lets go, and its end.
  if (p.move) {
    const move = MOVES[p.move];
    const since = p.moveT;
    const until = Math.min(move.duration, since + dt);
    const crosses = (at: number) => since - EPS <= at && at < until - EPS;
    move.strikes.forEach((strike, index) => {
      if (until <= strike.start + EPS || since >= strike.end - EPS) return;
      const from = Math.max(since, strike.start);
      const to = Math.min(until, strike.end);
      out.sweeps.push({ move: p.move, strike: index, since: from, until: to, angle: p.moveAngle });
      if (strike.lunge) out.lunge += (strike.lunge * (to - from)) / (strike.end - strike.start);
    });
    move.waves.forEach((wave, index) => {
      if (crosses(wave.at)) out.waves.push({ move: p.move, index, angle: p.moveAngle, charge: p.moveCharge });
    });
    if (move.dash && crosses(move.dash.at))
      out.dash = {
        angle: p.moveAngle,
        distance: move.dash.distance(p.moveCharge),
        speed: move.dash.speed,
        iframes: move.dash.iframes,
        hit: move.dash.hit,
      };
    p.moveT = until;
    if (until >= move.duration - EPS) {
      p.move = '';
      p.moveT = 0;
    }
  }

  // The keys. Held, a skill charges; released, it asks to go out at the tier it reached. A hold
  // that ends without a release (a touch dragged back to the centre) is dropped.
  for (const id of skills) {
    const skill = KIT[id];
    if (!skill) continue;
    const state = input[id] ?? IDLE;
    if (skill.instant) {
      if (state.pressed && ctx.ready(id)) {
        p.buffered = id;
        p.bufferCharge = 0;
        p.bufferLeft = INPUT_BUFFER;
      }
      continue;
    }
    const held = state.held || state.pressed;
    // A charge that something else ended waits for its key to be pressed again.
    if (p.chargeBroken === id) {
      if (held && !state.pressed) continue;
      p.chargeBroken = '';
    }
    // Mobility never waits for another charge: let go, it goes out as it is.
    if (skill.alongside && p.chargeSkill && p.chargeSkill !== id) {
      if (state.released && ctx.ready(id)) {
        p.buffered = id;
        p.bufferCharge = 0;
        p.bufferLeft = INPUT_BUFFER;
      }
      continue;
    }
    if (held && !p.chargeSkill && ctx.ready(id)) {
      p.chargeSkill = id;
      p.chargeT = 0;
      out.chargeStarted = id;
    }
    if (p.chargeSkill !== id) continue;
    if (state.released) {
      p.buffered = id;
      p.bufferCharge = p.chargeT;
      p.bufferLeft = INPUT_BUFFER;
    } else if (held) {
      // Holding may cost by the second; a pool that runs dry leaves the charge where it is.
      const growth = Math.min(dt, skill.charge.cap - p.chargeT);
      if (growth > 1e-9 && ctx.hold(id, growth)) p.chargeT = Math.min(skill.charge.cap, p.chargeT + dt);
      continue;
    }
    p.chargeSkill = '';
    p.chargeT = 0;
  }

  // A request waits for the running move to end, then goes out with the aim of that moment. A
  // parry or a launch does not wait that long: it cuts into a recovery.
  if (p.buffered && (!p.move || (KIT[p.buffered]?.interrupts && moveRecovering(p)))) {
    const id = p.buffered;
    p.buffered = '';
    p.bufferLeft = 0;
    startMove(p, id, p.bufferCharge, ctx, out);
  }
  return out;
}
