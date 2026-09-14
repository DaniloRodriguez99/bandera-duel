export type Team = 'blue' | 'red' | 'green' | 'violet';
export type Phase = 'lobby' | 'countdown' | 'playing' | 'capture' | 'finished';
export type ClassId = 'archer' | 'mage' | 'necromancer' | 'guardian' | 'vanguard';
export const CLASS_IDS: ClassId[] = ['archer', 'mage', 'necromancer', 'guardian', 'vanguard'];
export const DEFAULT_CLASS: ClassId = 'guardian';
export function validClass(value: unknown): value is ClassId {
  return typeof value === 'string' && CLASS_IDS.includes(value as ClassId);
}
export const CLASSES = {
  archer: {
    name: 'Arquero',
    label: 'ARCO Y DAGA',
    description: 'Distancia, precisión y una salida rápida.',
    hp: 3,
    speed: 190,
    meleeDamage: 0.5,
    meleeRange: 30,
    meleeArc: Math.PI * 0.6,
    windup: 0.1,
    meleeCooldown: 0.5,
    ranged: true,
    shield: false,
    dash: true,
    melee: true,
    summon: false,
  },
  mage: {
    name: 'Mago',
    label: 'FUEGO Y ESCUDO',
    description: 'Bolas de fuego. Escudo que absorbe dos golpes.',
    hp: 3,
    speed: 180,
    meleeDamage: 0,
    meleeRange: 0,
    meleeArc: 0,
    windup: 0,
    meleeCooldown: 0,
    ranged: true,
    shield: false,
    dash: true,
    melee: false,
    summon: false,
  },
  necromancer: {
    name: 'Nigromante',
    label: 'FUEGO Y NO-MUERTOS',
    description: 'Quemá de lejos. Invocá zombies que cazan solos.',
    hp: 3,
    speed: 170,
    meleeDamage: 0,
    meleeRange: 0,
    meleeArc: 0,
    windup: 0,
    meleeCooldown: 0,
    ranged: true,
    shield: false,
    dash: false,
    melee: false,
    summon: true,
  },
  guardian: {
    name: 'Caballero',
    label: 'ESPADA Y ESCUDO',
    description: 'Protegé tu bandera. Respondé de cerca.',
    hp: 3,
    speed: 180,
    meleeDamage: 1,
    meleeRange: 55,
    meleeArc: Math.PI * 0.72,
    windup: 0.12,
    meleeCooldown: 0.6,
    ranged: false,
    shield: true,
    dash: false,
    melee: true,
    summon: false,
  },
  vanguard: {
    name: 'Guerrero',
    label: 'ESPADA DE DOS MANOS',
    description: 'Más alcance. Más daño. Acero pesado.',
    hp: 5,
    speed: 155,
    meleeDamage: 2,
    meleeRange: 80,
    meleeArc: (Math.PI * 130) / 180,
    windup: 0.3,
    meleeCooldown: 1,
    ranged: false,
    shield: false,
    dash: false,
    melee: true,
    summon: false,
  },
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
  trapSetup: 0.5,
  trapArm: 0.5,
  trapCooldown: 8,
  trapLife: 20,
  trapMax: 3,
  trapRadius: 16,
  trapDamage: 0.5,
  trapStun: 1,
  volleyCooldown: 5,
  volleyAngle: (Math.PI * 3) / 180,
  volleyGap: 7,
  volleyChargedPower: 1 / 3,
  chargeTime: 0.8,
  chargeMultiplier: 1.3,
  windScale: 2,
  windVolleyScale: 0.8,
  windGrace: 0.6,
  shotCooldown: 0.9,
  arrowSpeed: 560,
  arrowLife: 1.2,
  arrowDamage: 1,
  guardDuration: 1.2,
  magicShieldHits: 2,
  magicShieldCooldown: 5,
  iceCooldown: .5,
  freezeDuration: .5,
  guardCooldown: 1.5,
  guardRecovery: 0.15,
  guardSpeed: 0.25,
  guardArc: (Math.PI * 2) / 3,
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
  fireSpeed: 380,
  fireLife: 1.1,
  fireDamage: 1,
  fireCooldown: 1.1,
  fireRadius: 7,
  summonCooldown: 5,
  zombieSpeed: 140,
  zombieRadius: 12,
  zombieHp: 2,
  zombieDamage: 1,
  zombieRange: 24,
  zombieWindup: 0.35,
  zombieCooldown: 1,
  zombieLife: 20,
  zombieAggro: 280,
  zombieRetarget: 0.4,
  overchargeTap: 0.22,
  overchargeTime: 1.5,
  raiseCharge: 2.5,
  raiseRange: 200,
  graveLife: 10,
  thrallRise: 0.45,
  raiseCast: 0.5,
  thrallCooldown: 20,
  hatHp: 5,
  hatLife: 30,
  hatSpawnEvery: 5,
  hatHealEvery: 2,
  hatHeal: 0.5,
  hatCastTime: 0.6,
  hatCastCooldown: 1.4,
  hatCastRange: 200,
  hatSpread: (Math.PI * 6) / 180,
  spellDamage: 0.5,
  freeze: 1.2,
  explosionRadius: 45,
  zombieExecutions: 2,
  zombieAimRadius: 110,
  zombieFlankRadius: 34,
  zombieApproachRadius: 110,
  zombieSpread: 56,
  zombieRise: 0.45,
  zombieMarkPick: 70,
  zombieGuardRadius: 110,
} as const;
export const TEAMS: Team[] = ['blue', 'red', 'green', 'violet'];
export const TEAM_NAMES: Record<Team, string> = {
  blue: 'AZUL',
  red: 'CARMESÍ',
  green: 'JADE',
  violet: 'VIOLETA',
};
export const TEAM_ICONS: Record<Team, string> = { blue: '◆', red: '✚', green: '▲', violet: '●' };
export const emptyScore = (): Record<Team, number> => ({ blue: 0, red: 0, green: 0, violet: 0 });
export const SPAWNS = { blue: { x: 70, y: 270 }, red: { x: 890, y: 270 } } satisfies Record<
  string,
  Vec
>;
export const HOMES = { blue: { x: 145, y: 270 }, red: { x: 815, y: 270 } } satisfies Record<
  string,
  Vec
