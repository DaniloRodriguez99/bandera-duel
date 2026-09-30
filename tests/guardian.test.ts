import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_CUT,
  CLASSES,
  DEFAULT_LOADOUTS,
  Duel,
  INPUT_BUFFER,
  KNIGHT_AWAKEN,
  KNIGHT_FLURRY_CHARGE,
  KNIGHT_FLURRY_COOLDOWN,
  KNIGHT_STEP,
  KNIGHT_STEP_CHARGE,
  KNIGHT_SWORD_CHARGE,
  MOVES,
  RULES,
  SHOCK,
  SKILLS,
  WARRIOR_SLASH_CHARGE,
  WAVE_COLORS,
  curve,
  idleInput,
  movePlayer,
  skillCost,
  warriorWave,
  waveHalfWidth,
  type Arrow,
  type ClassId,
  type Input,
  type Player,
  type SkillSlot,
  type SlotInputState,
  type WaveSpec,
} from '@bandera/shared';
import { World, newCharacter } from '@bandera/shared/world';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick - 1e-6);
type Keys = Partial<Record<SkillSlot, Partial<SlotInputState>>>;
const TAP = { pressed: true, released: true };
const DOWN = { pressed: true, held: true };
const HOLD = { held: true };
const UP = { released: true };
const input = (keys: Keys = {}, extra: Partial<Input> = {}): Input => {
  const next = { ...idleInput(1), ...extra };
  for (const [slot, state] of Object.entries(keys))
    next.slots[slot as SkillSlot] = { pressed: false, held: false, released: false, ...state };
  return next;
};

function arena(enemy: ClassId = 'vanguard', third: ClassId = 'archer') {
  const duel = new Duel('courtyard', 'ffa3');
  const knight = duel.add('knight', 'Caballero', 'guardian');
  const rival = duel.add('rival', 'Rival', enemy);
  const other = duel.add('other', 'Otro', third);
  duel.state.phase = 'playing';
  // The open lane in the middle of the courtyard; the knight looks east.
  Object.assign(knight, { x: 330, y: 270, angle: 0, invuln: 0 });
  Object.assign(rival, { x: 800, y: 270, angle: Math.PI, invuln: 0, hp: 20, maxHp: 20 });
  Object.assign(other, { x: 800, y: 430, angle: Math.PI, invuln: 0, hp: 20, maxHp: 20 });
  const step = (keys: Keys = {}, extra: Partial<Input> = {}, count = 1) => {
    for (let i = 0; i < count; i++) duel.step(new Map([[knight.id, input(keys, extra)]]));
  };
  /** Lets the running move play out to its end. */
  const finish = () => {
    for (let i = 0; i < 60 && knight.move; i++) step();
  };
  /** Holds a key for `seconds`, then lets go. */
  const charged = (slot: SkillSlot, seconds: number) => {
    step({ [slot]: DOWN });
    step({ [slot]: HOLD }, {}, ticks(seconds));
    step({ [slot]: UP });
  };
  /** Puts a body in front of the knight, within reach of a horizontal cut. */
  const inFront = (body: Player, gap = 40) =>
    Object.assign(body, { x: knight.x + gap, y: knight.y, invuln: 0 });
  const events = (kind: string) => duel.state.events.filter((event) => event.kind === kind);
  return { duel, knight, rival, other, step, finish, charged, inFront, events };
}

