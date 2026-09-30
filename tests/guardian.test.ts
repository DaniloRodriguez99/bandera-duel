import { describe, expect, it } from 'vitest';
import {
  CLASSES,
  DEFAULT_LOADOUTS,
  Duel,
  INPUT_BUFFER,
  KNIGHT_AWAKEN,
  KNIGHT_FLURRY_COOLDOWN,
  KNIGHT_SWORD_CHARGE,
  MOVES,
  RESOURCES,
  RULES,
  SKILLS,
  idleInput,
  type Arrow,
  type ClassId,
  type Input,
  type Player,
  type SkillSlot,
  type SlotInputState,
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
  it('es más veloz que nadie, no lleva escudo y su kit deja Q, E y F libres', () => {
    expect(CLASSES.guardian.speed).toBeGreaterThan(CLASSES.archer.speed);
    expect(CLASSES.guardian.speed).toBeGreaterThan(CLASSES.vanguard.speed);
    expect(DEFAULT_LOADOUTS.guardian).toEqual({
      primary: 'guardian.sword', secondary: 'guardian.flurry', mobility: 'guardian.dash',
      q: null, e: null, f: null, r: 'guardian.fury',
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
    expect(MOVES[moves[0]].strikes[0].shape.kind).toBe('arc');
    expect(MOVES[moves[2]].strikes[0].shape.kind).toBe('lane');
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
    step({ primary: HOLD, secondary: TAP });
    expect(knight.chargeSkill).toBe('guardian.sword');
    expect(knight.buffered).toBe('');
    expect(knight.flurryCd).toBe(0);
    step({ primary: UP });
    // A little over a second: the high state, not the maximum.
    expect(knight.move).toBe('guardian.sword:0:3');
  });

  it('un golpe recibido rompe la carga, y dejar de mantener sin soltar la cancela', () => {
    const hit = arena();
    hit.step({ primary: DOWN });
    hit.step({ primary: HOLD }, {}, 10);
    expect(hit.knight.chargeT).toBeGreaterThan(0.3);
    hit.duel.damage(hit.knight, hit.rival, 0, 0.5);
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

describe('Caballero · Ráfaga de Acero', () => {
  it('un toque son tres cortes veloces que entran todos y solo el último empuja', () => {
    const { knight, rival, step, finish, inFront, events } = arena();
    inFront(rival, 34);
    const from = rival.x;
    step({ secondary: TAP });
    expect(knight.move).toBe('guardian.flurry:0');
    expect(knight.flurryCd).toBeCloseTo(KNIGHT_FLURRY_COOLDOWN);
    step({}, {}, 8);
    // Two cuts in: no push yet.
    expect(rival.hp).toBe(19);
    expect(rival.x).toBe(from);
    finish();
    expect(rival.hp).toBe(18.5);
    expect(rival.x).toBeGreaterThan(from);
    expect(events('hit')).toHaveLength(3);
    expect(MOVES['guardian.flurry:0'].strikes).toHaveLength(3);
  });

  it('a media carga son dos cortes potenciados y cada uno lanza su tajo', () => {
    const { duel, knight, rival, other, charged, finish, inFront } = arena();
    inFront(rival, 50);
    inFront(other, 150);
    charged('secondary', 0.5);
    expect(knight.move).toBe('guardian.flurry:1');
    finish();
    for (let i = 0; i < 15; i++) duel.step(new Map());
    expect(rival.hp).toBe(18);
    // Out of the blade's reach, inside the short slashes'.
    expect(other.hp).toBeLessThan(20);
    expect(MOVES['guardian.flurry:1'].strikes).toHaveLength(2);
    expect(MOVES['guardian.flurry:1'].waves).toHaveLength(2);
  });

  it('a carga máxima es un solo corte devastador, crítico, cuyo tajo parte habilidades', () => {
    const { duel, knight, rival, other, charged, finish, inFront, events } = arena();
    inFront(rival, 70);
    inFront(other, 260);
    charged('secondary', 1.2);
    expect(knight.move).toBe('guardian.flurry:2');
    finish();
    expect(rival.hp).toBe(17.5);
    expect(events('hit')[0].crit).toBe(true);
    for (let i = 0; i < 20; i++) duel.step(new Map());
    expect(20 - other.hp).toBeGreaterThan(1.2);
    const wave = MOVES['guardian.flurry:2'].waves[0].wave as { cut: number };
    expect(wave.cut).toBeGreaterThan(1);
    // Three different moves, not one with bigger numbers.
    expect(new Set([0, 1, 2].map((tier) => MOVES[`guardian.flurry:${tier}`].duration)).size).toBe(3);
  });

  it('tiene recarga, no sale mientras se recarga y cargarla ocupa la espada', () => {
    const { knight, step, finish } = arena();
    step({ secondary: TAP });
    finish();
    step({ secondary: TAP });
    expect(knight.move).toBe('');
    step({}, {}, ticks(KNIGHT_FLURRY_COOLDOWN));
    step({ secondary: DOWN });
    expect(knight.chargeSkill).toBe('guardian.flurry');
    step({ secondary: HOLD, primary: TAP });
    expect(knight.buffered).toBe('');
    // Interrupted before going out: no cooldown spent.
    knight.stunLeft = 0.1;
    step({ secondary: HOLD });
    expect(knight.flurryCd).toBe(0);
  });
});

describe('Caballero · Furia y Despertar', () => {
  it('la Furia se gana golpeando y cortando, y el remate da más', () => {
    const { knight, rival, step, finish, inFront } = arena();
    const gained: number[] = [];
    for (let i = 0; i < 3; i++) {
      inFront(rival);
      const before = knight.rage;
      step({ primary: TAP });
      finish();
      gained.push(knight.rage - before);
    }
    expect(gained).toEqual([12, 12, 18]);
    // Missing earns nothing.
    Object.assign(rival, { x: 800 });
    const before = knight.rage;
    step({ primary: TAP });
    finish();
    expect(knight.rage).toBe(before);
  });

  it('cortar una habilidad también la llena, según cuánto cortó', () => {
    const { duel, knight, rival, charged, step } = arena('archer');
    rival.team = 'red';
    charged('primary', 1.5);
    step({}, {}, 3);
    duel.state.arrows.push({ id: 1, owner: 'rival', team: 'red', classId: 'archer', x: knight.x + 62, y: knight.y, angle: Math.PI, life: 1 });
    step({}, {}, 3);
    expect(knight.rage).toBe(15);
  });

  it('con la barra llena, R despierta la espada: 8 s, más daño y un tajo en cada corte', () => {
    const { duel, knight, rival, other, step, finish, inFront, events } = arena();
    knight.rage = RESOURCES.rage.max - 1;
    step({ r: TAP });
    expect(knight.furyLeft).toBe(0);
    knight.rage = RESOURCES.rage.max;
    step({ r: TAP });
    expect(knight.move).toBe('guardian.fury:0');
    expect(knight.furyLeft).toBe(KNIGHT_AWAKEN.duration);
    expect(events('fury')).toHaveLength(1);
    finish();
    // Awake, even a tap throws its slash, and the blade bites harder.
    inFront(rival);
    inFront(other, 120);
    step({ primary: TAP });
    expect(knight.move).toBe('guardian.sword:0:0:awake');
    finish();
    for (let i = 0; i < 12; i++) duel.step(new Map());
    expect(20 - rival.hp).toBeCloseTo(KNIGHT_AWAKEN.damage);
    expect(other.hp).toBeLessThan(20);
    // The bar is the clock: it runs down and nothing refills it until it is over.
    expect(knight.rage).toBeLessThan(RESOURCES.rage.max);
    expect(knight.rage).toBeCloseTo((RESOURCES.rage.max * knight.furyLeft) / KNIGHT_AWAKEN.duration, 0);
    step({}, {}, ticks(KNIGHT_AWAKEN.duration));
    expect(knight.furyLeft).toBe(0);
    expect(knight.rage).toBe(0);
  });

  it('el remate despierto lanza el tajo más fuerte de la cadena', () => {
    const wave = (step: number) => MOVES[`guardian.sword:${step}:0:awake`].waves[0].wave as { damage: number; range: number };
    expect(wave(2).damage).toBeGreaterThan(wave(0).damage);
    expect(wave(2).range).toBeGreaterThan(wave(1).range);
    expect(wave(0)).toEqual(wave(1));
  });

  it('morir apaga el Despertar y vacía la Furia', () => {
    const { duel, knight, rival } = arena();
    Object.assign(knight, { rage: 60, furyLeft: 4, invuln: 0 });
    duel.damage(knight, rival, 0, 99);
    expect([knight.rage, knight.furyLeft]).toEqual([0, 0]);
  });
});

describe('Caballero · Paso Relámpago', () => {
  it('recorre unos 190 u, daña una vez a quien atraviesa y no es invulnerable', () => {
    const { duel, knight, rival, other, step } = arena();
    Object.assign(rival, { x: 365, y: 270 });
    Object.assign(other, { x: 430, y: 270 });
    const from = knight.x;
    step({ mobility: TAP }, { x: 1 });
    expect(knight.dashInvulnerable).toBe(false);
    expect(knight.dashCd).toBeCloseTo(RULES.guardianDashCooldown);
    step({}, {}, ticks(RULES.guardianDashDuration) + 1);
    expect(knight.x - from).toBeCloseTo(190, 0);
    expect(rival.hp).toBe(19);
    expect(other.hp).toBe(19);
    knight.invuln = 0;
    expect(duel.damage(knight, rival, Math.PI, 1)).toBe(true);
  });

  it('corta la recuperación de un corte, nunca su preparación ni su filo', () => {
    const { knight, step } = arena();
    step({ primary: TAP });
    step({ mobility: TAP }, { x: 1 }, 1);
    expect(knight.dashCd).toBe(0);
    expect(knight.move).toBe('guardian.sword:0:0');
    // Past the blade: the step cuts the recovery short.
    step({}, {}, 5);
    step({ mobility: TAP }, { x: 1 });
    expect(knight.dashCd).toBeGreaterThan(0);
    expect(knight.move).toBe('');
  });
});

describe('Caballero · límites', () => {
  it('en una arena la espada solo se mueve por sus técnicas: una entrada vieja no hace nada', () => {
    const { duel, knight, rival, inFront } = arena();
    inFront(rival);
    for (let i = 0; i < 12; i++)
      duel.step(new Map([[knight.id, { ...idleInput(1), sword: i === 0, guard: true }]]));
    expect(knight.windup).toBe(0);
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
