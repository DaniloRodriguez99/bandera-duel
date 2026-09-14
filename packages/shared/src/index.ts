export type Team = 'blue' | 'red' | 'green' | 'violet';
export type Phase = 'lobby' | 'countdown' | 'playing' | 'capture' | 'finished';
export type ClassId = 'archer' | 'mage' | 'guardian' | 'vanguard';
export const CLASS_IDS: ClassId[] = ['archer', 'mage', 'guardian', 'vanguard'];
export const DEFAULT_CLASS: ClassId = 'guardian';
export function validClass(value: unknown): value is ClassId {
  return typeof value === 'string' && CLASS_IDS.includes(value as ClassId);
}
export const CLASSES = {
  archer: { name: 'Arquero', label: 'ARCO Y DAGA', description: 'Distancia, precisión y una salida rápida.', hp: 3, speed: 190, meleeDamage: .5, meleeRange: 30, meleeArc: Math.PI * .6, windup: .1, meleeCooldown: .5, ranged: true, shield: false, dash: true },
  mage: { name: 'Mago', label: 'MAGIA Y BÁCULO', description: 'Hechizos a distancia y movilidad arcana.', hp: 3, speed: 180, meleeDamage: .5, meleeRange: 34, meleeArc: Math.PI * .6, windup: .12, meleeCooldown: .55, ranged: true, shield: false, dash: true },
  guardian: { name: 'Caballero', label: 'ESPADA Y ESCUDO', description: 'Protegé tu bandera. Respondé de cerca.', hp: 3, speed: 180, meleeDamage: 1, meleeRange: 55, meleeArc: Math.PI * .72, windup: .12, meleeCooldown: .6, ranged: false, shield: true, dash: false },
  vanguard: { name: 'Guerrero', label: 'ESPADA DE DOS MANOS', description: 'Más alcance. Más daño. Acero pesado.', hp: 5, speed: 155, meleeDamage: 2, meleeRange: 80, meleeArc: Math.PI * 130 / 180, windup: .3, meleeCooldown: 1, ranged: false, shield: false, dash: false },
} as const;
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
  carryMultiplier: 0.85,
  shotCooldown: 0.9,
  arrowSpeed: 560,
  arrowLife: 1.2,
  arrowDamage: 1,
  guardDuration: 1.2,
  guardCooldown: 1.5,
  guardRecovery: .15,
  guardSpeed: .25,
  guardArc: Math.PI * 2 / 3,
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
  maxPlayers: 4,
  maxDeaths: 5,
} as const;
export const TEAMS: Team[] = ['blue', 'red', 'green', 'violet'];
export const TEAM_NAMES: Record<Team, string> = { blue: 'AZUR', red: 'CARMESÍ', green: 'JADE', violet: 'VIOLETA' };
export const TEAM_ICONS: Record<Team, string> = { blue: '◆', red: '✚', green: '▲', violet: '●' };
export const emptyScore = (): Record<Team, number> => ({ blue: 0, red: 0, green: 0, violet: 0 });
export const SPAWNS = { blue: { x: 70, y: 270 }, red: { x: 890, y: 270 } } satisfies Record<string, Vec>;
export const HOMES = { blue: { x: 145, y: 270 }, red: { x: 815, y: 270 } } satisfies Record<string, Vec>;
export const CORNER_SPAWNS: Record<Team, Vec> = { blue: { x: 70, y: 120 }, red: { x: 890, y: 120 }, green: { x: 70, y: 420 }, violet: { x: 890, y: 420 } };
export const CORNER_HOMES: Record<Team, Vec> = { blue: { x: 145, y: 120 }, red: { x: 815, y: 120 }, green: { x: 145, y: 420 }, violet: { x: 815, y: 420 } };
export interface Base {
  team: Team;
  home: Vec;
  spawn: Vec;
}
/** Two players keep the classic left/right duel; three or four take the corners. */
export function layout(teams: Team[]): Base[] {
  const sides = ['blue', 'red'] as const;
  return teams.map((team, i) =>
    teams.length <= 2
      ? { team, home: { ...HOMES[sides[i]] }, spawn: { ...SPAWNS[sides[i]] } }
      : { team, home: { ...CORNER_HOMES[team] }, spawn: { ...CORNER_SPAWNS[team] } },
  );
}
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
  guard: boolean;
}
export const idleInput = (seq = 0, angle = 0): Input => ({
  seq,
  x: 0,
  y: 0,
  angle,
  sword: false,
  shot: false,
  dash: false,
  guard: false,
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
    guard: r.guard === true,
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
  classId: ClassId;
  maxHp: number;
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
  dashInvulnerable: boolean;
  guarding: boolean;
  guardLeft: number;
  guardCd: number;
  guardRecovery: number;
  guardHeld: boolean;
  windup: number;
  swingAngle: number;
  invuln: number;
  respawnLeft: number;
  hitFlash: number;
  deaths: number;
  eliminated: boolean;
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
  classId: ClassId;
  angle: number;
  life: number;
}
export interface GameEvent extends Vec {
  id: number;
  kind: 'sword' | 'shot' | 'hit' | 'death' | 'capture' | 'return' | 'pickup' | 'block';
  team: Team;
  angle?: number;
  classId?: ClassId;
}
export interface Snapshot {
  tick: number;
  phase: Phase;
  phaseLeft: number;
  timeLeft: number;
  paused: boolean;
  reconnectLeft: number;
  players: Player[];
  bases: Base[];
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
export function lowerGuard(p: Player) {
  if (!p.guarding) return;
  p.guarding = false;
  p.guardLeft = 0;
  p.guardCd = RULES.guardCooldown;
  p.guardRecovery = RULES.guardRecovery;
}
/** Shared fixed-step prediction of timers, defense, attacks and movement. */
export function movePlayer(p: Player, input: Input, carrying: boolean, dt = RULES.tick as number) {
  const result = { swing: false, shoot: false };
  if (p.hp <= 0) return result;
  const stats = CLASSES[p.classId];
  const wasWinding = p.windup > 0;
  for (const key of ['swordCd','shotCd','dashCd','attackLock','invuln','hitFlash','guardCd','guardRecovery'] as const)
    p[key] = Math.max(0, p[key] - dt);
  p.angle = input.angle;
  if (p.guarding && (!input.guard || p.guardLeft <= 1e-8)) lowerGuard(p);
  if (stats.shield && input.guard && !p.guardHeld && !p.guarding && p.guardCd <= 0 && p.guardRecovery <= 0 && !wasWinding && p.attackLock <= 0) {
    p.guarding = true;
    p.guardLeft = RULES.guardDuration;
  }
  p.guardHeld = input.guard;
  if (stats.dash && input.dash && p.dashCd <= 0 && !wasWinding && p.attackLock <= 0) {
    const mag = Math.hypot(input.x, input.y);
    p.dashX = mag > 0.05 ? input.x / mag : Math.cos(input.angle);
    p.dashY = mag > 0.05 ? input.y / mag : Math.sin(input.angle);
    p.dashLeft = RULES.dashDuration;
    p.dashCd = RULES.dashCooldown;
  }
  const dashDt = Math.min(dt, p.dashLeft);
  p.dashInvulnerable = dashDt > 1e-8;
  if (dashDt > 0)
    translate(p, p.dashX * RULES.dashSpeed * dashDt, p.dashY * RULES.dashSpeed * dashDt);
  p.dashLeft = Math.max(0, p.dashLeft - dt);
  const speed = stats.speed * (carrying ? RULES.carryMultiplier : 1) * (p.guarding ? RULES.guardSpeed : 1);
  translate(p, input.x * speed * (dt - dashDt), input.y * speed * (dt - dashDt));
  if (wasWinding) {
    p.windup = Math.max(0, p.windup - dt);
    result.swing = p.windup === 0;
  }
  if (!p.guarding && p.guardRecovery <= 0 && !p.dashInvulnerable && p.attackLock <= 0 && !wasWinding) {
    if (input.sword && p.swordCd <= 0) {
      p.invuln = 0;
      p.windup = stats.windup;
      p.swingAngle = p.angle;
      p.swordCd = stats.meleeCooldown;
      p.attackLock = RULES.attackLock;
    } else if (input.shot && stats.ranged && p.shotCd <= 0) {
      p.invuln = 0;
      p.shotCd = RULES.shotCooldown;
      p.attackLock = RULES.attackLock;
      result.shoot = true;
    }
  }
  if (p.guarding) p.guardLeft = Math.max(0,p.guardLeft-dt);
  return result;
}
export function newPlayer(
  id: string,
  name: string,
  team: Team,
  classId: ClassId = DEFAULT_CLASS,
  spawn: Vec = team === 'blue' || team === 'red' ? SPAWNS[team] : CORNER_SPAWNS[team],
): Player {
  return {
    id,
    name,
    team,
    ...spawn,
    classId,
    hp: CLASSES[classId].hp,
    maxHp: CLASSES[classId].hp,
    angle: spawn.x < RULES.width / 2 ? 0 : Math.PI,
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
    dashInvulnerable: false,
    guarding: false,
    guardLeft: 0,
    guardCd: 0,
    guardRecovery: 0,
    guardHeld: false,
    windup: 0,
    swingAngle: 0,
    invuln: 0,
    respawnLeft: 0,
    hitFlash: 0,
    deaths: 0,
    eliminated: false,
  };
}
const newFlag = ({ team, home }: Base): Flag => ({
  team,
  ...home,
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
    bases: [],
    flags: [],
    arrows: [],
    score: emptyScore(),
    winner: null,
    reason: '',
    events: [],
  };
  private eventId = 0;
  private arrowId = 0;
  add(id: string, name: string, classId: ClassId = DEFAULT_CLASS) {
    const s = this.state;
    const team = TEAMS.find((t) => !s.players.some((p) => p.team === t));
    if (!team || s.players.length >= RULES.maxPlayers) throw Error('Sala llena');
    const p = newPlayer(id, name, team, classId);
    s.players.push(p);
    this.arrange();
    return p;
  }
  remove(id: string) {
    const s = this.state;
    s.players = s.players.filter((p) => p.id !== id);
    s.players.forEach((p) => (p.ready = false));
    if (s.phase === 'lobby') this.arrange();
  }
  base(team: Team): Base {
    return this.state.bases.find((b) => b.team === team) ?? layout([team])[0];
  }
  private arrange() {
    const s = this.state;
    s.bases = layout(s.players.map((p) => p.team));
    s.flags = s.bases.map(newFlag);
    for (const p of s.players) {
      const spawn = this.base(p.team).spawn;
      Object.assign(p, spawn, { angle: spawn.x < RULES.width / 2 ? 0 : Math.PI });
    }
  }
  private revive(p: Player, invuln = 0) {
    Object.assign(p, newPlayer(p.id, p.name, p.team, p.classId, this.base(p.team).spawn), {
      ack: p.ack,
      connected: p.connected,
      deaths: p.deaths,
      eliminated: p.eliminated,
      invuln,
    });
  }
  event(kind: GameEvent['kind'], where: Vec, team: Team, angle?: number, classId?: ClassId) {
    this.state.events.push({ id: ++this.eventId, kind, x: where.x, y: where.y, team, angle, classId });
    this.state.events = this.state.events.slice(-24);
  }
  ready(id: string) {
    const s = this.state,
      p = s.players.find((p) => p.id === id);
    if (!p || s.paused || !['lobby', 'finished'].includes(s.phase)) return;
    p.ready = !p.ready;
    if (s.players.length >= 2 && s.players.every((p) => p.ready && p.connected)) {
      s.score = emptyScore();
      s.timeLeft = RULES.matchTime;
      s.winner = null;
      s.reason = '';
      s.phase = 'countdown';
      s.phaseLeft = RULES.countdown;
      s.players.forEach((p) => Object.assign(p, { deaths: 0, eliminated: false }));
      this.arrange();
      this.resetArena();
    }
  }
  selectClass(id: string, classId: ClassId): boolean {
    const s = this.state, p = s.players.find(p => p.id === id);
    if (!p || !validClass(classId) || s.paused || !['lobby','finished'].includes(s.phase)) return false;
    if (p.classId === classId) return true;
    Object.assign(p, newPlayer(p.id,p.name,p.team,classId,this.base(p.team).spawn), { ack: p.ack, connected: p.connected });
    s.players.forEach(p => p.ready = false);
    return true;
  }
  resetArena() {
    const s = this.state;
    s.arrows = [];
    s.flags = s.bases
      .filter((b) => s.players.some((p) => p.team === b.team && !p.eliminated))
      .map(newFlag);
    for (const p of s.players) {
      this.revive(p);
      if (p.eliminated) p.hp = 0;
    }
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
    Object.assign(f, newFlag(this.base(f.team)));
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
  eliminate(p: Player, reason = 'eliminación') {
    const s = this.state;
    if (p.eliminated) return;
    Object.assign(p, { eliminated: true, hp: 0, respawnLeft: 0, windup: 0, dashLeft: 0, dashInvulnerable: false });
    lowerGuard(p);
    this.drop(p);
    s.flags = s.flags.filter((f) => f.team !== p.team);
    const alive = s.players.filter((q) => !q.eliminated);
    if (alive.length === 1 && s.phase !== 'lobby' && s.phase !== 'finished')
      this.finish(alive[0].team, reason);
  }
  damage(target: Player, source: Player, angle: number, amount = 1) {
    if (target.hp <= 0 || target.invuln > 0 || target.dashInvulnerable) return;
    // Incoming direction is the reverse of projectile/swing travel, not the
    // attacker's current position (arrows can arrive after their owner moves).
    const relative = angle + Math.PI - target.angle;
    const difference = Math.atan2(Math.sin(relative), Math.cos(relative));
    if (target.guarding && Math.abs(difference) <= RULES.guardArc / 2 + 1e-8) {
      this.event('block',target,target.team,target.angle,target.classId);
      return;
    }
    target.hp = Math.max(0,target.hp-amount);
    target.invuln = RULES.hurtProtection;
    target.hitFlash = 0.18;
    this.drop(target);
    this.event('hit', target, source.team);
    if (target.hp === 0) {
      target.respawnLeft = RULES.respawn;
      target.windup = 0;
      target.dashLeft = 0;
      target.dashInvulnerable = false;
      lowerGuard(target);
      target.deaths++;
      this.event('death', target, target.team);
      if (target.deaths >= RULES.maxDeaths) this.eliminate(target);
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
      const teams = s.players.filter((p) => !p.eliminated).map((p) => p.team);
      const best = Math.max(...teams.map((t) => s.score[t]));
      const leaders = teams.filter((t) => s.score[t] === best);
      this.finish(leaders.length === 1 ? leaders[0] : 'draw', 'tiempo');
      return;
    }
    const swings: Player[] = [];
    // First advance every player's defenses, movement and attack preparation.
    // Only then resolve impacts, so the order of joining never defeats a guard.
    for (const p of s.players) {
      const input = inputs.get(p.id) || idleInput(p.ack, p.angle);
      p.ack = Math.max(p.ack, input.seq);
      if (p.hp <= 0) {
        if (p.eliminated) continue;
        p.respawnLeft -= dt;
        if (p.respawnLeft <= 0) this.revive(p, RULES.spawnProtection);
        continue;
      }
      const action = movePlayer(p, input, s.flags.some(f => f.carrier === p.id), dt);
      if (action.swing) swings.push(p);
      if (action.shoot) {
        s.arrows.push({ id: ++this.arrowId, owner: p.id, team: p.team, classId: p.classId,
          x: p.x, y: p.y, angle: p.angle, life: RULES.arrowLife });
        this.event('shot', p, p.team, p.angle, p.classId);
      }
    }
    const hits: { target: Player; source: Player; angle: number; amount: number }[] = [];
    for (const p of swings) {
      const stats = CLASSES[p.classId];
      this.event('sword',p,p.team,p.swingAngle,p.classId);
      for (const q of s.players) {
        const angle = Math.atan2(q.y-p.y,q.x-p.x);
        const diff = Math.atan2(Math.sin(angle-p.swingAngle),Math.cos(angle-p.swingAngle));
        if (q.team !== p.team && q.hp > 0 && distance(p,q) <= stats.meleeRange &&
            Math.abs(diff) <= stats.meleeArc/2 && lineClear(p,q))
          hits.push({ target:q, source:p, angle, amount:stats.meleeDamage });
      }
    }
    for (const hit of hits) this.damage(hit.target,hit.source,hit.angle,hit.amount);
    if (s.winner) return;
    s.arrows = s.arrows.filter((a) => {
      const travelTime = Math.min(dt, a.life);
      if (travelTime <= 1e-8) return false;
      a.life = Math.max(0, a.life - dt);
      const owner = s.players.find((p) => p.id === a.owner);
      if (!owner) return false;
      const steps = Math.max(1, Math.ceil((RULES.arrowSpeed * travelTime) / 5));
      for (let i = 0; i < steps; i++) {
        a.x += (Math.cos(a.angle) * RULES.arrowSpeed * travelTime) / steps;
        a.y += (Math.sin(a.angle) * RULES.arrowSpeed * travelTime) / steps;
        if (blocked(a.x, a.y, 3)) return false;
        const target = s.players.find(
          (p) => p.team !== a.team && p.hp > 0 && distance(p, a) < RULES.radius + 3,
        );
        if (target) {
          this.damage(target, owner, a.angle, RULES.arrowDamage);
          return false;
        }
      }
      return true;
    });
    if (s.winner) return;
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
        distance(p, this.base(p.team).home) < 38
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