describe('Caballero · Tres Cortes', () => {
  it('es más veloz que nadie, no lleva escudo, su Ráfaga va en Q y deja libres el clic derecho, E y F', () => {
    expect(CLASSES.guardian.speed).toBeGreaterThan(CLASSES.archer.speed);
    expect(CLASSES.guardian.speed).toBeGreaterThan(CLASSES.vanguard.speed);
    expect(DEFAULT_LOADOUTS.guardian).toEqual({
      primary: 'guardian.sword', secondary: null, mobility: 'guardian.dash',
      q: 'guardian.flurry', e: null, f: null, r: 'guardian.fury',
    });
    expect(Object.keys(SKILLS).filter((id) => id.startsWith('guardian.'))).toEqual([
      'guardian.sword', 'guardian.flurry', 'guardian.dash', 'guardian.fury',
    ]);
  });

  it('encadena siempre en el mismo orden: horizontal, horizontal y remate vertical crítico', () => {
    const { knight, rival, step, finish, inFront, events } = arena();
    const moves: string[] = [];
    for (let i = 0; i < 4; i++) {
      inFront(rival);
      const hp = rival.hp;
      step({ primary: TAP });
      moves.push(knight.move);
      finish();
      // 1, 1, then 1.5 for the finisher, and round again.
      expect(hp - rival.hp).toBe(i === 2 ? 1.5 : 1);
    }
    expect(moves).toEqual(['guardian.sword:0:0', 'guardian.sword:1:0', 'guardian.sword:2:0', 'guardian.sword:0:0']);
    // Right to left, back left to right, then down from overhead: each starts where the last ended.
    const [first, second, third] = moves.map((move) => MOVES[move]);
    expect(first.strikes[0].shape).toMatchObject({ kind: 'arc' });
    expect(second.strikes[0].shape).toMatchObject({ kind: 'arc' });
    expect(third.strikes[0].shape).toMatchObject({ kind: 'lane', drop: true });
    // Brought down on a slant: neither straight down nor flat.
    const slant = (third.strikes[0].shape as { diagonal?: number }).diagonal!;
    expect(slant).toBeGreaterThan(Math.PI / 12);
    expect(slant).toBeLessThan(Math.PI / 3);
    const sweep = (move: typeof first) => move.strikes[0].shape as { from: number; to: number };
    expect(sweep(first).from).toBeGreaterThan(0);
    expect(sweep(first).to).toBeLessThan(0);
    expect(sweep(second).from).toBeCloseTo(sweep(first).to);
    expect(sweep(second).to).toBeGreaterThan(0);
    expect(second.enter).toBeCloseTo(sweep(first).to);
    expect(third.enter).toBeCloseTo(sweep(second).to);
    // The finisher is committed: it takes longer to raise than either cut takes to wind up.
    expect(third.strikes[0].start).toBeGreaterThan(first.strikes[0].start);
    // Only the finisher lands as a critical.
    expect(events('hit').map((event) => !!event.crit)).toEqual([false, false, true, false]);
    expect(events('swing').map((event) => event.move)).toEqual(moves);
  });

  it('la cadena vuelve a empezar si pasa el tiempo sin seguirla', () => {
    const { knight, step, finish } = arena();
    step({ primary: TAP });
    finish();
    expect(knight.combo).toBe(1);
    step({}, {}, ticks(0.9) - 2);
    expect(knight.combo).toBe(1);
    step({}, {}, 4);
    expect(knight.combo).toBe(0);
    step({ primary: TAP });
    expect(knight.move).toBe('guardian.sword:0:0');
  });

  it('cargar el corte que sigue no deja caer la cadena', () => {
    const { knight, step, finish, charged } = arena();
    step({ primary: TAP });
    finish();
    step({ primary: TAP });
    finish();
    // A full charge lasts longer than the chain waits.
    charged('primary', 1.5);
    expect(knight.move).toBe('guardian.sword:2:4');
  });

  it('un toque dado durante un corte queda en cola y sale al terminar, con la puntería de ese momento', () => {
    const { knight, step } = arena();
    step({ primary: TAP });
    step({}, {}, 8);
    expect(knight.move).toBe('guardian.sword:0:0');
    step({ primary: TAP }, { angle: 1 });
    expect(knight.move).toBe('guardian.sword:0:0');
    expect(knight.buffered).toBe('guardian.sword');
    // The rest of the first cut, aiming somewhere else by the time the second goes out.
    step({}, { angle: 2 }, 4);
    expect(knight.move).toBe('guardian.sword:1:0');
    expect(knight.moveAngle).toBe(2);
    // Too early a press is forgotten.
    const late = arena();
    late.step({ primary: TAP });
    late.step({ primary: TAP });
    late.step({}, {}, ticks(MOVES['guardian.sword:0:0'].duration) + 1);
    expect(INPUT_BUFFER).toBeLessThan(MOVES['guardian.sword:0:0'].duration - RULES.tick);
    expect(late.knight.move).toBe('');
  });

  it('la puntería queda fija durante el corte: girar a mitad no lo desvía', () => {
    const { knight, rival, step, finish, inFront } = arena();
    inFront(rival);
    step({ primary: TAP });
    step({}, { angle: Math.PI }, 1);
    expect(knight.moveAngle).toBe(0);
    finish();
    expect(rival.hp).toBe(19);
  });
});

describe('Caballero · el golpe sigue a la hoja', () => {
  const at = (knight: Player, degrees: number, gap: number) => ({
    x: knight.x + Math.cos((degrees * Math.PI) / 180) * gap,
    y: knight.y + Math.sin((degrees * Math.PI) / 180) * gap,
    invuln: 0,
  });

  it('barre de derecha a izquierda: alcanza primero a quien está a la derecha', () => {
    const { knight, rival, other, step } = arena();
    Object.assign(rival, at(knight, 50, 40));
    Object.assign(other, at(knight, -50, 40));
    step({ primary: TAP });
    const hitAt: Record<string, number> = {};
    for (let tick = 1; tick <= 12; tick++) {
      step();
      if (rival.hp < 20) hitAt.right ??= tick;
      if (other.hp < 20) hitAt.left ??= tick;
    }
    expect(hitAt.right).toBeLessThan(hitAt.left);
    expect(rival.hp).toBe(19);
    expect(other.hp).toBe(19);
  });

  it('el segundo corte vuelve: alcanza primero a quien está a la izquierda', () => {
    const { knight, rival, other, step } = arena();
    knight.combo = 1;
    knight.comboLeft = 5;
    Object.assign(rival, at(knight, 50, 40));
    Object.assign(other, at(knight, -50, 40));
    step({ primary: TAP });
    expect(knight.move).toBe('guardian.sword:1:0');
    const hitAt: Record<string, number> = {};
    for (let tick = 1; tick <= 12; tick++) {
      step();
      if (rival.hp < 20) hitAt.right ??= tick;
      if (other.hp < 20) hitAt.left ??= tick;
    }
    expect(hitAt.left).toBeLessThan(hitAt.right);
  });

  it('el remate baja de una vez: toda la franja recibe el golpe en el mismo instante', () => {
    const { knight, rival, other, step } = arena();
    knight.combo = 2;
    knight.comboLeft = 5;
    Object.assign(rival, at(knight, 0, 24));
    Object.assign(other, at(knight, 0, 80));
    step({ primary: TAP });
    const hitAt: Record<string, number> = {};
    for (let tick = 1; tick <= 18; tick++) {
      step();
      if (rival.hp < 20) hitAt.near ??= tick;
      if (other.hp < 20) hitAt.far ??= tick;
    }
    expect(hitAt.near).toBeDefined();
    expect(hitAt.near).toBe(hitAt.far);
  });

  it('no golpea detrás ni al costado de su arco, ni más allá de la hoja', () => {
    for (const [degrees, gap] of [[180, 35], [100, 40], [-100, 40], [0, 90]] as const) {
      const { knight, rival, step, finish } = arena();
      Object.assign(rival, at(knight, degrees, gap));
      step({ primary: TAP });
      finish();
      expect(rival.hp).toBe(20);
    }
  });

  it('no atraviesa muros', () => {
    const { knight, rival, step, finish } = arena();
    // Below a block, with the rival on top of it: within reach, but the wall is in between.
    Object.assign(knight, { x: 271, y: 226 });
    Object.assign(rival, { x: 271, y: 196, invuln: 0 });
    step({ primary: TAP }, { angle: -Math.PI / 2 });
    finish();
    expect(rival.hp).toBe(20);
  });

  it('el remate es una franja hacia donde se apunta: llega más lejos y es angosto', () => {
    const far = arena();
    far.knight.combo = 2;
    far.knight.comboLeft = 5;
    far.inFront(far.rival, 100);
    far.step({ primary: TAP });
    far.finish();
    expect(far.rival.hp).toBe(18.5);

    const beside = arena();
    beside.knight.combo = 2;
    beside.knight.comboLeft = 5;
    Object.assign(beside.rival, { x: beside.knight.x + 50, y: beside.knight.y + 30, invuln: 0 });
    beside.step({ primary: TAP });
    beside.finish();
    expect(beside.rival.hp).toBe(20);
    // The same body is inside a horizontal cut.
    beside.rival.invuln = 0;
    beside.step({ primary: TAP });
    beside.finish();
    expect(beside.rival.hp).toBe(19);
  });

  it('cada corte golpea una sola vez a cada rival, aunque la hoja lo cruce varios ticks', () => {
    const { rival, step, finish, inFront, events } = arena();
    inFront(rival, 20);
    step({ primary: TAP });
    finish();
    expect(rival.hp).toBe(19);
    expect(events('hit')).toHaveLength(1);
  });

  it('avanza un paso con cada corte y no daña aliados', () => {
    const { knight, rival, other, step, finish, inFront } = arena();
    other.team = knight.team;
    inFront(other, 30);
    inFront(rival, 55);
    const from = knight.x;
    step({ primary: TAP });
    finish();
    expect(knight.x - from).toBeCloseTo(12, 0);
    expect(other.hp).toBe(20);
    expect(rival.hp).toBe(19);
  });
});

