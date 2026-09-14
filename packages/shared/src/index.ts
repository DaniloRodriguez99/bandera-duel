export type Team = 'blue' | 'red';
export type Phase = 'lobby' | 'countdown' | 'playing' | 'capture' | 'finished';
export interface Vec {
  x: number;
  y: number;
}
export interface Rect extends Vec {
  w: number;
  h: number;
}
export const RULES = {
  width: 960,
  height: 540,
  tick: 1 / 30,
  matchTime: 180,
  target: 3,
  radius: 12,
  speed: 175,
  carryMultiplier: 0.85,
  hp: 3,
  swordRange: 55,
  swordArc: Math.PI * 0.72,
  swordWindup: 0.12,
  swordCooldown: 0.6,
  shotCooldown: 0.9,
  arrowSpeed: 390,
  arrowLife: 1.6,
  attackLock: 0.2,
  dashDuration: 0.15,
  dashCooldown: 1.5,
  dashSpeed: 520,
  hurtProtection: 0.35,
  respawn: 3,
  spawnProtection: 1,
  flagReturn: 10,
  pickupLock: 0.7,
  countdown: 3,
  capturePause: 2,
  reconnectSeconds: 15,
} as const;
export const TEAMS: Team[] = ['blue', 'red'];
export const other = (t: Team): Team => (t === 'blue' ? 'red' : 'blue');
export const SPAWNS: Record<Team, Vec> = { blue: { x: 70, y: 270 }, red: { x: 890, y: 270 } };
export const HOMES: Record<Team, Vec> = { blue: { x: 145, y: 270 }, red: { x: 815, y: 270 } };
export const WALLS: Rect[] = [
  { x: 245, y: 116, w: 52, h: 96 },
  { x: 245, y: 328, w: 52, h: 96 },
  { x: 663, y: 116, w: 52, h: 96 },
  { x: 663, y: 328, w: 52, h: 96 },
  { x: 423, y: 164, w: 114, h: 42 },
  { x: 423, y: 334, w: 114, h: 42 },
];
export interface Input {
  seq: number;
  x: number;
  y: number;
  angle: number;
  sword: boolean;
  shot: boolean;
  dash: boolean;
}
export const idleInput = (seq = 0, angle = 0): Input => ({
  seq,
  x: 0,
  y: 0,
  angle,
  sword: false,
  shot: false,
  dash: false,
});
export function sanitizeInput(raw: unknown): Input | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    !Number.isSafeInteger(r.seq) ||
    (r.seq as number) < 0 ||
    !['x', 'y', 'angle'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k]))
  )
    return null;
  if (
    Math.abs(r.x as number) > 1 ||
    Math.abs(r.y as number) > 1 ||
    Math.abs(r.angle as number) > 100
  )
    return null;
  const n = Math.max(1, Math.hypot(r.x as number, r.y as number));
  return {
    seq: r.seq as number,
    x: (r.x as number) / n,
    y: (r.y as number) / n,
    angle: r.angle as number,
    sword: r.sword === true,
    shot: r.shot === true,
    dash: r.dash === true,
  };
}
export function validName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N} _.-]{1,16}$/u.test(name) ? name : null;
}
export interface Player extends Vec {
  id: string;
  name: string;
  team: Team;
  hp: number;
  angle: number;
  ready: boolean;
  connected: boolean;
  ack: number;
  swordCd: number;
  shotCd: number;
  dashCd: number;
  attackLock: number;
  dashLeft: number;
  dashX: number;
  dashY: number;
  windup: number;
  swingAngle: number;
  invuln: number;
  respawnLeft: number;
  hitFlash: number;
}
export interface Flag extends Vec {
  team: Team;
  status: 'home' | 'carried' | 'dropped';
  carrier: string | null;
  returnLeft: number;
  blockedId: string | null;
  lockLeft: number;
}
export interface Arrow extends Vec {
  id: number;
  owner: string;
  team: Team;
  angle: number;
  life: number;
}
export interface GameEvent extends Vec {
  id: number;
  kind: 'sword' | 'shot' | 'hit' | 'death' | 'capture' | 'return' | 'pickup';
  team: Team;
  angle?: number;
}
export interface Snapshot {
  tick: number;
  phase: Phase;
  phaseLeft: number;
  timeLeft: number;
  paused: boolean;
  reconnectLeft: number;
  players: Player[];
  flags: Flag[];
  arrows: Arrow[];
  score: Record<Team, number>;
  winner: Team | 'draw' | null;
  reason: string;
  events: GameEvent[];
}
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function blocked(x: number, y: number, radius = RULES.radius as number): boolean {
  if (
    x - radius < 20 ||
    y - radius < 20 ||
    x + radius > RULES.width - 20 ||
    y + radius > RULES.height - 20
  )
    return true;
  return WALLS.some((w) => {
    const dx = x - Math.max(w.x, Math.min(x, w.x + w.w));
    const dy = y - Math.max(w.y, Math.min(y, w.y + w.h));
    return dx * dx + dy * dy < radius * radius;
  });
}
export function translate(p: Vec, dx: number, dy: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < steps; i++) {
    if (!blocked(p.x + dx / steps, p.y)) p.x += dx / steps;
    if (!blocked(p.x, p.y + dy / steps)) p.y += dy / steps;
  }
}
export function lineClear(a: Vec, b: Vec): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 5));
  for (let i = 1; i <= steps; i++)
    if (blocked(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, 1)) return false;
  return true;
}
/** Shared fixed-step movement; never accepts client coordinates or elapsed time. */
export function movePlayer(p: Player, input: Input, carrying: boolean, dt = RULES.tick as number) {
  if (p.hp <= 0) return;
  p.angle = input.angle;
  p.dashCd = Math.max(0, p.dashCd - dt);
  if (input.dash && p.dashCd <= 0) {
    const mag = Math.hypot(input.x, input.y);
    p.dashX = mag > 0.05 ? input.x / mag : Math.cos(input.angle);
    p.dashY = mag > 0.05 ? input.y / mag : Math.sin(input.angle);
    p.dashLeft = RULES.dashDuration;
    p.dashCd = RULES.dashCooldown;
  }
  const dashDt = Math.min(dt, p.dashLeft);
  if (dashDt > 0)
    translate(p, p.dashX * RULES.dashSpeed * dashDt, p.dashY * RULES.dashSpeed * dashDt);
  p.dashLeft = Math.max(0, p.dashLeft - dt);
  const speed = RULES.speed * (carrying ? RULES.carryMultiplier : 1);
  translate(p, input.x * speed * (dt - dashDt), input.y * speed * (dt - dashDt));
}
export function newPlayer(id: string, name: string, team: Team): Player {
  return {
    id,
    name,
    team,
    ...SPAWNS[team],
    hp: 3,
    angle: team === 'blue' ? 0 : Math.PI,
    ready: false,
    connected: true,
    ack: 0,
    swordCd: 0,
    shotCd: 0,
    dashCd: 0,
    attackLock: 0,
    dashLeft: 0,
    dashX: 0,
    dashY: 0,
    windup: 0,
    swingAngle: 0,
    invuln: 0,
    respawnLeft: 0,
    hitFlash: 0,
  };
}
const newFlag = (team: Team): Flag => ({
  team,
  ...HOMES[team],
  status: 'home',
  carrier: null,
  returnLeft: 0,
  blockedId: null,
  lockLeft: 0,
});
export class Duel {
  state: Snapshot = {
    tick: 0,
    phase: 'lobby',
    phaseLeft: 0,
    timeLeft: RULES.matchTime,
    paused: false,
    reconnectLeft: 0,
    players: [],
    flags: TEAMS.map(newFlag),
    arrows: [],
    score: { blue: 0, red: 0 },
    winner: null,
    reason: '',
    events: [],
  };
  private eventId = 0;
  private arrowId = 0;
  add(id: string, name: string) {
    const team = TEAMS.find((t) => !this.state.players.some((p) => p.team === t));
    if (!team) throw Error('Sala llena');
    const p = newPlayer(id, name, team);
    this.state.players.push(p);
    return p;
  }
  event(kind: GameEvent['kind'], where: Vec, team: Team, angle?: number) {
    this.state.events.push({ id: ++this.eventId, kind, x: where.x, y: where.y, team, angle });
    this.state.events = this.state.events.slice(-24);
  }
  ready(id: string) {
    const s = this.state,
      p = s.players.find((p) => p.id === id);
    if (!p || s.paused || !['lobby', 'finished'].includes(s.phase)) return;
    p.ready = !p.ready;
    if (s.players.length === 2 && s.players.every((p) => p.ready && p.connected)) {
      s.score = { blue: 0, red: 0 };
      s.timeLeft = RULES.matchTime;
      s.winner = null;
      s.reason = '';
      s.phase = 'countdown';
      s.phaseLeft = RULES.countdown;
      this.resetArena();
    }
  }
  resetArena() {
    const s = this.state;
    s.arrows = [];
    s.flags = TEAMS.map(newFlag);
    s.players = s.players.map((p) => ({
      ...newPlayer(p.id, p.name, p.team),
      connected: p.connected,
      ack: p.ack,
    }));
  }
  finish(winner: Team | 'draw', reason: string) {
    const s = this.state;
    s.phase = 'finished';
    s.winner = winner;
    s.reason = reason;
    s.players.forEach((p) => (p.ready = false));
    s.paused = false;
    s.reconnectLeft = 0;
  }
  returnFlag(f: Flag) {
    Object.assign(f, newFlag(f.team));
    this.event('return', f, f.team);
  }
  drop(p: Player) {
    const f = this.state.flags.find((f) => f.carrier === p.id);
    if (f) {
      Object.assign(f, {
        status: 'dropped',
        carrier: null,
        x: p.x,
        y: p.y,
        returnLeft: RULES.flagReturn,
        blockedId: p.id,
        lockLeft: RULES.pickupLock,
      });
    }
  }
  damage(target: Player, source: Player, angle: number) {
    if (target.hp <= 0 || target.invuln > 0) return;
    target.hp--;
    target.invuln = RULES.hurtProtection;
    target.hitFlash = 0.18;
    this.drop(target);
    this.event('hit', target, source.team);
    if (target.hp === 0) {
      target.respawnLeft = RULES.respawn;
      target.windup = 0;
      target.dashLeft = 0;
      this.event('death', target, target.team);
    } else translate(target, Math.cos(angle) * 24, Math.sin(angle) * 24);
  }
  step(inputs: Map<string, Input>, dt = RULES.tick as number) {
    const s = this.state;
    s.tick++;
    if (s.paused || s.phase === 'lobby' || s.phase === 'finished') return;
    if (s.phase === 'countdown' || s.phase === 'capture') {
      s.phaseLeft = Math.max(0, s.phaseLeft - dt);
      if (s.phaseLeft <= 0) s.phase = 'playing';
      return;
    }
    s.timeLeft = Math.max(0, s.timeLeft - dt);
    if (s.timeLeft <= 0) {
      this.finish(
        s.score.blue === s.score.red ? 'draw' : s.score.blue > s.score.red ? 'blue' : 'red',
        'tiempo',
      );
      return;
    }
    for (const p of s.players) {
      const input = inputs.get(p.id) || idleInput(p.ack, p.angle);
      p.ack = Math.max(p.ack, input.seq);
      if (p.hp <= 0) {
        p.respawnLeft -= dt;
        if (p.respawnLeft <= 0)
          Object.assign(p, newPlayer(p.id, p.name, p.team), {
            ack: p.ack,
            invuln: RULES.spawnProtection,
          });
        continue;
      }
      p.swordCd = Math.max(0, p.swordCd - dt);
      p.shotCd = Math.max(0, p.shotCd - dt);
      p.attackLock = Math.max(0, p.attackLock - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      movePlayer(
        p,
        input,
        s.flags.some((f) => f.carrier === p.id),
        dt,
      );
      if (p.windup > 0) {
        p.windup = Math.max(0, p.windup - dt);
        if (p.windup === 0) {
          this.event('sword', p, p.team, p.swingAngle);
          for (const q of s.players) {
            const angle = Math.atan2(q.y - p.y, q.x - p.x),
              diff = Math.atan2(Math.sin(angle - p.swingAngle), Math.cos(angle - p.swingAngle));
            if (
              q.team !== p.team &&
              distance(p, q) <= RULES.swordRange &&
              Math.abs(diff) < RULES.swordArc / 2 &&
              lineClear(p, q)
            )
              this.damage(q, p, angle);
          }
        }
      }
      if (input.sword && p.swordCd <= 0 && p.attackLock <= 0) {
        p.invuln = 0;
        p.windup = RULES.swordWindup;
        p.swingAngle = p.angle;
        p.swordCd = RULES.swordCooldown;
        p.attackLock = RULES.attackLock;
      } else if (input.shot && p.shotCd <= 0 && p.attackLock <= 0) {
        p.invuln = 0;
        p.shotCd = RULES.shotCooldown;
        p.attackLock = RULES.attackLock;
        s.arrows.push({
          id: ++this.arrowId,
          owner: p.id,
          team: p.team,
          x: p.x,
          y: p.y,
          angle: p.angle,
          life: RULES.arrowLife,
        });
        this.event('shot', p, p.team, p.angle);
      }
    }
    s.arrows = s.arrows.filter((a) => {
      a.life -= dt;
      if (a.life <= 0) return false;
      const owner = s.players.find((p) => p.id === a.owner);
      if (!owner) return false;
      const steps = Math.ceil((RULES.arrowSpeed * dt) / 5);
      for (let i = 0; i < steps; i++) {
        a.x += (Math.cos(a.angle) * RULES.arrowSpeed * dt) / steps;
        a.y += (Math.sin(a.angle) * RULES.arrowSpeed * dt) / steps;
        if (blocked(a.x, a.y, 3)) return false;
        const target = s.players.find(
          (p) => p.team !== a.team && p.hp > 0 && distance(p, a) < RULES.radius + 3,
        );
        if (target) {
          this.damage(target, owner, a.angle);
          return false;
        }
      }
      return true;
    });
    // Own-flag returns precede enemy pickups and scoring, independent of player iteration order.
    for (const f of s.flags) {
      f.lockLeft = Math.max(0, f.lockLeft - dt);
      if (f.status === 'dropped') {
        f.returnLeft -= dt;
        if (
          f.returnLeft <= 0 ||
          s.players.some((p) => p.team === f.team && p.hp > 0 && distance(p, f) < 25)
        )
          this.returnFlag(f);
      }
    }
    for (const f of s.flags) {
      if (f.status !== 'carried') {
        const p = s.players.find(
          (p) =>
            p.team !== f.team &&
            p.hp > 0 &&
            distance(p, f) < 25 &&
            !(f.blockedId === p.id && f.lockLeft > 0),
        );
        if (p) {
          f.status = 'carried';
          f.carrier = p.id;
          p.invuln = 0;
          this.event('pickup', p, p.team);
        }
      }
      const carrier = s.players.find((p) => p.id === f.carrier);
      if (carrier) {
        f.x = carrier.x;
        f.y = carrier.y;
      }
    }
    for (const p of s.players) {
      if (
        p.hp > 0 &&
        s.flags.some((f) => f.carrier === p.id) &&
        s.flags.find((f) => f.team === p.team)?.status === 'home' &&
        distance(p, HOMES[p.team]) < 38
      ) {
        s.score[p.team]++;
        this.event('capture', p, p.team);
        this.resetArena();
        if (s.score[p.team] >= RULES.target) this.finish(p.team, 'capturas');
        else {
          s.phase = 'capture';
          s.phaseLeft = RULES.capturePause;
        }
        break;
      }
    }
  }
}