>;
export const CORNER_SPAWNS: Record<Team, Vec> = {
  blue: { x: 70, y: 120 },
  red: { x: 890, y: 120 },
  green: { x: 70, y: 420 },
  violet: { x: 890, y: 420 },
};
export const CORNER_HOMES: Record<Team, Vec> = {
  blue: { x: 145, y: 120 },
  red: { x: 815, y: 120 },
  green: { x: 145, y: 420 },
  violet: { x: 815, y: 420 },
};
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
  charge: boolean;
  dash: boolean;
  guard: boolean;
  summon: boolean;
  ice: boolean;
  trap: boolean;
  volley: boolean;
  special: boolean;
  /** E: toggles automatic zombies (no guard circle, no cursor squad). */
  command: boolean;
  /** ⌘E / Ctrl+E: moves the zombie under the cursor between the guard circle and the cursor. */
  mark: boolean;
  aimX: number;
  aimY: number;
}
/** Guards stay in the red circle around their necromancer; cursor zombies follow the mouse. */
export type ZombieRole = 'guard' | 'cursor';
export const idleInput = (seq = 0, angle = 0): Input => ({
  seq,
  x: 0,
  y: 0,
  angle,
  sword: false,
  shot: false,
  charge: false,
  dash: false,
  guard: false,
  summon: false,
  ice: false,
  trap: false,
  volley: false,
  special: false,
  command: false,
  mark: false,
  aimX: -1,
  aimY: -1,
});
/** A world point under the cursor; -1 means the client did not provide one. */
const aimCoordinate = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(max, value) : -1;
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
    charge: r.charge === true,
    dash: r.dash === true,
    guard: r.guard === true,
    summon: r.summon === true,
    ice: r.ice === true,
    trap: r.trap === true,
    volley: r.volley === true,
    special: r.special === true,
    command: r.command === true,
    mark: r.mark === true,
    aimX: aimCoordinate(r.aimX, RULES.width),
    aimY: aimCoordinate(r.aimY, RULES.height),
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
  shotCharge: number;
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
  magicShieldHits: number;
  magicShieldCd: number;
  windup: number;
  swingAngle: number;
  invuln: number;
  respawnLeft: number;
  hitFlash: number;
  deaths: number;
  eliminated: boolean;
  summonCd: number;
  iceCd: number;
  trapCd: number;
  trapLeft: number;
  volleyCd: number;
  stunLeft: number;
  /** Seconds left of a fully charged archer dash: shot or volley released now become the dash combo. */
  windDash: number;
  activeTraps: number;
  specialCharge: number;
  swingPower: number;
  frozenLeft: number;
  thrall: { classId: ClassId; name: string } | null;
  thrallCd: number;
  hatAlive: boolean;
  thrallAlive: boolean;
  /** Seconds left of the raise cast; the necromancer stays still while it lasts. */
  raiseCast: number;
  raiseX: number;
  raiseY: number;
  activeExecutions: number;
  /** E: every zombie hunts on its own instead of guarding or following the cursor. */
  zombieAuto: boolean;
  aimX: number;
  aimY: number;
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
  ice?: boolean;
  charged?: boolean;
  power?: number;
  damageScale?: number;
  element?: 'fire' | 'ice';
  /** Wind arrow: pierces every target once and breaks shields. */
  wind?: boolean;
  /** Rivals and zombies this arrow already went through. */
  hits?: string[];
  /** Arrows of one volley share this id. */
  volley?: number;
  id: number;
  owner: string;
  team: Team;
  classId: ClassId;
  angle: number;
  life: number;
}
export interface Trap extends Vec {
  id: number;
  owner: string;
  team: Team;
  armLeft: number;
  life: number;
}
export interface Zombie extends Vec {
  id: string;
  owner: string;
  team: Team;
  hp: number;
  angle: number;
  windup: number;
  attackCd: number;
  life: number;
  target: string | null;
  retarget: number;
  kind: 'brute' | 'hat' | 'thrall';
  bonus: boolean;
  maxHp: number;
  cast: number;
  castCd: number;
  healCd: number;
  spawnLeft: number;
  frozenLeft: number;
  classId?: ClassId;
  name?: string;
  role: ZombieRole;
  execution: number | null;
  slot: number;
  rise: number;
}
export interface GameEvent extends Vec {
  id: number;
  kind:
    | 'sword'
    | 'shot'
    | 'hit'
    | 'death'
    | 'capture'
    | 'return'
    | 'pickup'
    | 'block'
    | 'summon'
    | 'heal'
    | 'freeze'
    | 'raise'
    | 'cast'
    | 'explosion'
    | 'wind'
    | 'mandala';
  team: Team;
  angle?: number;
  classId?: ClassId;
  power?: number;
}
/** Zombies from the charged summon (hat, its minions, thrall) never use the normal cap. */
export const countsTowardLimit = (z: Zombie) => !z.bonus;
/** Where a rival fell: a necromancer can raise it until it crumbles, even after they respawn. */
export interface Grave extends Vec {
  classId: ClassId;
  name: string;
  team: Team;
  left: number;
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
  zombies: Zombie[];
  graves: Grave[];
  traps: Trap[];
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
/** Full-charge multipliers for held abilities; the archer keeps its own 0.8 s charge. */
const OVERCHARGE: Partial<Record<ClassId, { damage: number; radius: number; speed: number }>> = {
  mage: { damage: 2.5, radius: 2, speed: 1.7 },
  necromancer: { damage: 2, radius: 1.8, speed: 1.9 },
};
const MELEE_OVERCHARGE: Partial<Record<ClassId, number>> = { guardian: 2, vanguard: 1.75 };
/** 0 for a tap, rising to 1 once a hold reaches `overchargeTime`. */
export function chargePower(seconds: number) {
  return Math.max(
    0,
    Math.min(1, (seconds - RULES.overchargeTap) / (RULES.overchargeTime - RULES.overchargeTap)),
  );
}
export function projectileStats(classId: ClassId, charged = false, power = 0) {
  if (classId === 'archer' && charged)
    return {
      speed: RULES.arrowSpeed * RULES.chargeMultiplier,
      life: RULES.arrowLife / RULES.chargeMultiplier,
      damage: RULES.arrowDamage * RULES.chargeMultiplier,
      radius: 3,
      cooldown: RULES.shotCooldown,
    };
  if (classId === 'archer' && power > 0) {
    // Part of the archer's charge (the volley released mid-charge carries a third of it).
    const boost = 1 + (RULES.chargeMultiplier - 1) * power;
    return {
      speed: RULES.arrowSpeed * boost,
      life: RULES.arrowLife / boost,
      damage: RULES.arrowDamage * boost,
      radius: 3,
      cooldown: RULES.shotCooldown,
    };
  }
  const base =
    classId === 'necromancer'
      ? {
          speed: RULES.fireSpeed,
          life: RULES.fireLife,
          damage: RULES.fireDamage,
          radius: RULES.fireRadius,
          cooldown: RULES.fireCooldown,
        }
      : {
          speed: RULES.arrowSpeed,
          life: RULES.arrowLife,
          damage: RULES.arrowDamage,
          radius: 3,
          cooldown: RULES.shotCooldown,
        };
  const boost = OVERCHARGE[classId];
  if (!boost || power <= 0) return base;
  const speed = base.speed * (1 + power * (boost.speed - 1));
  // A charged cast keeps flying until it crosses the whole arena.
  const crossing = (RULES.width * 1.1) / speed;
  return {
    ...base,
    speed,
    life: base.life + power * Math.max(0, crossing - base.life),
    damage: base.damage * (1 + power * (boost.damage - 1)),
    radius: base.radius * (1 + power * (boost.radius - 1)),
  };
}
export function bodyClear(a: Vec, b: Vec, radius = RULES.zombieRadius - 1): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 5));
  for (let i = 1; i <= steps; i++)
    if (blocked(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, radius))
      return false;
  return true;
}
const CELL = 20,
  COLS = RULES.width / CELL,
  ROWS = RULES.height / CELL;
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const cellCenter = (i: number): Vec => ({
  x: (i % COLS) * CELL + CELL / 2,
  y: Math.floor(i / COLS) * CELL + CELL / 2,
});
const cellOf = (p: Vec) =>
  Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / CELL))) * COLS +
  Math.min(COLS - 1, Math.max(0, Math.floor(p.x / CELL)));