describe('Caballero · carga', () => {
  it('sus estados crecen con el tiempo: más daño y un tajo que sale de la hoja', () => {
    expect(KNIGHT_SWORD_CHARGE.tiers.map((tier) => tier.id)).toEqual(['tap', 'low', 'mid', 'high', 'max']);
    const damage = KNIGHT_SWORD_CHARGE.tiers.map((_, tier) => MOVES[`guardian.sword:0:${tier}`].strikes[0].damage);
    expect(damage).toEqual([...damage].sort((a, b) => a - b));
    expect(damage[4]).toBe(2);
    // A tap launches nothing; each charged state launches a longer, stronger slash.
    const waves = [1, 2, 3, 4].map((tier) => MOVES[`guardian.sword:0:${tier}`].waves[0].wave as { range: number; cut: number });
    expect(MOVES['guardian.sword:0:0'].waves).toHaveLength(0);
    expect(waves.map((wave) => wave.range)).toEqual([100, 150, 200, 250]);
    expect(waves.map((wave) => wave.cut)).toEqual([0.3, 0.5, 0.75, 1]);
  });

  it('al soltar sale el corte que tocaba, cargado: pega el doble de cerca y el tajo alcanza lejos', () => {
    const { knight, rival, other, charged, finish, inFront, duel } = arena();
    inFront(rival);
    inFront(other, 200);
    knight.combo = 1;
    knight.comboLeft = 99;
    charged('primary', 1.4);
    expect(knight.move).toBe('guardian.sword:1:4');
    expect(knight.moveCharge).toBeCloseTo(1.4, 1);
    finish();
    for (let i = 0; i < 20; i++) duel.step(new Map());
    // The blade hit the near one; its slash skipped him and reached the far one, a little faded.
    expect(rival.hp).toBe(18);
    expect(20 - other.hp).toBeGreaterThan(0.75);
    expect(20 - other.hp).toBeLessThan(1.5);
    expect(duel.state.waves).toHaveLength(0);
  });

  it('cargando camina al 70 %, no puede usar la Ráfaga y soltar antes da el estado alcanzado', () => {
    const { knight, step } = arena();
    step({ primary: DOWN });
    const from = knight.x;
    step({ primary: HOLD }, { x: 1 }, 30);
    expect(knight.x - from).toBeCloseTo(CLASSES.guardian.speed * 0.7, 0);
    step({ primary: HOLD, q: TAP });
    expect(knight.chargeSkill).toBe('guardian.sword');
    expect(knight.buffered).toBe('');
    expect(knight.flurryCd).toBe(0);
    step({ primary: UP });
    // A little over a second: the high state, not the maximum.
    expect(knight.move).toBe('guardian.sword:0:3');
  });

  it('un golpe leve no interrumpe la carga; uno fuerte sí, y dejar de mantener sin soltar la cancela', () => {
    const hit = arena();
    hit.knight.hp = hit.knight.maxHp = 10;
    hit.step({ primary: DOWN });
    hit.step({ primary: HOLD }, {}, 10);
    const held = hit.knight.chargeT;
    expect(held).toBeGreaterThan(0.3);
    // An arrow's worth: he charges on through it.
    hit.duel.damage(hit.knight, hit.rival, 0, 1);
    expect(hit.knight.chargeSkill).toBe('guardian.sword');
    hit.step({ primary: HOLD });
    expect(hit.knight.chargeT).toBeGreaterThan(held);
    // A heavy blow breaks it, and letting go afterwards throws nothing.
    hit.knight.invuln = 0;
    hit.duel.damage(hit.knight, hit.rival, 0, KNIGHT_SWORD_CHARGE.breakOnDamage!.over! + 0.5);
    expect(hit.knight.chargeSkill).toBe('');
    hit.step({ primary: UP });
    expect(hit.knight.move).toBe('');

    const dropped = arena();
    dropped.step({ primary: DOWN });
    dropped.step({ primary: HOLD }, {}, 10);
    dropped.step();
    expect(dropped.knight.chargeSkill).toBe('');
    expect(dropped.knight.move).toBe('');
  });

  it('un aturdimiento deja caer la carga, el corte en curso y la cadena', () => {
    const { knight, step } = arena();
    step({ primary: TAP });
    step({ primary: DOWN });
    knight.stunLeft = 0.5;
    step({ primary: HOLD });
    expect([knight.move, knight.chargeSkill, knight.combo]).toEqual(['', '', 0]);
  });
});

describe('Caballero · corte de habilidades', () => {
  const arrow = (knight: Player, value: Partial<Arrow> = {}): Arrow => ({
    id: 900, owner: 'rival', team: 'red', classId: 'archer', x: knight.x + 62, y: knight.y, angle: Math.PI, life: 1, ...value,
  });
  /** Starts a cut at a charge tier, and sends a shot at the knight once its blade is out. */
  function cutting(tier: number, shot: Partial<Arrow> = {}) {
    const game = arena('archer');
    const { knight, rival, step, charged } = game;
    rival.team = 'red';
    knight.hp = knight.maxHp = 10;
    if (tier) charged('primary', KNIGHT_SWORD_CHARGE.tiers[tier].at + 0.02);
    else step({ primary: TAP });
    expect(knight.move).toBe(`guardian.sword:0:${tier}`);
    step({}, {}, 3);
    game.duel.state.arrows.push(arrow(knight, shot));
    step({}, {}, 4);
    return game;
  }

  it('un toque apenas la debilita: la flecha sigue y pega menos', () => {
    const { duel, knight, events } = cutting(0);
    expect(events('projectileCut')).toHaveLength(1);
    expect(events('projectileCut')[0].share).toBeCloseTo(0.2 / 0.75);
    expect(duel.state.arrows).toHaveLength(0);
    expect(10 - knight.hp).toBeCloseTo(1 - 0.2 / 0.75);
  });

  it('cuanta más carga, más corta; al 100 % la parte en el aire', () => {
    const taken = [1, 2, 3, 4].map((tier) => {
      const { knight } = cutting(tier, { power: 1, skillId: 'mage.fireball', classId: 'mage' });
      return 10 - knight.hp;
    });
    // A charged orb is worth 2.5 and resists a full cut: 30 %, 50 % and 75 % off, then nothing left.
    expect(taken[0]).toBeCloseTo(2.5 * 0.7);
    expect(taken[1]).toBeCloseTo(2.5 * 0.5);
    expect(taken[2]).toBeCloseTo(2.5 * 0.25);
    expect(taken[3]).toBe(0);
    const full = cutting(4, { power: 1, skillId: 'mage.fireball', classId: 'mage' });
    expect(full.events('projectileCut')[0].share).toBeUndefined();
    expect(full.events('explosion')).toHaveLength(0);
  });

  it('una flecha común se corta del todo con menos carga que un orbe', () => {
    expect(10 - cutting(2).knight.hp).toBeCloseTo(1 - 0.5 / 0.75);
    expect(10 - cutting(3).knight.hp).toBe(0);
  });

  it('hay que interceptarla: la hoja solo corta mientras pasa, y nunca lo que no cruza', () => {
    // Before the blade is out.
    const early = arena('archer');
    early.rival.team = 'red';
    early.knight.hp = early.knight.maxHp = 10;
    early.duel.state.arrows.push(arrow(early.knight, { x: early.knight.x + 40 }));
    early.step({ primary: TAP });
    early.step({}, {}, 3);
    expect(early.knight.hp).toBe(9);
    expect(early.events('projectileCut')).toHaveLength(0);
    // From behind.
    const behind = arena('archer');
    behind.rival.team = 'red';
    behind.knight.hp = behind.knight.maxHp = 10;
    behind.charged('primary', 1.5);
    behind.step({}, {}, 3);
    behind.duel.state.arrows.push(arrow(behind.knight, { x: behind.knight.x - 62, angle: 0 }));
    behind.step({}, {}, 4);
    expect(behind.knight.hp).toBe(9);
    // An ally's arrow is left alone.
    const friendly = arena('archer');
    friendly.rival.team = friendly.knight.team;
    friendly.charged('primary', 1.5);
    friendly.step({}, {}, 3);
    friendly.duel.state.arrows.push(arrow(friendly.knight, { team: friendly.knight.team, angle: 0, x: friendly.knight.x + 20 }));
    friendly.step({}, {}, 2);
    expect(friendly.events('projectileCut')).toHaveLength(0);
  });

  it('el tajo que sale de la hoja también corta lo que cruza', () => {
    const { duel, knight, rival, charged, step, events } = arena('archer');
    rival.team = 'red';
    knight.hp = knight.maxHp = 10;
    charged('primary', 1.5);
    step({}, {}, 7);
    expect(duel.state.waves).toHaveLength(1);
    duel.state.arrows.push(arrow(knight, { x: knight.x + 220 }));
    step({}, {}, 12);
    expect(events('projectileCut')).toHaveLength(1);
    expect(knight.hp).toBe(10);
  });
});