let walkable: boolean[] | undefined;
/** Breadth-first search on a 20 px grid; ends at the goal or at the closest reachable cell. */
export const pathCells = (points: Vec[]) => new Set(points.map(cellOf));
/** Cells in `avoid` (a sibling's route) are explored last, so a pack spreads across corridors. */
export function findPath(from: Vec, to: Vec, avoid?: ReadonlySet<number>): Vec[] {
  const open = (walkable ??= Array.from({ length: COLS * ROWS }, (_, i) => {
    const c = cellCenter(i);
    return !blocked(c.x, c.y, RULES.zombieRadius);
  }));
  const start = cellOf(from),
    goal = cellOf(to),
    parent = new Int32Array(COLS * ROWS).fill(-1),
    queue = [start],
    detour: number[] = [];
  parent[start] = start;
  let best = start;
  for (let head = 0; head < queue.length || detour.length; head++) {
    if (head >= queue.length) queue.push(detour.shift()!);
    const cell = queue[head];
    if (cell === goal) {
      best = goal;
      break;
    }
    if (distance(cellCenter(cell), to) < distance(cellCenter(best), to)) best = cell;
    const cx = cell % COLS,
      cy = Math.floor(cell / COLS);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx,
        ny = cy + dy,
        next = ny * COLS + nx;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || parent[next] !== -1 || !open[next])
        continue;
      if (dx && dy && (!open[cy * COLS + nx] || !open[ny * COLS + cx])) continue;
      parent[next] = cell;
      (avoid?.has(next) ? detour : queue).push(next);
    }
  }
  const path: Vec[] = [];
  for (let cell = best; cell !== start; cell = parent[cell]) path.unshift(cellCenter(cell));
  if (best === goal) path.push({ x: to.x, y: to.y });
  return path;
}
const ZOMBIE_PACE = [1, 0.92, 0.96, 0.88];
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export function lowerGuard(p: Player) {
  if (!p.guarding) return;
  p.guarding = false;
  p.guardLeft = 0;
  p.guardCd = RULES.guardCooldown;
  p.guardRecovery = RULES.guardRecovery;
}
/** Shared fixed-step prediction of timers, defense, attacks and movement. */
export function movePlayer(p: Player, input: Input, carrying: boolean, dt = RULES.tick as number) {
  const result = {
    ice: false,
    swing: false,
    shoot: false,
    summon: false,
    trap: false,
    volley: false,
    charged: false,
    power: 0,
    special: 0,
    volleyPower: 0,
    wind: false,
    angle: 0,
    raised: false,
  };
  if (p.hp <= 0) return result;
  const stats = CLASSES[p.classId];
  const wasWinding = p.windup > 0;
  const frozenDt = Math.min(dt, p.frozenLeft);
  p.frozenLeft = Math.max(0, p.frozenLeft - dt);
  p.iceCd = Math.max(0, p.iceCd - dt);
  for (const key of [
    'swordCd',
    'shotCd',
    'dashCd',
    'attackLock',
    'invuln',
    'hitFlash',
    'guardCd',
    'guardRecovery',
    'summonCd',
    'trapCd',
    'volleyCd',
    'magicShieldCd',
    'thrallCd',
    'windDash',
  ] as const)
    p[key] = Math.max(0, p[key] - dt);
  if (p.stunLeft > 0) {
    p.stunLeft = Math.max(0, p.stunLeft - dt);
    p.shotCharge = 0;
    p.specialCharge = 0;
    p.trapLeft = 0;
    p.windup = 0;
    p.dashLeft = 0;
    p.dashInvulnerable = false;
    lowerGuard(p);
    return result;
  }
  p.angle = input.angle;
  p.aimX = input.aimX;
  p.aimY = input.aimY;
  if (p.raiseCast > 0) {
    // Casting a raise roots the necromancer until the mandala opens.
    p.raiseCast = Math.max(0, p.raiseCast - dt);
    p.shotCharge = 0;
    p.specialCharge = 0;
    if (p.raiseCast <= 1e-8) {
      p.raiseCast = 0;
      result.raised = true;
    }
    return result;
  }
  if (p.trapLeft > 0) {
    p.shotCharge = 0;
    if (p.hitFlash > 0) p.trapLeft = 0;
    else {
      p.trapLeft = Math.max(0, p.trapLeft - dt);
      result.trap = p.trapLeft <= 1e-8;
      if (result.trap) p.trapLeft = 0;
      return result;
    }
  }
  if (
    p.classId === 'archer' &&
    input.trap &&
    p.trapCd <= 0 &&
    !wasWinding &&
    p.attackLock <= 0 &&
    p.dashLeft <= 0 &&
    p.hitFlash <= 0
  ) {
    p.shotCharge = 0;
    p.trapLeft = RULES.trapSetup;
    p.dashInvulnerable = false;
    p.trapCd = RULES.trapCooldown;
    p.invuln = 0;
    return result;
  }
  if (p.guarding && (!input.guard || p.guardLeft <= 1e-8)) lowerGuard(p);
  if (
    stats.shield &&
    input.guard &&
    !p.guardHeld &&
    !p.guarding &&
    p.guardCd <= 0 &&
    p.guardRecovery <= 0 &&
    !wasWinding &&
    p.attackLock <= 0
  ) {
    p.guarding = true;
    p.guardLeft = RULES.guardDuration;
  }
  if (
    p.classId === 'mage' &&
    input.guard &&
    !p.guardHeld &&
    p.magicShieldHits === 0 &&
    p.magicShieldCd <= 1e-8
  ) {
    p.magicShieldHits = RULES.magicShieldHits;
    p.magicShieldCd = 0;
  }
  p.guardHeld = input.guard;
  // Space charges while held; the release pulse (dash or summon) spends the charge.
  const specialReady = (stats.dash && p.dashCd <= 0) || (stats.summon && p.summonCd <= 0);
  if (specialReady && input.special && !input.dash && !input.summon)
    p.specialCharge = Math.min(
      stats.summon ? RULES.raiseCharge : RULES.overchargeTime,
      p.specialCharge + dt,
    );
  else if (!specialReady || (!input.special && !input.dash && !input.summon)) p.specialCharge = 0;
  if (frozenDt === 0 && stats.dash && input.dash && p.dashCd <= 0 && !wasWinding && p.attackLock <= 0) {
    const mag = Math.hypot(input.x, input.y);
    p.dashX = mag > 0.05 ? input.x / mag : Math.cos(input.angle);
    p.dashY = mag > 0.05 ? input.y / mag : Math.sin(input.angle);
    p.dashLeft = RULES.dashDuration * (1 + 0.8 * chargePower(p.specialCharge));
    p.dashCd = RULES.dashCooldown;
    // A fully charged archer dash opens the combo window for the rest of the jump (plus a grace).
    p.windDash =
      p.classId === 'archer' && p.specialCharge >= RULES.overchargeTime - 1e-8
        ? p.dashLeft + RULES.windGrace
        : 0;
    p.specialCharge = 0;
  }
  const dashDt = Math.min(dt, p.dashLeft);
  p.dashInvulnerable = dashDt > 1e-8;
  if (dashDt > 0)
    translate(p, p.dashX * RULES.dashSpeed * dashDt, p.dashY * RULES.dashSpeed * dashDt);
  p.dashLeft = Math.max(0, p.dashLeft - dt);
  const speed = stats.speed * (carrying ? RULES.carryMultiplier : 1) * (p.guarding ? RULES.guardSpeed : 1);
  translate(p, input.x * speed * Math.max(0, dt - dashDt - frozenDt), input.y * speed * Math.max(0, dt - dashDt - frozenDt));
  if (wasWinding) {
    p.windup = Math.max(0, p.windup - dt);
    result.swing = p.windup === 0;
  }
  // Archer combos read the charge held before this tick's release.
  const heldCharge = p.shotCharge;
  // During a fully charged dash the archer keeps its charge and can loose shot or volley mid-jump
  // toward the cursor; a full shot charge turns them into wind.
  const dashCombo = p.classId === 'archer' && p.windDash > 0;
  const windReady = dashCombo && heldCharge >= RULES.chargeTime - 1e-8;
  const canCharge =
    !p.guarding &&
    (!p.dashInvulnerable || dashCombo) &&
    !wasWinding &&
    p.attackLock <= 0 &&
    (stats.ranged ? p.shotCd <= 0 : stats.melee && p.swordCd <= 0);
  if (canCharge && input.charge && !input.shot && !input.sword && !input.volley)
    p.shotCharge = Math.min(
      p.classId === 'archer' ? RULES.chargeTime : RULES.overchargeTime,
      p.shotCharge + dt,
    );
  else if (!canCharge || !(input.shot || input.sword)) p.shotCharge = 0;
  if (
    !p.guarding &&
    p.guardRecovery <= 0 &&
    (!p.dashInvulnerable || dashCombo) &&
    p.attackLock <= 0 &&
    !wasWinding
  ) {
    if (input.volley && p.classId === 'archer' && p.volleyCd <= 0) {
      p.invuln = 0;
      p.volleyCd = RULES.volleyCooldown;
      p.attackLock = RULES.attackLock;
      result.volley = true;
      result.wind = windReady;
      // Released mid-charge: three arrows carrying a third of the charged power.
      result.volleyPower = heldCharge >= RULES.overchargeTap ? RULES.volleyChargedPower : 0;
      result.angle = p.angle;
      if (dashCombo) p.windDash = 0;
    } else if (input.sword && stats.melee && p.swordCd <= 0) {
      p.invuln = 0;
      p.windup = stats.windup;
      p.swingAngle = p.angle;
      p.swingPower = p.classId === 'archer' ? 0 : chargePower(p.shotCharge);
      p.swordCd = stats.meleeCooldown;
      p.attackLock = RULES.attackLock;
    } else if (input.ice && p.classId === 'mage' && p.iceCd <= 0) {
      p.invuln = 0;
      p.iceCd = RULES.iceCooldown;
      p.attackLock = RULES.attackLock;
      result.ice = true;
    } else if (input.shot && stats.ranged && p.shotCd <= 0) {
      p.invuln = 0;
      p.shotCd = projectileStats(p.classId).cooldown;
      p.attackLock = RULES.attackLock;
      result.charged = p.classId === 'archer' && heldCharge >= RULES.chargeTime - 1e-8;
      result.wind = windReady;
      result.angle = p.angle;
      if (dashCombo) p.windDash = 0;
      result.power = p.classId === 'archer' ? 0 : chargePower(p.shotCharge);
      p.shotCharge = 0;
      result.shoot = true;
    }
  }
  // Summoning neither waits for nor blocks attacks: fire and summon can go out on the same tick.
  if (
    input.summon &&
    stats.summon &&
    p.summonCd <= 0 &&
    // A charged summon (hat zombie or thrall) never takes an execution slot.
    (p.activeExecutions < RULES.zombieExecutions || p.specialCharge >= RULES.overchargeTap)
  ) {
    p.invuln = 0;
    p.summonCd = RULES.summonCooldown;
    result.summon = true;
    result.special = p.specialCharge;
    p.specialCharge = 0;
  }
  if (input.shot || input.sword || input.volley) p.shotCharge = 0;
  if (p.guarding) p.guardLeft = Math.max(0, p.guardLeft - dt);
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
    shotCharge: 0,
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
    magicShieldHits: classId === 'mage' ? RULES.magicShieldHits : 0,
    magicShieldCd: 0,
    windup: 0,
    swingAngle: 0,
    invuln: 0,
    respawnLeft: 0,
    hitFlash: 0,
    deaths: 0,
    eliminated: false,
    summonCd: 0,
    iceCd: 0,
    trapCd: 0,
    trapLeft: 0,
    volleyCd: 0,
    stunLeft: 0,
    windDash: 0,
    activeTraps: 0,
    specialCharge: 0,
    swingPower: 0,
    frozenLeft: 0,
    thrall: null,
    thrallCd: 0,
    hatAlive: false,
    thrallAlive: false,
    raiseCast: 0,
    raiseX: 0,
    raiseY: 0,
    activeExecutions: 0,
    zombieAuto: false,
    aimX: -1,
    aimY: -1,
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
    zombies: [],
    graves: [],
    traps: [],
    score: emptyScore(),
    winner: null,
    reason: '',
    events: [],
  };
  private eventId = 0;
  private arrowId = 0;
  private trapId = 0;
  private zombieId = 0;
  private executionId = 0;
  private paths = new Map<string, { goal: Vec; points: Vec[] }>();
  private packBearings = new Map<string, number>();
  private packSeen = new Set<string>();
  private volleyId = 0;
  /** `${volley}:${target}` → tick a volley arrow first reached that target. */
  private volleyHits = new Map<string, number>();
  /** Necromancers mid-cast and the thrall they are raising. */
  private raising = new Map<string, { classId: ClassId; name: string }>();
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
    s.zombies = s.zombies.filter((z) => z.owner !== id);
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
      thrall: p.thrall,
      thrallCd: p.thrallCd,
      invuln,
    });
  }
  event(
    kind: GameEvent['kind'],
    where: Vec,
    team: Team,
    angle?: number,
    classId?: ClassId,
    power?: number,
  ) {
    this.state.events.push({
      id: ++this.eventId,
      kind,
      x: where.x,
      y: where.y,
      team,
      angle,
      classId,
      power,
    });
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
    const s = this.state,
      p = s.players.find((p) => p.id === id);
    if (!p || !validClass(classId) || s.paused || !['lobby', 'finished'].includes(s.phase))
      return false;
    if (p.classId === classId) return true;
    Object.assign(p, newPlayer(p.id, p.name, p.team, classId, this.base(p.team).spawn), {
      ack: p.ack,
      connected: p.connected,
    });
    s.players.forEach((p) => (p.ready = false));
    return true;
  }
  resetArena() {
    const s = this.state;
    s.arrows = [];
    s.zombies = [];
    s.graves = [];
    this.raising.clear();
    for (const p of s.players) p.raiseCast = 0;
    s.traps = [];
    this.paths.clear();
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
    Object.assign(p, {
      eliminated: true,
      hp: 0,
      respawnLeft: 0,
      windup: 0,
      dashLeft: 0,
      dashInvulnerable: false,
    });
    lowerGuard(p);
    this.drop(p);
    s.flags = s.flags.filter((f) => f.team !== p.team);
    s.zombies = s.zombies.filter((z) => z.owner !== p.id);
    s.traps = s.traps.filter((t) => t.owner !== p.id);
    p.trapLeft = 0;
    const alive = s.players.filter((q) => !q.eliminated);
    if (alive.length === 1 && s.phase !== 'lobby' && s.phase !== 'finished')
      this.finish(alive[0].team, reason);
  }
  /** Returns whether the hit landed (not blocked, shielded or ignored by protection). */
  /** `pierce`: breaks shields and wounds without knockback; `ignoreInvuln`: a sibling volley arrow. */
  damage(
    target: Player,
    source: Player,
    angle: number,
    amount = 1,
    options: { pierce?: boolean; ignoreInvuln?: boolean; freeze?: boolean } = {},
  ): boolean {
    if (target.hp <= 0 || (target.invuln > 0 && !options.ignoreInvuln) || target.dashInvulnerable)
      return false;
    if (target.classId === 'mage' && target.magicShieldHits > 0 && (amount > 0 || options.freeze)) {
      target.magicShieldHits = options.pierce ? 0 : target.magicShieldHits - 1;
      if (target.magicShieldHits === 0) target.magicShieldCd = RULES.magicShieldCooldown;
      this.event('block', target, target.team, angle, target.classId);
      if (!options.pierce) return false;
    }
    // Incoming direction is the reverse of projectile/swing travel, not the
    // attacker's current position (arrows can arrive after their owner moves).
    const relative = angle + Math.PI - target.angle;
    const difference = Math.atan2(Math.sin(relative), Math.cos(relative));
    if (target.guarding && Math.abs(difference) <= RULES.guardArc / 2 + 1e-8) {
      this.event('block', target, target.team, target.angle, target.classId);
      if (!options.pierce) return false;
      lowerGuard(target);
      target.guardCd = RULES.guardCooldown;
    }
    if (options.freeze) {
      target.frozenLeft = RULES.freezeDuration;
      target.dashLeft = 0;
      target.dashInvulnerable = false;
      return true;
    }
    target.shotCharge = 0;
    target.specialCharge = 0;
    target.trapLeft = 0;
    target.hp = Math.max(0, target.hp - amount);
    target.invuln = RULES.hurtProtection;
    target.hitFlash = 0.18;
    this.drop(target);
    this.event('hit', target, source.team);
    if (target.hp === 0) {
      this.state.graves.push({
        x: target.x,
        y: target.y,
        classId: target.classId,
        name: target.name,
        team: target.team,
        left: RULES.graveLife,
      });
      target.respawnLeft = RULES.respawn;
      target.raiseCast = 0;
      this.raising.delete(target.id);
      target.windup = 0;
      target.dashLeft = 0;
      target.dashInvulnerable = false;
      lowerGuard(target);
      target.deaths++;
      this.event('death', target, target.team);
      if (target.deaths >= RULES.maxDeaths) this.eliminate(target);
    } else if (!options.pierce) translate(target, Math.cos(angle) * 24, Math.sin(angle) * 24);
    return true;
  }
  private freeze(p: Player) {
    if (p.hp <= 0) return;
    p.stunLeft = Math.max(p.stunLeft, RULES.freeze);
    p.frozenLeft = RULES.freeze;
    p.windup = 0;
    p.shotCharge = 0;
    p.specialCharge = 0;
    p.dashLeft = 0;
    p.trapLeft = 0;
    lowerGuard(p);
    this.event('freeze', p, p.team);
  }
  /** A charged fireball bursts on impact, splashing half its damage around. */
  private explode(a: Arrow, owner: Player, amount: number, skip?: string) {
    if (a.classId !== 'mage' || !a.power) return;
    const s = this.state,
      radius = RULES.explosionRadius * (0.6 + 0.4 * a.power);
    for (const q of s.players)
      if (q.id !== skip && q.team !== a.team && q.hp > 0 && distance(q, a) <= radius)
        this.damage(q, owner, Math.atan2(q.y - a.y, q.x - a.x), amount * 0.5);
    for (const z of s.zombies)
      if (z.id !== skip && z.team !== a.team && z.hp > 0 && distance(z, a) <= radius)
        this.damageZombie(z, a.team, amount * 0.5);
    this.event('explosion', a, a.team, a.angle, a.classId, a.power);
  }
  damageZombie(z: Zombie, team: Team, amount = 1) {
    z.hp = Math.max(0, z.hp - amount);
    this.event('hit', z, team);
    if (z.hp === 0) this.event('death', z, z.team);
  }
  private newZombie(owner: Player, at: Vec, fallback: Vec, extra: Partial<Zombie> = {}): Zombie {
    const id = ++this.zombieId;
    return {
      id: `z${id}`,
      owner: owner.id,
      team: owner.team,
      ...(blocked(at.x, at.y) ? { x: fallback.x, y: fallback.y } : { x: at.x, y: at.y }),
      hp: RULES.zombieHp,
      maxHp: RULES.zombieHp,
      angle: owner.angle,
      windup: 0,
      attackCd: 0,
      life: RULES.zombieLife,
      target: null,
      // Staggered so a crowd of zombies does not re-plan on the same tick.
      retarget: (id % 4) * RULES.tick,
      kind: 'brute',
      bonus: false,
      cast: 0,
      castCd: 0,
      healCd: RULES.hatHealEvery,
      spawnLeft: RULES.hatSpawnEvery,
      frozenLeft: 0,
      execution: null,
      slot: id % 4,
      rise: 0,
      role: 'guard',
      ...extra,
    };
  }
  /** Tap: two zombies. Held: one hat zombie. Full aura: raise or recall the thrall. */
  private summon(p: Player, charge = 0) {
    const s = this.state;
    const ahead = { x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26 };
    if (charge >= RULES.overchargeTap) {
      if (charge >= RULES.raiseCharge - 1e-9 && this.raise(p, ahead)) return;
      if (s.zombies.some((z) => z.owner === p.id && z.kind === 'hat')) {
        p.summonCd = 0;
        return;
      }
      s.zombies.push(
        this.newZombie(p, ahead, p, {
          kind: 'hat',
          bonus: true,
          role: 'cursor',
          hp: RULES.hatHp,
          maxHp: RULES.hatHp,
          life: RULES.hatLife,
        }),
      );
      p.hatAlive = true;
      this.event('summon', p, p.team, p.angle, p.classId, 1);
      return;
    }
    if (this.activeExecutions(p.id) >= RULES.zombieExecutions) return;
    const execution = ++this.executionId;
    const taken = new Set(s.zombies.filter((z) => z.owner === p.id).map((z) => z.slot));
    const free = [0, 1, 2, 3].filter((slot) => !taken.has(slot));
    [-1, 1].forEach((side, i) => {
      const angle = p.angle + side * 0.75 * Math.PI;
      const at = { x: p.x + Math.cos(angle) * RULES.zombieFlankRadius, y: p.y + Math.sin(angle) * RULES.zombieFlankRadius };
      s.zombies.push(
        this.newZombie(p, at, p, {
          execution,
          slot: free[i] ?? (execution * 2 + i) % 4,
          // Each body claws out of the ground a moment after the previous one.
          rise: RULES.zombieRise + i * 0.15,
        }),
      );
    });
    p.activeExecutions = this.activeExecutions(p.id);
    this.event('summon', p, p.team, p.angle, p.classId);
  }
  private raise(p: Player, ahead: Vec) {
    const s = this.state;
    // One thrall at a time; the necromancer's other zombies may stay alive.
    if (this.raising.has(p.id) || s.zombies.some((z) => z.owner === p.id && z.kind === 'thrall')) return false;
    // The raising mandala opens under the cursor, kept inside the white raise circle.
    const aim = p.aimX >= 0 ? { x: p.aimX, y: p.aimY } : ahead;
    const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    const spot = (r: number) => ({ x: p.x + Math.cos(angle) * r, y: p.y + Math.sin(angle) * r });
    let reach = Math.min(RULES.raiseRange, distance(p, aim));
    while (reach > 0 && blocked(spot(reach).x, spot(reach).y, RULES.zombieRadius)) reach -= 8;
    const at = spot(Math.max(0, reach));
    // The fallen rival whose grave is closest to the mandala rises there.
    const corpse = s.graves
      .filter((g) => g.team !== p.team && distance(p, g) <= RULES.raiseRange)
      .sort((a, b) => distance(at, a) - distance(at, b))[0];
    if (corpse) {
      p.thrall = { classId: corpse.classId, name: corpse.name };
      s.graves = s.graves.filter((g) => g !== corpse);
    } else if (!p.thrall || p.thrallCd > 0) return false;
    // Half a second of casting, rooted, before the mandala opens and the thrall rises there.
    this.raising.set(p.id, p.thrall!);
    p.raiseCast = RULES.raiseCast;
    p.raiseX = at.x;
    p.raiseY = at.y;
    this.event('mandala', at, p.team, p.angle, p.thrall!.classId);
    return true;
  }
  private finishRaise(p: Player) {
    const s = this.state;
    const bound = this.raising.get(p.id);
    this.raising.delete(p.id);
    if (!bound || p.hp <= 0) return;
    const at = { x: p.raiseX, y: p.raiseY };
    const hp = CLASSES[bound.classId].hp;
    s.zombies.push(
      this.newZombie(p, at, p, {
        kind: 'thrall',
        bonus: true,
        hp,
        maxHp: hp,
        life: 9999,
        classId: bound.classId,
        name: bound.name,
        role: 'cursor',
        // Claws out of the mandala before it can move or strike.
        rise: RULES.thrallRise,
      }),
    );
    p.thrallAlive = true;
    this.event('raise', at, p.team, p.angle, bound.classId);
  }
  /** A plain volley arrow flies past a target its sibling already struck, on to the next rival in line. */
  private volleyPasses(a: Arrow, id: string) {
    if (a.volley === undefined || a.wind || !this.volleyHits.has(`${a.volley}:${id}`)) return false;
    a.hits!.push(id);
    return true;
  }
  private markVolley(a: Arrow, id: string) {
    const key = `${a.volley}:${id}`;
    if (a.volley !== undefined && !this.volleyHits.has(key)) this.volleyHits.set(key, this.state.tick);
  }
  private castSpell(z: Zombie, owner: Player) {
    const s = this.state;
    // The hat zombie casts with both arms; ice leads so a landed hit freezes before the fire.
    const shots: { classId: ClassId; offset: number; scale: number; element?: 'fire' | 'ice' }[] =
      z.kind === 'hat'
        ? [
            { classId: 'necromancer', offset: RULES.hatSpread, scale: RULES.spellDamage, element: 'ice' },
            { classId: 'necromancer', offset: -RULES.hatSpread, scale: RULES.spellDamage, element: 'fire' },
          ]
        : [{ classId: z.classId ?? 'archer', offset: 0, scale: 1 }];
    for (const shot of shots)
      s.arrows.push({
        id: ++this.arrowId,
        owner: owner.id,
        team: z.team,
        classId: shot.classId,
        x: z.x,
        y: z.y,
        angle: z.angle + shot.offset,
        life: projectileStats(shot.classId).life,
        damageScale: shot.scale,
        element: shot.element,
      });
    z.castCd =
      z.kind === 'hat' ? RULES.hatCastCooldown : projectileStats(z.classId ?? 'archer').cooldown;
    this.event('shot', z, z.team, z.angle, shots[0].classId);
  }
  /** Distinct live summon executions; zombies without an execution never use a slot. */
  activeExecutions(owner: string) {
    return new Set(
      this.state.zombies
        .filter((z) => z.owner === owner && z.hp > 0 && z.execution !== null)
        .map((z) => z.execution),
    ).size;
  }
  /** Normal zombies guard the red circle around the necromancer; the hat zombie, its minions and the thrall follow the mouse. */
  private zombieMode(z: Zombie, owner = this.state.players.find((p) => p.id === z.owner)) {
    if (!owner || owner.hp <= 0 || owner.zombieAuto) return 'auto' as const;
    return z.role === 'cursor' && owner.aimX >= 0 ? ('cursor' as const) : ('guard' as const);
  }
  /** ⌘E moves the zombie nearest the cursor between the guard circle and the cursor; E toggles automatic. */
  private commandZombies(p: Player, input: Input) {
    const own = this.state.zombies.filter((z) => z.owner === p.id && z.hp > 0);
    if (input.mark && input.aimX >= 0) {
      const aim = { x: input.aimX, y: input.aimY };
      const pick = own
        .filter((z) => distance(z, aim) <= RULES.zombieMarkPick)
        .sort((a, b) => distance(a, aim) - distance(b, aim))[0];
      if (pick) pick.role = pick.role === 'guard' ? 'cursor' : 'guard';
    }
    if (input.command) p.zombieAuto = !p.zombieAuto;
    // Orders apply at once instead of on the next staggered re-plan.
    for (const z of own) z.retarget = 0;
  }
  /** The rival nearest to the owner's cursor, if the cursor is close enough to one. */
  private markedTarget(owner: string, candidates: { id: string; at: Vec }[]) {
    const p = this.state.players.find((q) => q.id === owner);
    if (!p || p.aimX < 0 || p.aimY < 0) return null;
    const aim = { x: p.aimX, y: p.aimY };
    let marked: string | null = null,
      gap: number = RULES.zombieAimRadius;
    for (const c of candidates) {
      const d = distance(aim, c.at);
      if (d <= gap) {
        marked = c.id;
        gap = d;
      }
    }
    return marked;
  }
  /**
   * Where `z` should stand around `center`. Zombies of the same owner chasing the same goal
   * spread over it (a pincer for two, a ring for more), each keeping the side it is already on,
   * so the pack closes in from several directions instead of queueing behind each other.
   */
  private formation(z: Zombie, center: Vec, near: number, far = near): Vec {
    // Idle zombies group by what they do: guards around the necromancer apart from the cursor squad.
    const mode = this.zombieMode(z);
    const pack = this.state.zombies.filter(
      (q) =>
        q.hp > 0 && q.owner === z.owner && q.target === z.target && (z.target !== null || this.zombieMode(q) === mode),
    );
    const bearing = (q: Vec) => Math.atan2(q.y - center.y, q.x - center.x);
    const key = `${z.owner}:${z.target ?? mode}`;
    this.packSeen.add(key);
    let sx = 0,
      sy = 0;
    for (const q of pack) {
      sx += Math.cos(bearing(q));
      sy += Math.sin(bearing(q));
    }
    // Once the pack already surrounds the goal the mean bearing is meaningless: keep the last one.
    const stored = this.packBearings.get(key);
    const base = stored === undefined || Math.hypot(sx, sy) > pack.length * 0.35 ? Math.atan2(sy, sx) : stored;
    this.packBearings.set(key, base);
    const order = pack
      .map((q) => ({ q, side: wrapAngle(bearing(q) - base) }))
      .sort((a, b) => a.side - b.side || a.q.slot - b.q.slot);
    const i = order.findIndex((o) => o.q === z),
      n = pack.length;
    const offset = n <= 1 ? 0 : n === 2 ? (i === 0 ? -1.15 : 1.15) : -Math.PI + ((i + 0.5) * 2 * Math.PI) / n;
    const angle = base + offset;
    // Still on the wrong side: stay wide and walk around the goal instead of through it.
    const detour = Math.abs(wrapAngle(bearing(z) - angle)) / (Math.PI / 2);
    const reach = Math.min(far, Math.max(near, distance(z, center) * 0.6, near + 45 * detour));
    for (let r = reach; r > 8; r -= 12) {
      const point = { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
      if (!blocked(point.x, point.y, RULES.zombieRadius)) return point;
    }
    return center;
  }
  private siblingCells(z: Zombie) {
    const cells = new Set<number>();
    for (const q of this.state.zombies)
      if (q !== z && q.owner === z.owner && q.target === z.target)
        for (const cell of pathCells(this.paths.get(q.id)?.points ?? [])) cells.add(cell);
    return cells;
  }
  private chooseTarget(z: Zombie) {
    const s = this.state;
    const candidates = [
      ...s.players
        .filter((p) => p.team !== z.team && p.hp > 0)
        .map((p) => ({
          id: p.id,
          at: p as Vec,
          carrying: s.flags.some((f) => f.carrier === p.id),
        })),
      ...s.zombies
        .filter((q) => q.team !== z.team && q.hp > 0)
        .map((q) => ({ id: q.id, at: q as Vec, carrying: false })),
    ];
    // Cursor zombies only attack the rival under the cursor, guards only whoever steps into the
    // red circle around their necromancer, and automatic ones hunt anyone nearby.
    const owner = s.players.find((p) => p.id === z.owner);
    const mode = this.zombieMode(z, owner);
    const marked = mode === 'cursor' ? this.markedTarget(z.owner, candidates) : undefined;
    const near = candidates.filter((c) =>
      mode === 'cursor'
        ? c.id === marked
        : mode === 'guard'
          ? distance(owner!, c.at) <= RULES.zombieGuardRadius
          : distance(z, c.at) <= RULES.zombieAggro,
    );
    // Siblings already chasing a target make it less attractive, so a pack splits up.
    const score = (c: (typeof candidates)[number]) =>
      distance(z, c.at) +
      (lineClear(z, c.at) ? 0 : 120) -
      (c.carrying ? 100 : 0) +
      70 * s.zombies.filter((q) => q !== z && q.owner === z.owner && q.target === c.id).length;
    let best = near.find((c) => c.id === z.target);
    let bestScore = best ? score(best) - 40 : Infinity;
    for (const c of near) {
      const value = score(c);
      if (value < bestScore) {
        best = c;
        bestScore = value;
      }
    }
    if (best?.id !== z.target) this.paths.delete(z.id);
    z.target = best?.id ?? null;
  }
  private walkZombie(z: Zombie, goal: Vec, dt: number, pace = 1) {
    let aim = goal;
    if (bodyClear(z, goal)) this.paths.delete(z.id);
    else {
      let route = this.paths.get(z.id);
      if (!route?.points.length || distance(route.goal, goal) > 40) {
        route = { goal: { x: goal.x, y: goal.y }, points: findPath(z, goal, this.siblingCells(z)) };
        this.paths.set(z.id, route);
      }
      const points = route.points;
      while (points.length > 1 && bodyClear(z, points[1])) points.shift();
      if (points.length && distance(z, points[0]) < 4) points.shift();
      aim = points[0] ?? goal;
    }
    const gap = distance(z, aim);
    if (gap < 1e-6) return;
    z.angle = Math.atan2(aim.y - z.y, aim.x - z.x);
    const stride = Math.min(gap, RULES.zombieSpeed * pace * ZOMBIE_PACE[z.slot % ZOMBIE_PACE.length] * dt);
    translate(z, Math.cos(z.angle) * stride, Math.sin(z.angle) * stride);
  }
  private stepZombies(dt: number) {
    const s = this.state;
    s.graves = s.graves.filter((g) => (g.left -= dt) > 0);
    const minions: Zombie[] = [];
    for (const z of s.zombies) {
      if (z.hp <= 0) continue;
      z.life -= dt;
      const walkDt = Math.max(0, dt - (z.frozenLeft ?? 0));
      z.attackCd = Math.max(0, z.attackCd - dt);
      z.castCd = Math.max(0, z.castCd - dt);
      z.retarget -= dt;
      if (z.retarget <= 1e-9) {
        z.retarget = RULES.zombieRetarget;
        this.chooseTarget(z);
      }
      const player = s.players.find((p) => p.id === z.target && p.hp > 0);
      const zombie = s.zombies.find((q) => q.id === z.target && q.hp > 0);
      const target: Vec | undefined = player ?? zombie;
      if (!target) z.target = null;
      const owner = s.players.find((p) => p.id === z.owner);
      const pace = z.kind === 'thrall' ? 1.1 : 1;
      const mode = this.zombieMode(z, owner);
      if (z.rise > 0) {
        z.rise = Math.max(0, z.rise - dt);
        continue;
      }
      if (z.kind === 'hat') {
        z.healCd -= dt;
        if (z.healCd <= 0) {
          z.healCd = RULES.hatHealEvery;
          if (z.hp < z.maxHp) {
            z.hp = Math.min(z.maxHp, z.hp + RULES.hatHeal);
            this.event('heal', z, z.team);
          }
        }
        z.spawnLeft -= dt;
        if (z.spawnLeft <= 0 && owner) {
          z.spawnLeft = RULES.hatSpawnEvery;
          const behind = { x: z.x - Math.cos(z.angle) * 24, y: z.y - Math.sin(z.angle) * 24 };
          // The hat zombie's minions skip the summon limit and are the ones that follow the cursor.
          minions.push(this.newZombie(owner, behind, z, { bonus: true, role: 'cursor' }));
          this.event('summon', z, z.team, z.angle, 'necromancer');
        }
      }
      if (z.frozenLeft > 0) {
        z.frozenLeft = Math.max(0, z.frozenLeft - dt);
        z.windup = 0;
        z.cast = 0;
        continue;
      }
      const ranged =
        z.kind === 'hat' || (z.kind === 'thrall' && !!z.classId && CLASSES[z.classId].ranged);
      if (ranged) {
        if (z.cast > 0) {
          z.cast = Math.max(0, z.cast - dt);
          if (z.cast <= 0 && owner) this.castSpell(z, owner);
          continue;
        }
        const gap = target ? distance(z, target) : Infinity;
        const range = z.kind === 'hat' ? RULES.hatCastRange : 260;
        if (target && gap >= 50 && gap <= range && z.castCd <= 0 && lineClear(z, target)) {
          z.angle = Math.atan2(target.y - z.y, target.x - z.x);
          z.cast = z.kind === 'hat' ? RULES.hatCastTime : 0.25;
          this.event('cast', z, z.team, z.angle, z.classId ?? 'necromancer');
          continue;
        }
        const leader = owner && owner.hp > 0 ? owner : undefined;
        const goal = target
          ? gap > range * 0.7
            ? target
            : undefined
          : leader && mode === 'cursor'
            ? this.formation(z, { x: leader.aimX, y: leader.aimY }, RULES.zombieSpread)
            : leader && (mode === 'guard' || distance(z, leader) > 70)
            ? this.formation(z, leader, RULES.zombieSpread)
            : undefined;
        if (goal) this.walkZombie(z, goal, dt, pace);
        continue;
      }
      const melee = z.kind === 'thrall' && z.classId ? CLASSES[z.classId] : undefined;
      const reach = melee ? melee.meleeRange : RULES.zombieRange;
      if (z.windup > 0) {
        z.windup = Math.max(0, z.windup - dt);
        if (z.windup > 0) continue;
        z.attackCd = melee ? melee.meleeCooldown : RULES.zombieCooldown;
        if (target && distance(z, target) <= reach + 8 && lineClear(z, target)) {
          const angle = Math.atan2(target.y - z.y, target.x - z.x);
          const amount = melee ? melee.meleeDamage : RULES.zombieDamage;
          if (player && owner) this.damage(player, owner, angle, amount);
          else if (zombie) this.damageZombie(zombie, z.team, amount);
          if (melee) this.event('sword', z, z.team, angle, z.classId);
        }
        continue;
      }
      if (target && distance(z, target) <= reach && lineClear(z, target)) {
        z.angle = Math.atan2(target.y - z.y, target.x - z.x);
        if (z.attackCd <= 0) z.windup = melee ? Math.max(melee.windup, 0.2) : RULES.zombieWindup;
        continue;
      }
      const leader = owner && owner.hp > 0 ? owner : undefined;
      const aim = leader && mode === 'cursor' ? { x: leader.aimX, y: leader.aimY } : undefined;
      // Far away the pack fans out wide; the ring tightens as each zombie closes in, and
      // only from its own spot does it lunge at the target.
      const spot = target && this.formation(z, target, RULES.zombieFlankRadius, RULES.zombieApproachRadius);
      const goal = target && spot
        ? distance(z, spot) < 12 || distance(z, target) <= RULES.zombieFlankRadius
          ? target
          : spot
        : aim
          ? this.formation(z, aim, RULES.zombieSpread)
          : leader
            ? mode === 'guard' || distance(z, leader) > 70
              ? this.formation(z, leader, RULES.zombieSpread)
              : undefined
            : s.flags
                .filter((f) => f.team !== z.team)
                .sort((a, b) => distance(z, a) - distance(z, b))[0];
      if (goal && walkDt > 0) this.walkZombie(z, goal, walkDt, pace);
    }
    s.zombies.push(...minions);
    const list = s.zombies;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i],
          b = list[j],
          gap = distance(a, b);
        if (gap >= 20) continue;
        // Pushed a little sideways so two zombies meeting head-on slide past instead of locking.
        const angle = (gap > 1e-6 ? Math.atan2(b.y - a.y, b.x - a.x) : i + j) + 0.5;
        if (!a.frozenLeft) translate(a, (-Math.cos(angle) * (20 - gap)) / 2, (-Math.sin(angle) * (20 - gap)) / 2);
        if (!b.frozenLeft) translate(b, (Math.cos(angle) * (20 - gap)) / 2, (Math.sin(angle) * (20 - gap)) / 2);
      }
    for (const z of s.zombies)
      if (z.kind === 'thrall' && z.hp <= 0) {
        const owner = s.players.find((p) => p.id === z.owner);
        if (owner) owner.thrallCd = RULES.thrallCooldown;
      }
    s.zombies = s.zombies.filter((z) => z.hp > 0 && z.life > 0);
    for (const id of this.paths.keys())
      if (!s.zombies.some((z) => z.id === id)) this.paths.delete(id);
    for (const p of s.players) {
      p.hatAlive = s.zombies.some((z) => z.owner === p.id && z.kind === 'hat');
      p.thrallAlive = s.zombies.some((z) => z.owner === p.id && z.kind === 'thrall');
    }
    for (const key of this.packBearings.keys()) if (!this.packSeen.has(key)) this.packBearings.delete(key);
    this.packSeen.clear();
    for (const p of s.players) p.activeExecutions = this.activeExecutions(p.id);
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
    const placements: Player[] = [];
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
      if (CLASSES[p.classId].summon && (input.command || input.mark)) this.commandZombies(p, input);
      const action = movePlayer(
        p,
        input,
        s.flags.some((f) => f.carrier === p.id),
        dt,
      );
      if (action.swing) swings.push(p);
      if (action.trap) placements.push(p);
      if (action.shoot || action.volley || action.ice) {
        const volley = action.volley ? ++this.volleyId : undefined;
        const charged = action.wind || (action.shoot && action.charged);
        const power = action.volley ? action.volleyPower : action.power;
        const stats = projectileStats(p.classId, charged, power);
        const aim = action.angle;
        // Volley arrows leave side by side and open up slowly: point blank (the archer's risky jump into
        // a rival's face) all three land, farther away they spread across a line of rivals.
        for (const side of action.volley ? [-1, 0, 1] : [0]) {
          const gap = side * RULES.volleyGap;
          s.arrows.push({
            id: ++this.arrowId,
            owner: p.id,
            team: p.team,
            classId: p.classId,
            ice: action.ice,
            x: p.x - Math.sin(aim) * gap,
            y: p.y + Math.cos(aim) * gap,
            angle: aim + side * RULES.volleyAngle,
            charged,
            power,
            // A wind arrow crosses the whole arena.
            life: action.wind ? (RULES.width * 1.1) / stats.speed : stats.life,
            ...(volley !== undefined || action.wind ? { hits: [], volley } : {}),
            ...(action.wind
              ? { wind: true, damageScale: action.volley ? RULES.windVolleyScale : RULES.windScale }
              : {}),
          });
        }
        this.event(action.wind ? 'wind' : 'shot', p, p.team, aim, p.classId, action.power);
      }
      if (action.raised) this.finishRaise(p);
      if (action.summon) this.summon(p, action.special);
    }
    const hits: { target: Player; source: Player; angle: number; amount: number }[] = [];
    for (const p of swings) {
      const stats = CLASSES[p.classId];
      const power = p.swingPower,
        range = stats.meleeRange * (1 + 0.3 * power),
        arc = stats.meleeArc * (1 + 0.2 * power),
        amount = stats.meleeDamage * (1 + power * ((MELEE_OVERCHARGE[p.classId] ?? 1) - 1));
      p.swingPower = 0;
      this.event('sword', p, p.team, p.swingAngle, p.classId, power);
      for (const q of s.players) {
        const angle = Math.atan2(q.y - p.y, q.x - p.x);
        const diff = Math.atan2(Math.sin(angle - p.swingAngle), Math.cos(angle - p.swingAngle));
        if (
          q.team !== p.team &&
          q.hp > 0 &&
          distance(p, q) <= range &&
          Math.abs(diff) <= arc / 2 &&
          lineClear(p, q)
        )
          hits.push({ target: q, source: p, angle, amount });
      }
      for (const z of s.zombies) {
        const angle = Math.atan2(z.y - p.y, z.x - p.x);
        const diff = Math.atan2(Math.sin(angle - p.swingAngle), Math.cos(angle - p.swingAngle));
        if (
          z.team !== p.team &&
          z.hp > 0 &&
          distance(p, z) <= range &&
          Math.abs(diff) <= arc / 2 &&
          lineClear(p, z)
        )
          this.damageZombie(z, p.team, amount);
      }
    }
    for (const hit of hits) this.damage(hit.target, hit.source, hit.angle, hit.amount);
    if (s.winner) return;
    s.arrows = s.arrows.filter((a) => {
      const travelTime = Math.min(dt, a.life);
      if (travelTime <= 1e-8) return false;
      a.life = Math.max(0, a.life - dt);
      const owner = s.players.find((p) => p.id === a.owner);
      if (!owner) return false;
      const stats = projectileStats(a.classId, a.charged, a.power);
      const amount = stats.damage * (a.damageScale ?? 1);
      const steps = Math.max(1, Math.ceil((stats.speed * travelTime) / 5));
      for (let i = 0; i < steps; i++) {
        a.x += (Math.cos(a.angle) * stats.speed * travelTime) / steps;
        a.y += (Math.sin(a.angle) * stats.speed * travelTime) / steps;
        if (blocked(a.x, a.y, 3)) {
          this.explode(a, owner, amount);
          return false;
        }
        const target = s.players.find(
          (p) =>
            p.team !== a.team &&
            p.hp > 0 &&
            distance(p, a) < RULES.radius + stats.radius &&
            !a.hits?.includes(p.id),
        );
        if (target && this.volleyPasses(a, target.id)) continue;
        if (target && a.wind) {
          // Wind pierces and breaks shields; the arrows of a wind volley all land on the same rival.
          const sibling = this.volleyHits.has(`${a.volley}:${target.id}`);
          a.hits!.push(target.id);
          this.markVolley(a, target.id);
          this.damage(target, owner, a.angle, amount, { pierce: true, ignoreInvuln: sibling });
          continue;
        }
        if (target) {
          this.markVolley(a, target.id);
          if (this.damage(target, owner, a.angle, a.ice ? 0 : amount, { freeze: a.ice }) && a.element === 'ice') this.freeze(target);
          this.explode(a, owner, amount, target.id);
          return false;
        }
        const zombie = s.zombies.find(
          (z) =>
            z.team !== a.team &&
            z.hp > 0 &&
            distance(z, a) < RULES.zombieRadius + stats.radius &&
            !a.hits?.includes(z.id),
        );
        if (zombie && this.volleyPasses(a, zombie.id)) continue;
        if (zombie) {
          this.markVolley(a, zombie.id);
          if (a.ice) zombie.frozenLeft = RULES.freezeDuration;
          else this.damageZombie(zombie, a.team, amount);
          if (a.wind) {
            a.hits!.push(zombie.id);
            continue;
          }
          if (a.element === 'ice') {
            zombie.frozenLeft = RULES.freeze;
            this.event('freeze', zombie, zombie.team);
          }
          this.explode(a, owner, amount, zombie.id);
          return false;
        }
      }
      return true;
    });
    for (const [key, tick] of this.volleyHits) if (s.tick - tick > 60) this.volleyHits.delete(key);
    this.stepZombies(dt);
    for (const p of placements) {
      if (p.hp <= 0 || p.hitFlash > 0 || s.winner) continue;
      const owned = s.traps.filter((t) => t.owner === p.id);
      if (owned.length >= RULES.trapMax) s.traps = s.traps.filter((t) => t.id !== owned[0].id);
      s.traps.push({
        id: ++this.trapId,
        owner: p.id,
        team: p.team,
        x: p.x,
        y: p.y,
        armLeft: RULES.trapArm,
        life: RULES.trapLife,
      });
    }
    s.traps = s.traps.filter((t) => {
      t.life -= dt;
      t.armLeft = Math.max(0, t.armLeft - dt);
      const owner = s.players.find((p) => p.id === t.owner && !p.eliminated);
      if (t.life <= 0 || !owner) return false;
      if (t.armLeft > 1e-8) return true;
      const target = s.players.find(
        (p) =>
          p.team !== t.team &&
          p.hp > 0 &&
          distance(p, t) < RULES.trapRadius + RULES.radius &&
          lineClear(p, t),
      );
      if (!target || target.invuln > 0 || target.dashInvulnerable) return true;
      // A floor trap strikes beneath the shield, while normal damage protection still applies.
      this.damage(target, owner, target.angle, RULES.trapDamage);
      if (target.hp > 0) {
        target.stunLeft = RULES.trapStun;
        target.windup = 0;
        target.shotCharge = 0;
        target.trapLeft = 0;
        target.dashLeft = 0;
        lowerGuard(target);
      }
      return false;
    });
    if (s.winner) return;
    for (const p of s.players) p.activeTraps = s.traps.filter((t) => t.owner === p.id).length;
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