describe('Caballero · la forma de los tajos', () => {
  const wave = (step: number, tier = 4) => MOVES[`guardian.sword:${step}:${tier}`].waves[0].wave as WaveSpec;

  it('los cortes horizontales lanzan una media luna ancha; el descendente, una grieta angosta y honda que llega más lejos', () => {
    for (const step of [0, 1]) expect(wave(step).form ?? 'crescent').toBe('crescent');
    const rend = wave(2);
    expect(rend.form).toBe('rend');
    expect(rend.halfWidth).toBeLessThan(wave(0).halfWidth / 2);
    expect(rend.thickness).toBeGreaterThan(wave(0).thickness * 3);
    expect(rend.bow).toBe(0);
    expect(rend.range).toBeGreaterThan(wave(0).range);
    expect(rend.damage).toBeGreaterThan(wave(0).damage);
  });

  it('la grieta corre por la línea del golpe: alcanza lejos en ella y no a quien está al costado', () => {
    const { duel, knight, rival, other, charged, finish } = arena();
    knight.combo = 2;
    knight.comboLeft = 99;
    Object.assign(rival, { x: knight.x + 280, y: knight.y, invuln: 0 });
    Object.assign(other, { x: knight.x + 200, y: knight.y + 45, invuln: 0 });
    charged('primary', 1.4);
    expect(knight.move).toBe('guardian.sword:2:4');
    finish();
    for (let i = 0; i < 30; i++) duel.step(new Map());
    expect(rival.hp).toBeLessThan(20);
    expect(other.hp).toBe(20);
    // The same body beside the line is inside a horizontal cut's crescent.
    const broad = arena();
    Object.assign(broad.other, { x: broad.knight.x + 200, y: broad.knight.y + 45, invuln: 0 });
    broad.charged('primary', 1.4);
    expect(broad.knight.move).toBe('guardian.sword:0:4');
    broad.finish();
    for (let i = 0; i < 30; i++) broad.duel.step(new Map());
    expect(broad.other.hp).toBeLessThan(20);
  });
});

describe('Caballero · Ráfaga de Acero', () => {
  it('un toque son tres golpes distintos que avanzan: cada uno electriza y juntos descargan', () => {
    const { knight, rival, step, finish, inFront, events } = arena();
    inFront(rival, 34);
    step({ q: TAP });
    expect(knight.move).toBe('guardian.flurry:0');
    expect(knight.flurryCd).toBeCloseTo(KNIGHT_FLURRY_COOLDOWN);
    finish();
    expect(events('hit')).toHaveLength(3);
    expect(20 - rival.hp).toBeCloseTo(1.75);
    // Three shocks: the last one discharges into a short stun.
    expect(events('shock')).toHaveLength(1);
    expect(rival.stunLeft).toBeGreaterThan(0);
    expect(rival.shockImmune).toBeGreaterThan(0);
    // Not the same cut three times: a rising cut, a backhand and a thrust.
    const strikes = MOVES['guardian.flurry:0'].strikes;
    expect(strikes.map((strike) => strike.shape.kind)).toEqual(['arc', 'arc', 'lane']);
    expect(new Set(strikes.map((strike) => JSON.stringify(strike.shape))).size).toBe(3);
    expect(strikes.map((strike) => strike.shock)).toEqual([1, 1, 1]);
  });

  it('a media carga son dos cortes potenciados y cada uno lanza su tajo', () => {
    const { duel, knight, rival, other, charged, finish, inFront } = arena();
    inFront(rival, 50);
    inFront(other, 150);
    charged('q', 0.5);
    expect(knight.move).toBe('guardian.flurry:1');
    finish();
    for (let i = 0; i < 15; i++) duel.step(new Map());
    expect(rival.hp).toBe(18);
    // Out of the blade's reach, inside the short slashes'.
    expect(other.hp).toBeLessThan(20);
    expect(MOVES['guardian.flurry:1'].strikes).toHaveLength(2);
    expect(MOVES['guardian.flurry:1'].waves).toHaveLength(2);
  });

  it('a carga máxima es el Corte Celestial: de cerca, medio guerrero; lejos, mucho menos', () => {
    const { duel, knight, rival, other, charged, finish, inFront, events } = arena();
    inFront(rival, 60);
    inFront(other, 480);
    charged('q', KNIGHT_FLURRY_CHARGE.cap);
    expect(knight.move).toBe('guardian.flurry:2');
    expect(MOVES['guardian.flurry:2'].name).toBe('Corte Celestial');
    finish();
    for (let i = 0; i < 30; i++) duel.step(new Map());
    // The blade itself, up close: half of a warrior, as a critical.
    expect(20 - rival.hp).toBeCloseTo(CLASSES.vanguard.hp / 2);
    expect(events('hit')[0].crit).toBe(true);
    // Far across the arena its slash still arrives, faded to less than half.
    expect(20 - other.hp).toBeGreaterThan(0.5);
    expect(20 - other.hp).toBeLessThan(CELESTIAL_CUT.damage / 2);
    expect(duel.state.waves).toHaveLength(0);
    // Three different moves, not one with bigger numbers.
    expect([0, 1, 2].map((tier) => MOVES[`guardian.flurry:${tier}`].strikes.length)).toEqual([3, 2, 1]);
  });

  it('el Corte Celestial es más veloz, más angosto y llega más lejos que la ola del guerrero', () => {
    const warrior = warriorWave(WARRIOR_SLASH_CHARGE.cap);
    const shape = (spec: WaveSpec) => ({ x: 0, y: 0, angle: 0, ...spec });
    expect(CELESTIAL_CUT.speed).toBeGreaterThan(warrior.speed);
    expect(CELESTIAL_CUT.range).toBeGreaterThanOrEqual(1000);
    for (const travelled of [0, 300, 600])
      expect(waveHalfWidth(shape(CELESTIAL_CUT), travelled)).toBeLessThan(waveHalfWidth(shape(warrior), travelled));
    // Strong falloff: all of it up close, less than half past the middle of its run, never nothing.
    expect(curve(CELESTIAL_CUT.falloff, 0)).toBe(1);
    expect(curve(CELESTIAL_CUT.falloff, 0.5)).toBeLessThan(0.5);
    expect(curve(CELESTIAL_CUT.falloff, 1)).toBeGreaterThan(0);
    expect(CELESTIAL_CUT.damage).toBeCloseTo(CLASSES.vanguard.hp / 2);
    expect(CELESTIAL_CUT.tint).toBe('radiant');
  });

  it('el Corte Celestial parte en el aire lo que le lanzan desde lejos', () => {
    const { duel, knight, rival, charged, step, events } = arena('mage');
    rival.team = 'red';
    knight.hp = knight.maxHp = 10;
    charged('q', KNIGHT_FLURRY_CHARGE.cap);
    step({}, {}, 9);
    // A charged orb coming at him from across the arena.
    duel.state.arrows.push({
      id: 7, owner: 'rival', team: 'red', classId: 'mage', skillId: 'mage.fireball', power: 1,
      x: knight.x + 400, y: knight.y, angle: Math.PI, life: 2,
    });
    step({}, {}, 15);
    expect(events('projectileCut').some((event) => event.share === undefined)).toBe(true);
    expect(events('explosion')).toHaveLength(0);
    expect(knight.hp).toBe(10);
  });

  it('tiene recarga, no sale mientras se recarga y cargarla ocupa la espada', () => {
    const { knight, step, finish } = arena();
    step({ q: TAP });
    finish();
    step({ q: TAP });
    expect(knight.move).toBe('');
    step({}, {}, ticks(KNIGHT_FLURRY_COOLDOWN));
    step({ q: DOWN });
    expect(knight.chargeSkill).toBe('guardian.flurry');
    step({ q: HOLD, primary: TAP });
    expect(knight.buffered).toBe('');
    // Interrupted before going out: no cooldown spent.
    knight.stunLeft = 0.1;
    step({ q: HOLD });
    expect(knight.flurryCd).toBe(0);
  });
});

describe('Caballero · Despertar del Relámpago', () => {
  it('R no pide Furia: despierta al instante y después espera su recarga', () => {
    const { knight, step, finish, events } = arena();
    expect(skillCost('guardian.fury')).toBeUndefined();
    step({ r: TAP });
    expect(knight.move).toBe('guardian.fury:0');
    expect(knight.empowered).toBe('awaken');
    expect(knight.furyLeft).toBe(KNIGHT_AWAKEN.duration);
    expect(knight.furyCd).toBe(KNIGHT_AWAKEN.cooldown);
    expect(events('fury')).toHaveLength(1);
    finish();
    step({}, {}, ticks(KNIGHT_AWAKEN.duration));
    expect([knight.empowered, knight.furyLeft]).toEqual(['', 0]);
    // Still cooling down: another press does nothing until the rest of the minute is over.
    step({ r: TAP });
    expect(knight.move).toBe('');
    expect(events('fury')).toHaveLength(1);
    step({}, {}, ticks(KNIGHT_AWAKEN.cooldown - KNIGHT_AWAKEN.duration));
    step({ r: TAP });
    expect(knight.move).toBe('guardian.fury:0');
  });

  it('el mandala lo recorre una sola vez, despacio, y mientras pasa ningún paso lo saca de ahí', () => {
    const awaken = MOVES['guardian.fury:0'];
    expect(awaken.effect).toBe('awaken');
    expect(awaken.duration).toBeGreaterThanOrEqual(0.8);
    expect(awaken.planted).toBe(true);
    const { knight, step, finish } = arena();
    step({ r: TAP });
    step({ mobility: TAP });
    expect([knight.dashLeft, knight.dashCd]).toEqual([0, 0]);
    finish();
    step({ mobility: TAP });
    expect(knight.dashLeft).toBeGreaterThan(0);
  });

  it('despierto, los cortes son violetas: pegan más y cada uno lanza un tajo que electriza', () => {
    const { duel, knight, rival, other, step, finish, inFront } = arena();
    step({ r: TAP });
    finish();
    inFront(rival);
    inFront(other, 120);
    step({ primary: TAP });
    expect(knight.move).toBe('guardian.sword:0:0:awake');
    finish();
    expect(rival.shock).toBe(1);
    for (let i = 0; i < 12; i++) duel.step(new Map());
    expect(20 - rival.hp).toBeCloseTo(KNIGHT_AWAKEN.damage);
    expect(other.hp).toBeLessThan(20);
    const wave = MOVES['guardian.sword:0:0:awake'].waves[0].wave as WaveSpec;
    expect([wave.tint, wave.shock]).toEqual(['violet', 1]);
  });

  it('despierto, cada corte y su tajo electrizan; el remate, el doble', () => {
    const cut = (step: number) => MOVES[`guardian.sword:${step}:0:awake`];
    expect(cut(0).strikes[0].shock).toBe(1);
    expect(cut(2).strikes[0].shock).toBe(2);
    expect((cut(0).waves[0].wave as WaveSpec).shock).toBe(1);
    expect((cut(2).waves[0].wave as WaveSpec).shock).toBe(2);
    expect(MOVES['guardian.sword:0:0'].strikes[0].shock).toBe(0);
  });

  it('el remate despierto lanza el tajo más fuerte de la cadena', () => {
    const wave = (step: number) => MOVES[`guardian.sword:${step}:0:awake`].waves[0].wave as WaveSpec;
    expect(wave(2).damage).toBeGreaterThan(wave(0).damage);
    expect(wave(2).range).toBeGreaterThan(wave(1).range);
    expect(wave(0)).toEqual(wave(1));
  });

  it('despierto, la Ráfaga suelta rayos, el Corte Celestial es violeta y el paso llega más lejos y pega más', () => {
    expect(MOVES['guardian.flurry:0'].waves).toHaveLength(0);
    expect(MOVES['guardian.flurry:0:awake'].waves).toHaveLength(3);
    const celestial = MOVES['guardian.flurry:2:awake'].waves[0].wave as WaveSpec;
    expect(celestial.tint).toBe('violet');
    expect(celestial.shock).toBeGreaterThan(0);
    const launch = (id: string) => MOVES[id].dash!;
    expect(launch('guardian.dash:0:awake').distance(0)).toBeGreaterThan(launch('guardian.dash:0').distance(0));
    expect(launch('guardian.dash:1:awake').hit!.damage).toBeGreaterThan(launch('guardian.dash:1').hit!.damage);
    expect(launch('guardian.dash:0:awake').hit!.shock).toBeGreaterThan(launch('guardian.dash:0').hit!.shock!);
    // Played: the awakened step goes out as violet lightning.
    const { step, finish, events } = arena();
    step({ r: TAP });
    finish();
    step({ mobility: TAP });
    expect(events('dash')[0].color).toBe(WAVE_COLORS.violet.glow);
  });

  it('morir apaga el Despertar', () => {
    const { duel, knight, rival } = arena();
    Object.assign(knight, { empowered: 'awaken', furyLeft: 4, invuln: 0 });
    duel.damage(knight, rival, 0, 99);
    expect([knight.empowered, knight.furyLeft]).toEqual(['', 0]);
  });
});

describe('Caballero · Paso Relámpago', () => {
  it('un toque es un paso relámpago hacia donde apunta: daña y electriza a quien atraviesa, sin invulnerabilidad', () => {
    const { knight, rival, other, step, events } = arena();
    Object.assign(rival, { x: 380, y: 270 });
    Object.assign(other, { x: 440, y: 270 });
    const from = knight.x;
    // Walking south, aiming east: it goes where it aims, at once.
    step({ mobility: TAP }, { y: 1 });
    expect(knight.dashLeft).toBeGreaterThan(0);
    expect(knight.move).toBe('');
    expect(knight.dashCd).toBeCloseTo(KNIGHT_STEP.cooldown);
    step({}, {}, 3);
    expect(knight.dashInvulnerable).toBe(false);
    step({}, {}, 8);
    expect(knight.x - from).toBeCloseTo(KNIGHT_STEP.near, -1);
    expect(Math.abs(knight.y - 270)).toBeLessThan(8);
    expect([rival.hp, other.hp]).toEqual([19, 19]);
    expect([rival.shock, other.shock]).toEqual([1, 1]);
    // It says how far it goes, so a bolt can be drawn along it.
    expect(events('dash')[0].radius).toBeCloseTo(KNIGHT_STEP.near);
  });

  it('cargado, el cuerpo se llena de relámpago: llega más lejos, pega más y electriza el doble', () => {
    const { knight, rival, step, charged, events } = arena();
    Object.assign(rival, { x: 560, y: 270 });
    const from = knight.x;
    charged('mobility', KNIGHT_STEP_CHARGE.cap);
    expect(events('dash')[0].radius).toBeCloseTo(KNIGHT_STEP.far);
    step({}, {}, 16);
    expect(knight.x - from).toBeCloseTo(KNIGHT_STEP.far, -1);
    expect(rival.hp).toBe(18.5);
    expect(rival.shock).toBe(2);
    // The charge costs mana by the second, on top of the step itself.
    expect(knight.mana).toBeLessThan(CLASSES.guardian.mana - SKILLS['guardian.dash'].cost!.amount - 10);
  });

  it('sale al instante aun en medio de un corte, y el corte sigue: la hoja viaja con él', () => {
    const { knight, rival, step, finish } = arena();
    knight.combo = 2;
    knight.comboLeft = 5;
    // Out of the finisher's reach from where he stands, inside it from where the step leaves him.
    Object.assign(rival, { x: knight.x + KNIGHT_STEP.near + 60, y: knight.y, invuln: 0 });
    step({ primary: TAP });
    step({ mobility: TAP });
    expect(knight.dashLeft).toBeGreaterThan(0);
    expect(knight.move).toBe('guardian.sword:2:0');
    finish();
    expect(rival.hp).toBe(18.5);
  });

  it('no saca al Caballero del Corte Celestial: espera a que termine', () => {
    const { knight, step, charged } = arena();
    charged('q', KNIGHT_FLURRY_CHARGE.cap);
    expect(knight.move).toBe('guardian.flurry:2');
    step({ mobility: TAP });
    expect(knight.dashLeft).toBe(0);
    expect(knight.buffered).toBe('guardian.dash');
    // Asked for near its end, it goes out the moment the cut is over.
    step({}, {}, ticks(MOVES['guardian.flurry:2'].duration) - 4);
    step({ mobility: TAP });
    expect(knight.dashLeft).toBe(0);
    step({}, {}, 4);
    expect(knight.move).toBe('');
    expect(knight.dashLeft).toBeGreaterThan(0);
  });

  it('sale aunque esté cargando un corte, y esa carga sigue', () => {
    const { knight, step } = arena();
    step({ primary: DOWN });
    step({ primary: HOLD }, {}, 8);
    step({ primary: HOLD, mobility: DOWN });
    step({ primary: HOLD, mobility: UP });
    expect(knight.dashLeft).toBeGreaterThan(0);
    expect(knight.chargeSkill).toBe('guardian.sword');
  });
});

describe('Caballero · cargar bajo ataque', () => {
  it('cada técnica aguanta según su peso: el corte, golpes de hasta 1,5; la Ráfaga, hasta 2; el paso, cualquiera', () => {
    expect(KNIGHT_SWORD_CHARGE.breakOnDamage).toEqual({ cooldown: 0, over: 1.5 });
    expect(KNIGHT_FLURRY_CHARGE.breakOnDamage).toEqual({ cooldown: 0, over: 2 });
    expect(KNIGHT_STEP_CHARGE.breakOnDamage).toBeNull();
    const hold = (slot: SkillSlot, blow: number) => {
      const game = arena();
      game.knight.hp = game.knight.maxHp = 10;
      game.step({ [slot]: DOWN });
      game.step({ [slot]: HOLD }, {}, 6);
      game.duel.damage(game.knight, game.rival, 0, blow);
      return game.knight.chargeSkill;
    };
    expect(hold('q', 1)).toBe('guardian.flurry');
    expect(hold('q', 2)).toBe('guardian.flurry');
    expect(hold('q', 2.5)).toBe('');
    expect(hold('primary', 1.5)).toBe('guardian.sword');
    expect(hold('primary', 2)).toBe('');
    expect(hold('mobility', 3)).toBe('guardian.dash');
  });

  it('una flecha que le pega mientras carga el Corte Celestial no lo interrumpe, y el corte sale igual', () => {
    const { duel, knight, rival, step } = arena('archer');
    rival.team = 'red';
    knight.hp = knight.maxHp = 10;
    step({ q: DOWN });
    step({ q: HOLD }, {}, 10);
    duel.state.arrows.push({ id: 5, owner: 'rival', team: 'red', classId: 'archer', x: knight.x + 30, y: knight.y, angle: Math.PI, life: 1 });
    step({ q: HOLD }, {}, ticks(KNIGHT_FLURRY_CHARGE.cap));
    expect(knight.hp).toBe(9);
    step({ q: UP });
    expect(knight.move).toBe('guardian.flurry:2');
  });

  it('un golpe que lo mata sí termina con todo', () => {
    const { duel, knight, rival, step } = arena();
    step({ q: DOWN });
    step({ q: HOLD }, {}, 10);
    duel.damage(knight, rival, 0, knight.hp);
    expect([knight.chargeSkill, knight.move]).toEqual(['', '']);
  });
});

describe('Caballero · electrizado', () => {
  const shock = (duel: Duel, target: Player, stacks: number) =>
    (duel as unknown as { shockPlayer(target: Player, stacks: number): void }).shockPlayer(target, stacks);

  it('cada carga frena un poco; al llenarse descarga en un aturdimiento breve, y un momento de inmunidad', () => {
    const { duel, rival, events } = arena();
    shock(duel, rival, 1);
    expect([rival.shock, rival.shockLeft]).toEqual([1, SHOCK.duration]);
    // Slower by a tenth per stack (the warrior's inertia set aside: up to speed first).
    const walker = { ...rival, x: 400, y: 270, vx: CLASSES.vanguard.speed, vy: 0 };
    movePlayer(walker, { ...idleInput(1), x: 1 }, false);
    expect(walker.x - 400).toBeLessThan(CLASSES.vanguard.speed * RULES.tick);
    shock(duel, rival, 2);
    expect(rival.shock).toBe(0);
    expect(rival.stunLeft).toBeCloseTo(SHOCK.stun);
    expect(rival.shockImmune).toBeCloseTo(SHOCK.immunity);
    expect(events('shock')).toHaveLength(1);
    shock(duel, rival, 1);
    expect(rival.shock).toBe(0);
  });

  it('las cargas se apagan solas si nada las renueva', () => {
    const { duel, rival } = arena();
    shock(duel, rival, 2);
    for (let i = 0; i < ticks(SHOCK.duration) + 1; i++) duel.step(new Map());
    expect(rival.shock).toBe(0);
  });

  it('un cuerpo de hierro descarga sin aturdirse', () => {
    const { duel, rival } = arena();
    rival.empowered = 'reinforce';
    rival.furyLeft = 5;
    shock(duel, rival, 3);
    expect(rival.stunLeft).toBe(0);
    expect(rival.shock).toBe(0);
  });
});

describe('Caballero · límites', () => {
  it('en una arena la espada solo se mueve por sus técnicas: una entrada vieja no hace nada', () => {
    const { duel, knight, rival, inFront } = arena();
    inFront(rival);
    const from = knight.x;
    for (let i = 0; i < 12; i++)
      duel.step(new Map([[knight.id, { ...idleInput(1), sword: i === 0, dash: i === 0, guard: true }]]));
    expect(knight.windup).toBe(0);
    expect(knight.x).toBe(from);
    expect(rival.hp).toBe(20);
    expect('guarding' in knight).toBe(false);
  });

  it('en Lugunica la espada conserva su tajo de siempre', () => {
    const world = new World();
    const hero = world.join(newCharacter('hero', 'account', 'Hero', 'guardian'));
    world.step(new Map([[hero.id, { ...idleInput(1), sword: true }]]));
    expect(hero.windup).toBeGreaterThan(0);
    expect(hero.move).toBe('');
    world.step(new Map([[hero.id, input({ primary: TAP })]]));
    expect(hero.move).toBe('');
  });
});
