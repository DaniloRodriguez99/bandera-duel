import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_CUT,
  CLASSES,
  DEFAULT_LOADOUTS,
  Duel,
  INTERACTIONS,
  MAPS,
  MOVES,
  RULES,
  SKILLS,
  WARRIOR_LAUNCH,
  WARRIOR_PARRY,
  WARRIOR_PARRY_CHARGE,
  WARRIOR_REINFORCE,
  WARRIOR_SLASH_CHARGE,
  WARRIOR_SWORD_CHARGE,
  curve,
  titanSlash,
  idleInput,
  movePlayer,
  newPlayer,
  warriorWave,
  waveHalfWidth,
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

function arena(enemy: ClassId = 'guardian', third: ClassId = 'archer') {
  const duel = new Duel('courtyard', 'ffa3');
  const warrior = duel.add('warrior', 'Guerrero', 'vanguard');
  const rival = duel.add('rival', 'Rival', enemy);
  const other = duel.add('other', 'Otro', third);
  duel.state.phase = 'playing';
  // The open lane in the middle of the courtyard; the warrior looks east.
  Object.assign(warrior, { x: 330, y: 270, angle: 0, invuln: 0 });
  Object.assign(rival, { x: 800, y: 270, angle: Math.PI, invuln: 0, hp: 30, maxHp: 30 });
  Object.assign(other, { x: 800, y: 430, angle: Math.PI, invuln: 0, hp: 30, maxHp: 30 });
  const inputs = new Map<string, Input>();
  const step = (keys: Keys = {}, extra: Partial<Input> = {}, count = 1) => {
    for (let i = 0; i < count; i++) duel.step(new Map([...inputs, [warrior.id, input(keys, extra)]]));
  };
  const finish = () => {
    for (let i = 0; i < 90 && warrior.move; i++) step();
  };
  const charged = (slot: SkillSlot, seconds: number) => {
    step({ [slot]: DOWN });
    step({ [slot]: HOLD }, {}, ticks(seconds));
    step({ [slot]: UP });
  };
  const inFront = (body: Player, gap = 50) =>
    Object.assign(body, { x: warrior.x + gap, y: warrior.y, invuln: 0 });
  const events = (kind: string) => duel.state.events.filter((event) => event.kind === kind);
  return { duel, warrior, rival, other, inputs, step, finish, charged, inFront, events };
}

describe('Guerrero · identidad', () => {
  it('es el más lento y el que más aguanta, y su kit es todo suyo', () => {
    expect(CLASSES.vanguard.hp).toBe(5);
    expect(CLASSES.vanguard.speed).toBeLessThan(CLASSES.guardian.speed - 30);
    expect(DEFAULT_LOADOUTS.vanguard).toEqual({
      primary: 'vanguard.sword', secondary: null, mobility: 'vanguard.dash',
      q: 'vanguard.slash', e: 'vanguard.counter', f: null, r: 'vanguard.reinforce',
    });
    // The archer keeps the shared dodge; the warrior launches himself instead.
    expect(SKILLS['common.dash'].compatibleClasses).toEqual(['archer']);
  });

  it('sus técnicas tienen nombres de fuerza y contragolpe, y un ícono propio cada una', () => {
    const ids = ['vanguard.sword', 'vanguard.slash', 'vanguard.counter', 'vanguard.dash', 'vanguard.reinforce'] as const;
    expect(ids.map((id) => SKILLS[id].name)).toEqual([
      'Mandoble del Titán', 'Creciente Escarlata', 'Parry', 'Embestida Sísmica', 'Cuerpo de Titán',
    ]);
    expect(new Set(ids.map((id) => SKILLS[id].icon)).size).toBe(ids.length);
    expect(['vanguard.sword:0:0', 'vanguard.sword:1:0'].map((id) => MOVES[id].name)).toEqual(['Barrido del Titán', 'Caída de Montaña']);
  });

  it('arranca con inercia: tarda un instante en alcanzar su velocidad; los demás no', () => {
    const heavy = newPlayer('w', 'W', 'blue', 'vanguard');
    const light = newPlayer('k', 'K', 'blue', 'guardian');
    Object.assign(heavy, { x: 300, y: 270 });
    Object.assign(light, { x: 300, y: 270 });
    movePlayer(heavy, input({}, { x: 1 }), false);
    movePlayer(light, input({}, { x: 1 }), false);
    expect(light.x - 300).toBeCloseTo(CLASSES.guardian.speed * RULES.tick);
    expect(heavy.x - 300).toBeLessThan(CLASSES.vanguard.speed * RULES.tick * 0.5);
    // Up to speed a moment later.
    for (let i = 0; i < ticks(CLASSES.vanguard.accel) + 1; i++) movePlayer(heavy, input({}, { x: 1 }), false);
    const from = heavy.x;
    movePlayer(heavy, input({}, { x: 1 }), false);
    expect(heavy.x - from).toBeCloseTo(CLASSES.vanguard.speed * RULES.tick);
    // And it takes as long to stop.
    movePlayer(heavy, input(), false);
    expect(heavy.x - from).toBeGreaterThan(CLASSES.vanguard.speed * RULES.tick);
  });
});

describe('Guerrero · Mandoble del Titán', () => {
  it('son dos golpes pesados en orden: un barrido y un martillazo desde arriba, lentos de preparar', () => {
    const { warrior, rival, step, finish, inFront, events } = arena();
    const dealt: number[] = [];
    const moves: string[] = [];
    for (let i = 0; i < 3; i++) {
      inFront(rival);
      const hp = rival.hp;
      step({ primary: TAP });
      moves.push(warrior.move);
      finish();
      dealt.push(hp - rival.hp);
    }
    expect(moves).toEqual(['vanguard.sword:0:0', 'vanguard.sword:1:0', 'vanguard.sword:0:0']);
    expect(dealt).toEqual([2, 2.5, 2]);
    expect(MOVES[moves[0]].strikes[0].shape).toMatchObject({ kind: 'arc' });
    // The hammer comes down on the whole strip at once: a blow from overhead, not a thrust.
    expect(MOVES[moves[1]].strikes[0].shape).toMatchObject({ kind: 'lane', drop: true });
    expect(MOVES[moves[1]].enter).toBeCloseTo(MOVES[moves[0]].strikes[0].shape.kind === 'arc' ? MOVES[moves[0]].strikes[0].shape.to : 0);
    expect(events('swing').map((event) => event.move)).toEqual(moves);
    // Slower to start and longer to recover than anything the knight does.
    const knight = MOVES['guardian.sword:0:0'];
    for (const move of moves.slice(0, 2)) {
      expect(MOVES[move].strikes[0].start).toBeGreaterThan(knight.strikes[0].start * 2.5);
      expect(MOVES[move].duration).toBeGreaterThan(knight.duration * 1.8);
      expect(MOVES[move].speed).toBeLessThan(knight.speed);
    }
  });

  it('el golpe tarda en salir: nada pasa hasta que la hoja llega', () => {
    const { rival, step, inFront } = arena();
    inFront(rival);
    step({ primary: TAP });
    step({}, {}, 8);
    expect(rival.hp).toBe(30);
    step({}, {}, 6);
    expect(rival.hp).toBe(28);
  });

  it('cargado es un solo tajo de fuerza que viaja, no un golpe y una onda', () => {
    expect(WARRIOR_SWORD_CHARGE.tiers.map((tier) => tier.id)).toEqual(['tap', 'low', 'mid', 'max']);
    const { duel, warrior, rival, other, charged, finish, inFront } = arena();
    inFront(rival, 108);
    Object.assign(other, { x: warrior.x + 420, y: warrior.y });
    charged('primary', 1.5);
    expect(warrior.move).toBe('vanguard.sword:0:3');
    expect(MOVES['vanguard.sword:0:3'].name).toBe('Media Luna del Titán');
    // No blade of its own to hit with: one slash leaves it.
    expect(MOVES['vanguard.sword:0:3'].strikes).toHaveLength(0);
    expect(MOVES['vanguard.sword:0:3'].waves).toHaveLength(1);
    finish();
    for (let i = 0; i < 30; i++) duel.step(new Map());
    // Each one it crossed was hit once, the near one harder than the far one.
    expect(duel.state.events.filter((event) => event.kind === 'hit')).toHaveLength(2);
    expect(30 - rival.hp).toBeGreaterThan(30 - other.hp);
    expect(30 - other.hp).toBeGreaterThan(1.5);
    // A tap is still the heavy blow, in reach of the blade, and throws nothing.
    const plain = arena();
    plain.inFront(plain.rival, 60);
    plain.step({ primary: TAP });
    plain.finish();
    expect(plain.rival.hp).toBe(28);
    expect(plain.duel.state.waves).toHaveLength(0);
  });

  it('crece con la carga: más largo, ancho, rápido y fuerte, hasta media arena', () => {
    const [low, mid, max] = [0.22, 0.75, 1.5].map((seconds) => titanSlash(seconds, false));
    for (const key of ['range', 'halfWidth', 'speed', 'damage', 'thickness'] as const) {
      expect(mid[key]).toBeGreaterThan(low[key]);
      expect(max[key]).toBeGreaterThan(mid[key]);
    }
    expect(max.range).toBeCloseTo(RULES.width / 2, -1);
    // Its colour tells how much was held.
    expect([low.tint, mid.tint, max.tint]).toEqual(['crimson', 'scarlet', 'blaze']);
    // The overhead blow splits the ground in a narrow, deep line that hits harder.
    const line = titanSlash(1.5, true);
    expect(line.form).toBe('rend');
    expect(line.halfWidth).toBeLessThan(max.halfWidth / 2);
    expect(line.damage).toBeGreaterThan(max.damage);
    // Held a little, it goes a little: a target at 300 u is out of reach.
    const { duel, warrior, rival, charged, finish } = arena();
    Object.assign(rival, { x: warrior.x + 300, y: warrior.y, invuln: 0 });
    charged('primary', 0.3);
    finish();
    for (let i = 0; i < 30; i++) duel.step(new Map());
    expect(rival.hp).toBe(30);
  });

  it('ningún muro lo frena: el tajo cargado llega a quien está detrás', () => {
    const { duel, warrior, rival, charged, finish } = arena();
    const wall = MAPS.courtyard.walls.find((w) => w.x > 400 && w.y < 270 && w.x + w.w < 600)!;
    Object.assign(warrior, { x: wall.x - 60, y: wall.y + wall.h / 2 });
    Object.assign(rival, { x: wall.x + wall.w + 40, y: wall.y + wall.h / 2, invuln: 0 });
    charged('primary', 1.5);
    finish();
    for (let i = 0; i < 30; i++) duel.step(new Map());
    expect(rival.hp).toBeLessThan(30);
  });

  it('el mandoble no corta proyectiles: para eso está la Creciente', () => {
    const { duel, warrior, rival, step, events } = arena('archer');
    step({ primary: TAP });
    step({}, {}, 10);
    duel.state.arrows.push({ id: 1, owner: rival.id, team: rival.team, classId: 'archer', x: warrior.x + 62, y: warrior.y, angle: Math.PI, life: 1 });
    step({}, {}, 4);
    expect(events('projectileCut')).toHaveLength(0);
    expect(warrior.hp).toBe(CLASSES.vanguard.hp - RULES.arrowDamage);
  });

  it('el martillazo empuja más que el barrido, y más que cualquier corte del Caballero', () => {
    const blow = (step: number) => MOVES[`vanguard.sword:${step}:0`].strikes[0].knockback;
    expect(blow(1)).toBeGreaterThan(blow(0));
    expect(blow(0)).toBeGreaterThan(MOVES['guardian.sword:0:0'].strikes[0].knockback);
  });
});

describe('Guerrero · Creciente Escarlata', () => {
  it('un toque lanza la creciente de siempre: atraviesa a todos los rivales de su camino', () => {
    const { duel, warrior, rival, other, step } = arena();
    Object.assign(rival, { x: 400, y: 270 });
    Object.assign(other, { x: 480, y: 280 });
    step({ q: TAP });
    expect(warrior.move).toBe('vanguard.slash:0');
    expect(warrior.slashCd).toBeCloseTo(5);
    step({}, {}, 30);
    expect(duel.state.waves).toHaveLength(0);
    expect(rival.hp).toBeLessThan(30);
    expect(other.hp).toBeLessThan(30);
    expect(30 - rival.hp).toBeGreaterThan(1.2);
    // Short reach: nothing 320 u away.
    const far = arena();
    Object.assign(far.rival, { x: 330 + 320, y: 270 });
    far.step({ q: TAP });
    far.step({}, {}, 40);
    expect(far.rival.hp).toBe(30);
    // And it has a cooldown.
    far.step({ q: TAP });
    expect(far.warrior.move).toBe('');
  });

  it('la carga no tiene techo a los 3 s: sigue creciendo hasta cruzar el mapa', () => {
    expect(WARRIOR_SLASH_CHARGE.full).toBe(3);
    expect(WARRIOR_SLASH_CHARGE.cap).toBeGreaterThanOrEqual(7);
    const stats = [0, 1, 3, 5, 7].map(warriorWave);
    for (const key of ['halfWidth', 'range', 'damage', 'resist'] as const)
      expect(stats.map((wave) => wave[key])).toEqual([...stats.map((wave) => wave[key])].sort((a, b) => a - b));
    expect(stats[2].range).toBeLessThan(600);
    // Overcharged, it fans out and outruns the arena's diagonal.
    expect(stats[4].range).toBeGreaterThan(Math.hypot(RULES.width, RULES.height));
    expect(waveHalfWidth({ x: 0, y: 0, angle: 0, ...stats[4] }, 800)).toBeGreaterThan(RULES.height / 2);
    expect(stats[0].spread).toBe(0);
    expect(stats[4].spread).toBeGreaterThan(0.3);
  });

  it('cargarla cuesta maná por segundo: la ola colosal pide casi todo el pozo', () => {
    const cost = SKILLS['vanguard.slash'].cost!;
    expect(cost.resource).toBe('mana');
    expect(cost.amount + cost.perSecond! * WARRIOR_SLASH_CHARGE.cap).toBeLessThanOrEqual(CLASSES.vanguard.mana);
    expect(cost.amount + cost.perSecond! * WARRIOR_SLASH_CHARGE.cap).toBeGreaterThan(CLASSES.vanguard.mana * 0.9);
    const { warrior, charged } = arena();
    warrior.mana = 40;
    charged('q', 4);
    // Twenty-five points bought about two seconds of hold; the release took the rest.
    expect(warrior.moveCharge).toBeLessThan(2.3);
    expect(warrior.moveCharge).toBeGreaterThan(1.8);
    expect(warrior.mana).toBeLessThan(1);
  });

  it('el daño depende de la distancia: devastador de cerca, unos dos corazones al final', () => {
    const colossal = warriorWave(7);
    const { duel, warrior, rival, other } = arena();
    Object.assign(warrior, { x: 60, y: 270 });
    Object.assign(rival, { x: 110, y: 270, hp: 30 });
    Object.assign(other, { x: 920, y: 270, hp: 30 });
    duel.spawnWave(warrior, warrior, 0, colossal);
    for (let i = 0; i < ticks(2.2); i++) duel.step(new Map());
    expect(30 - rival.hp).toBeGreaterThan(4.5);
    // Far across the arena a full overcharge still hits hard, but less than up close.
    expect(30 - other.hp).toBeGreaterThan(3);
    expect(30 - other.hp).toBeLessThan(30 - rival.hp);
    // The longer it was held, the more of its damage it keeps at the end.
    expect(curve(warriorWave(7).falloff, 1)).toBeGreaterThan(curve(warriorWave(0).falloff, 1));
  });

  it('cargando es vulnerable: lento, sin espada ni parry, y un golpe lo interrumpe y le cuesta recarga', () => {
    const { duel, warrior, rival, step } = arena();
    step({ q: DOWN });
    // The charge itself gives him away.
    expect(warrior.revealLeft).toBeGreaterThan(0);
    const from = warrior.x;
    step({ q: HOLD }, { x: 1 }, 30);
    expect(warrior.x - from).toBeLessThan(CLASSES.vanguard.speed * 0.45);
    step({ q: HOLD, primary: TAP, e: TAP });
    expect(warrior.buffered).toBe('');
    expect(warrior.counterLeft).toBe(0);
    expect(warrior.chargeT).toBeGreaterThan(1);
    duel.damage(warrior, rival, 0, 0.5);
    expect(warrior.chargeSkill).toBe('');
    expect(warrior.slashCd).toBeCloseTo(2.5);
    // Still holding the key does not start it over, and letting go throws nothing.
    step({ q: HOLD });
    expect(warrior.chargeSkill).toBe('');
    step({ q: UP });
    expect(duel.state.waves).toHaveLength(0);
  });

  it('la movilidad la cancela, y soltarla lanza el tajo con lo cargado hasta ahí', () => {
    const cancelled = arena();
    cancelled.step({ q: DOWN });
    cancelled.step({ q: HOLD }, {}, 20);
    cancelled.step({ q: HOLD, mobility: DOWN });
    cancelled.step({ q: HOLD, mobility: UP });
    expect(cancelled.warrior.dashCd).toBeGreaterThan(0);
    expect(cancelled.warrior.chargeSkill).toBe('');
    expect(cancelled.warrior.slashCd).toBe(0);
    cancelled.step({ q: UP }, {}, 10);
    expect(cancelled.duel.state.waves).toHaveLength(0);

    const { duel, warrior, charged, step } = arena();
    charged('q', 2);
    expect(warrior.moveCharge).toBeCloseTo(2, 0);
    step({}, {}, 8);
    const wave = duel.state.waves[0];
    expect(wave.halfWidth).toBeCloseTo(warriorWave(warrior.moveCharge).halfWidth);
    expect(wave.halfWidth).toBeGreaterThan(40);
    // The longer the hold, the longer the cooldown and the recovery.
    expect(warrior.slashCd).toBeGreaterThan(5.5);
    expect(MOVES['vanguard.slash:2'].duration).toBeGreaterThan(MOVES['vanguard.slash:0'].duration * 2);
  });

  it('los muros no la frenan: llega hasta su alcance real', () => {
    const { duel, warrior, rival, other } = arena();
    const wall = MAPS.courtyard.walls.find((w) => w.x > 400 && w.y < 270 && w.x + w.w < 600)!;
    Object.assign(warrior, { x: 330, y: wall.y + wall.h / 2 });
    Object.assign(rival, { x: wall.x + wall.w + 30, y: wall.y + wall.h / 2 });
    Object.assign(other, { x: wall.x + wall.w + 30, y: wall.y + wall.h + 45 });
    duel.spawnWave(warrior, warrior, 0, warriorWave(5));
    for (let i = 0; i < ticks(2); i++) duel.step(new Map());
    expect(rival.hp).toBeLessThan(30);
    expect(other.hp).toBeLessThan(30);
  });
});

describe('Guerrero · Parry', () => {
  const arrow = (from: Player, value: Partial<Arrow> = {}): Arrow => ({
    id: 900, owner: from.id, team: from.team, classId: 'archer', x: 400, y: 270, angle: Math.PI, life: 1, ...value,
  });

  it('pulsada es una ventana corta que no frena al Guerrero; fallarla cuesta 3 s', () => {
    const { warrior, step } = arena();
    step({ e: TAP });
    expect(warrior.counterLeft).toBeCloseTo(WARRIOR_PARRY.window);
    expect(warrior.counterCd).toBeCloseTo(curve(WARRIOR_PARRY.cooldown, 0));
    const from = warrior.x;
    step({}, { x: 1 }, ticks(WARRIOR_PARRY.window) + 1);
    expect(warrior.counterLeft).toBe(0);
    expect(warrior.x - from).toBeGreaterThan(CLASSES.vanguard.speed * WARRIOR_PARRY.window * 0.6);
    step({ e: TAP });
    expect(warrior.counterLeft).toBe(0);
  });

  it('mantenida sigue arriba: lo frena, no lo deja golpear, gasta maná y a su tope se suelta sola', () => {
    const { warrior, step } = arena();
    step({ e: DOWN });
    const from = warrior.x;
    step({ e: HOLD }, { x: 1 }, ticks(1));
    expect(warrior.chargeSkill).toBe('vanguard.counter');
    expect(warrior.counterLeft).toBeGreaterThan(0);
    expect(warrior.counterCharge).toBeCloseTo(1, 1);
    expect(warrior.x - from).toBeLessThan(CLASSES.vanguard.speed * 0.7);
    expect(warrior.mana).toBeLessThan(CLASSES.vanguard.mana - 10);
    step({ e: HOLD, primary: TAP });
    expect(warrior.move).toBe('');
    // At its cap it lets go by itself; holding the key does not raise it again.
    step({ e: HOLD }, {}, ticks(WARRIOR_PARRY_CHARGE.cap) - ticks(1) - 1);
    expect(warrior.chargeSkill).toBe('');
    step({ e: HOLD }, {}, ticks(WARRIOR_PARRY.window) + 2);
    expect(warrior.counterLeft).toBe(0);
    // It met nothing: the longest guard costs the longest wait.
    expect(warrior.counterCd).toBeGreaterThan(curve(WARRIOR_PARRY.cooldown, 0) + 1);
  });

  it('cuanto más la sostiene, más rápido, más fuerte y más grande devuelve lo que llega', () => {
    const returned = (hold: number) => {
      const { duel, warrior, rival, step } = arena('archer');
      Object.assign(rival, { x: 600, y: 270 });
      step({ e: DOWN });
      if (hold) step({ e: HOLD }, {}, ticks(hold));
      duel.state.arrows.push(arrow(rival, { x: 380 }));
      step({ e: HOLD }, {}, 3);
      const back = duel.state.arrows.find((a) => a.owner === warrior.id)!;
      return { speed: back.speedScale ?? 1, damage: back.damageScale ?? 1, size: back.sizeScale ?? 1, counterCd: warrior.counterCd };
    };
    const quick = returned(0);
    const held = returned(WARRIOR_PARRY_CHARGE.tiers[3].at);
    expect(held.speed).toBeGreaterThan(quick.speed);
    expect(held.damage).toBeGreaterThan(quick.damage * 1.3);
    expect(held.size).toBeGreaterThan(quick.size);
    // Not in a straight line: the first moments of the hold count the most.
    expect(curve(WARRIOR_PARRY.power, 0.4) - curve(WARRIOR_PARRY.power, 0)).toBeGreaterThan(
      curve(WARRIOR_PARRY.power, 2.2) - curve(WARRIOR_PARRY.power, 1.8),
    );
  });

  it('un orbe cargado pide sostenerla un momento: a tiempo solo lo frena, sostenida lo devuelve', () => {
    const orb = (hold: number) => {
      const { duel, warrior, rival, step, events } = arena('mage');
      Object.assign(rival, { x: 600, y: 270 });
      step({ e: DOWN });
      if (hold) step({ e: HOLD }, {}, ticks(hold));
      duel.state.arrows.push(arrow(rival, { x: 380, classId: 'mage', skillId: 'mage.fireball', power: 1, charged: true }));
      step({ e: HOLD }, {}, 3);
      return { warrior, back: duel.state.arrows.find((a) => a.owner === warrior.id), counters: events('counter').length };
    };
    const quick = orb(0);
    expect(quick.back).toBeUndefined();
    expect(quick.counters).toBe(1);
    expect(quick.warrior.hp).toBe(CLASSES.vanguard.hp);
    const held = orb(WARRIOR_PARRY_CHARGE.tiers[1].at + 0.1);
    expect(held.back).toBeDefined();
    expect(held.warrior.hp).toBe(CLASSES.vanguard.hp);
  });

  it('sostenida lo bastante, le devuelve la Singularidad a su mago; si no, se lo lleva', () => {
    const singularity = (hold: number) => {
      const { duel, warrior, rival, step, events } = arena('mage');
      Object.assign(rival, { x: 700, y: 270 });
      step({ e: DOWN });
      if (hold) step({ e: HOLD }, {}, ticks(hold));
      (duel as unknown as { spawnBlackHole(owner: Player, x: number, y: number): unknown }).spawnBlackHole(rival, warrior.x, warrior.y);
      for (let i = 0; i < 60 && warrior.hp > 0 && duel.state.blackHoles[0]?.owner !== warrior.id; i++) step({ e: HOLD });
      return { duel, warrior, rival, step, events };
    };
    expect(INTERACTIONS.singularity.parryResistance).toBeGreaterThan(curve(WARRIOR_PARRY.power, 1));
    const short = singularity(0);
    expect(short.warrior.hp).toBe(0);
    const held = singularity(0.9);
    expect(held.warrior.hp).toBe(CLASSES.vanguard.hp);
    const hole = held.duel.state.blackHoles[0];
    expect(hole).toMatchObject({ owner: held.warrior.id, team: held.warrior.team, traveling: true });
    expect(held.events('counter')).toHaveLength(1);
    // Off it goes, at the mage who threw it.
    for (let i = 0; i < 90 && held.rival.hp > 0; i++) held.step();
    expect(held.rival.hp).toBe(0);
  });

  it('devuelve el proyectil hacia quien lo lanzó, aunque se haya movido, y más rápido', () => {
    const { duel, warrior, rival, step, events } = arena('archer');
    Object.assign(rival, { x: 600, y: 270, hp: 3, maxHp: 3 });
    duel.state.arrows.push(arrow(rival, { x: 380 }));
    // The archer has walked off the arrow's line since loosing it (clear of the middle wall).
    Object.assign(rival, { x: 560, y: 225 });
    step({ e: TAP });
    step({}, {}, 3);
    const back = duel.state.arrows[0];
    expect(back).toMatchObject({ owner: warrior.id, team: warrior.team, reflected: 1, bounces: 1, speedScale: WARRIOR_PARRY.speed });
    expect(back.angle).toBeCloseTo(Math.atan2(rival.y - back.y, rival.x - back.x), 1);
    expect(events('counter')).toHaveLength(1);
    expect(warrior.hp).toBe(CLASSES.vanguard.hp);
    step({}, {}, 12);
    expect(rival.hp).toBe(3 - RULES.arrowDamage);
    // Success: back in the fight at once, and ready again soon.
    expect(warrior.move).toBe('');
    expect(warrior.counterCd).toBeLessThanOrEqual(WARRIOR_PARRY.successCooldown);
  });

  it('solo para lo que viene de frente, y un golpe por la espalda le rompe la guardia sostenida', () => {
    const { duel, warrior, rival, step, events } = arena('archer');
    duel.state.arrows.push(arrow(rival, { x: warrior.x - 50, angle: 0 }));
    step({ e: TAP });
    step({}, {}, 3);
    expect(events('counter')).toHaveLength(0);
    expect(warrior.hp).toBe(CLASSES.vanguard.hp - RULES.arrowDamage);
    const flanked = arena('archer');
    flanked.step({ e: DOWN });
    flanked.step({ e: HOLD }, {}, 6);
    flanked.duel.state.arrows.push(arrow(flanked.rival, { x: flanked.warrior.x - 50, angle: 0 }));
    flanked.step({ e: HOLD }, {}, 3);
    expect(flanked.warrior.chargeSkill).toBe('');
    expect(flanked.warrior.counterCd).toBeGreaterThan(0);
  });

  it('una salva entera se puede devolver: cada éxito estira la ventana', () => {
    const { duel, warrior, rival, step, events } = arena('archer');
    for (let i = 0; i < 3; i++) duel.state.arrows.push(arrow(rival, { id: 900 + i, x: 370 + i * 110 }));
    step({ e: TAP });
    step({}, {}, 16);
    expect(events('counter')).toHaveLength(3);
    expect(warrior.hp).toBe(CLASSES.vanguard.hp);
  });

  it('frena un golpe cuerpo a cuerpo de frente y deja tambaleando a quien lo dio; sostenida, más', () => {
    const blow = (hold: number) => {
      const { duel, warrior, rival, inputs, step } = arena('guardian');
      Object.assign(rival, { x: warrior.x + 40, y: warrior.y, hp: 3, maxHp: 3 });
      step({ e: DOWN });
      if (hold) step({ e: HOLD }, {}, ticks(hold));
      // The knight cuts into the guard.
      inputs.set(rival.id, input({ primary: TAP }, { angle: Math.PI }));
      step({ e: HOLD });
      inputs.delete(rival.id);
      let staggered = 0;
      for (let i = 0; i < 8; i++) {
        step({ e: HOLD });
        staggered = Math.max(staggered, rival.stunLeft);
      }
      return { duel, warrior, rival, staggered };
    };
    const quick = blow(0);
    expect(quick.warrior.hp).toBe(CLASSES.vanguard.hp);
    expect(quick.staggered).toBeGreaterThan(0);
    expect(quick.rival.x).toBeGreaterThan(quick.warrior.x + 40);
    expect(quick.duel.state.events.some((event) => event.kind === 'counter')).toBe(true);
    expect(blow(1.6).staggered).toBeGreaterThan(quick.staggered);
  });

  it('devuelve un tajo hacia quien lo lanzó', () => {
    const { duel, warrior, rival, step } = arena('guardian');
    Object.assign(rival, { x: 520, y: 270, hp: 10, maxHp: 10 });
    duel.spawnWave(rival, rival, Math.PI, { ...warriorWave(0), damage: 2, tint: 'violet' });
    for (let i = 0; i < 20 && !duel.state.waves.some((w) => w.owner === warrior.id); i++)
      step(duel.state.waves[0] && duel.state.waves[0].travelled > 120 ? { e: TAP } : {});
    const back = duel.state.waves.find((w) => w.owner === warrior.id)!;
    expect(back.reflected).toBe(1);
    expect(back.angle).toBeCloseTo(0, 1);
    step({}, {}, 20);
    expect(warrior.hp).toBe(CLASSES.vanguard.hp);
    expect(rival.hp).toBeLessThan(10);
  });

  it('no para trampas, y un proyectil no rebota para siempre', () => {
    const { duel, warrior, rival, step } = arena('archer');
    duel.state.traps.push({ id: 1, owner: rival.id, team: rival.team, x: warrior.x, y: warrior.y, armLeft: 0, life: 5 });
    step({ e: TAP });
    step();
    expect(warrior.hp).toBe(CLASSES.vanguard.hp - RULES.trapDamage);
    const bounced = arena('archer');
    bounced.duel.state.arrows.push(arrow(bounced.rival, { x: 380, bounces: WARRIOR_PARRY.bounces }));
    bounced.step({ e: TAP });
    bounced.step({}, {}, 3);
    expect(bounced.warrior.hp).toBe(CLASSES.vanguard.hp - RULES.arrowDamage);
  });

  it('corta la recuperación de su propio golpe, pero no su preparación', () => {
    const { warrior, step } = arena();
    step({ primary: TAP });
    step({ e: TAP });
    step({}, {}, 3);
    expect(warrior.counterLeft).toBe(0);
    step({}, {}, 12);
    // The blow is out: from here the parry may cut in.
    step({ e: TAP });
    step();
    expect(warrior.counterLeft).toBeGreaterThan(0);
    expect(warrior.move).toBe('vanguard.counter:0');
  });
});

describe('Guerrero · la Creciente corta lo que le lanzan', () => {
  it('su poder de corte crece con la carga, con un salto al completarse', () => {
    const cut = (seconds: number) => warriorWave(seconds).cut;
    // A tap cuts arrows, a second on it cuts charged orbs.
    expect(cut(0)).toBeGreaterThanOrEqual(INTERACTIONS.lightShot.cutResistance);
    expect(cut(0)).toBeLessThan(INTERACTIONS.heavyShot.cutResistance);
    expect(cut(1)).toBeGreaterThanOrEqual(INTERACTIONS.heavyShot.cutResistance);
    // Only complete does it split the great slashes, and the colossal wave splits even its own kind.
    expect(cut(2.9)).toBeLessThan(CELESTIAL_CUT.resist);
    expect(cut(3)).toBeGreaterThanOrEqual(CELESTIAL_CUT.resist);
    expect(cut(3) - cut(2.9)).toBeGreaterThan(0.3);
    expect(cut(7)).toBeGreaterThanOrEqual(warriorWave(7).resist);
  });

  it('su color sigue a su poder: sangre y violeta, rojo, ardiente y al rojo blanco', () => {
    expect([0, 1, 3, 7].map((seconds) => warriorWave(seconds).tint)).toEqual(['bloodViolet', 'scarlet', 'blaze', 'inferno']);
    // The charge shows the same colours at the same moments.
    const tint = (seconds: number) => [...WARRIOR_SLASH_CHARGE.tiers].reverse().find((tier) => seconds >= tier.at)!.tint;
    expect([0, 1, 3, 7].map(tint)).toEqual(['bloodViolet', 'scarlet', 'blaze', 'inferno']);
  });

  it('una creciente de un toque corta la flecha que le viene de frente', () => {
    const { duel, warrior, rival, step, events } = arena('archer');
    step({ q: TAP });
    step({}, {}, 4);
    duel.state.arrows.push({ id: 1, owner: rival.id, team: rival.team, classId: 'archer', x: warrior.x + 160, y: warrior.y, angle: Math.PI, life: 1 });
    step({}, {}, 10);
    expect(events('projectileCut')).toHaveLength(1);
    expect(warrior.hp).toBe(CLASSES.vanguard.hp);
  });

  it('completa parte un Corte Celestial que le viene de frente; antes de completarse solo lo debilita', () => {
    const meet = (seconds: number) => {
      const { duel, warrior, rival, step, charged } = arena('guardian');
      Object.assign(rival, { x: 900, y: 270 });
      warrior.hp = warrior.maxHp = 10;
      warrior.mana = warrior.maxMana = 1000;
      step({ q: DOWN });
      step({ q: HOLD }, {}, ticks(seconds) - 1);
      duel.spawnWave(rival, rival, Math.PI, CELESTIAL_CUT);
      step({ q: UP });
      for (let i = 0; i < 40; i++) step();
      return 10 - warrior.hp;
    };
    expect(meet(3)).toBe(0);
    const weakened = meet(2.6);
    expect(weakened).toBeGreaterThan(0);
    expect(weakened).toBeLessThan(CELESTIAL_CUT.damage * 0.5);
  });
});

describe('Guerrero · Embestida Sísmica', () => {
  it('carga las piernas y sale hacia donde apunta, apartando a quien se cruce, sin invulnerabilidad', () => {
    const { duel, warrior, rival, step, events } = arena();
    Object.assign(rival, { x: warrior.x + 60, y: warrior.y });
    // Aiming east while the feet point north: he goes where he aims.
    step({ mobility: TAP }, { y: -1 });
    expect(warrior.move).toBe('vanguard.dash:0');
    // The legs load for a moment before he goes.
    step({}, {}, 3);
    expect(warrior.dashLeft).toBe(0);
    step();
    expect(warrior.dashLeft).toBeGreaterThan(0);
    step();
    expect(warrior.dashInvulnerable).toBe(false);
    step({}, {}, 5);
    expect(warrior.x).toBeGreaterThan(330 + WARRIOR_LAUNCH.near * 0.8);
    expect(Math.abs(warrior.y - 270)).toBeLessThan(10);
    expect(30 - rival.hp).toBeCloseTo(WARRIOR_LAUNCH.hit.damage);
    expect(events('dash').length).toBeGreaterThan(0);
    expect(warrior.dashCd).toBeGreaterThan(0);
  });

  it('mantenido llega más lejos y cuesta más maná', () => {
    const tap = arena();
    tap.step({ mobility: TAP });
    tap.step({}, {}, 20);
    const held = arena();
    held.charged('mobility', WARRIOR_LAUNCH_CHARGE_CAP);
    held.step({}, {}, 20);
    expect(held.warrior.x - 330).toBeGreaterThan(tap.warrior.x - 330 + 90);
    expect(held.warrior.mana).toBeLessThan(tap.warrior.mana);
  });

  it('se puede usar mientras carga el mandoble, y la carga sigue', () => {
    const { warrior, step } = arena();
    step({ primary: DOWN });
    step({ primary: HOLD }, {}, 10);
    step({ primary: HOLD, mobility: DOWN });
    step({ primary: HOLD, mobility: UP });
    expect(warrior.move).toBe('vanguard.dash:0');
    expect(warrior.chargeSkill).toBe('vanguard.sword');
  });
});
const WARRIOR_LAUNCH_CHARGE_CAP = 0.6;

describe('Guerrero · Cuerpo de Titán', () => {
  it('cuesta maná, sube un mandala y lo refuerza unos segundos', () => {
    const { warrior, step, events } = arena();
    step({ r: TAP });
    expect(warrior.move).toBe('vanguard.reinforce:0');
    expect(warrior.empowered).toBe('reinforce');
    expect(warrior.furyLeft).toBeCloseTo(WARRIOR_REINFORCE.duration);
    expect(warrior.mana).toBe(CLASSES.vanguard.mana - SKILLS['vanguard.reinforce'].cost!.amount);
    expect(events('fury')).toHaveLength(1);
    step({}, {}, ticks(WARRIOR_REINFORCE.duration) + 1);
    expect(warrior.empowered).toBe('');
    expect(warrior.reinforceCd).toBeGreaterThan(0);
  });

  it('reforzado recibe menos, nada lo empuja, no le rompen la carga ni lo aturden', () => {
    const { duel, warrior, rival, step } = arena();
    step({ r: TAP });
    const at = { x: warrior.x, y: warrior.y };
    duel.damage(warrior, rival, 0, 1);
    expect(warrior.hp).toBeCloseTo(CLASSES.vanguard.hp - WARRIOR_REINFORCE.taken);
    expect({ x: warrior.x, y: warrior.y }).toEqual(at);
    step({}, {}, 12);
    step({ q: DOWN });
    step({ q: HOLD }, {}, 10);
    warrior.invuln = 0;
    duel.damage(warrior, rival, 0, 0.5);
    expect(warrior.chargeSkill).toBe('vanguard.slash');
    duel.state.traps.push({ id: 7, owner: rival.id, team: rival.team, x: warrior.x, y: warrior.y, armLeft: 0, life: 5 });
    warrior.invuln = 0;
    step({ q: HOLD });
    expect(warrior.stunLeft).toBe(0);
  });

  it('reforzado, hasta un toque del mandoble manda su onda', () => {
    const { duel, warrior, step, finish } = arena();
    step({ r: TAP });
    step({}, {}, 12);
    step({ primary: TAP });
    expect(warrior.move).toBe('vanguard.sword:0:0:iron');
    step({}, {}, 14);
    expect(duel.state.waves).toHaveLength(1);
    finish();
    expect(MOVES['vanguard.sword:0:0:iron'].waves).toHaveLength(1);
    expect(MOVES['vanguard.sword:0:0'].waves).toHaveLength(0);
  });
});

describe('Guerrero · límites', () => {
  it('en una arena la espada vieja no se mueve con la entrada de antes', () => {
    const { duel, warrior, rival, inFront } = arena();
    inFront(rival);
    for (let i = 0; i < 20; i++) duel.step(new Map([[warrior.id, { ...idleInput(1), sword: i === 0 }]]));
    expect(warrior.windup).toBe(0);
    expect(rival.hp).toBe(30);
    expect(duel.state.arrows).toHaveLength(0);
    expect(duel.state.waves).toHaveLength(0);
    expect(warrior.counterLeft).toBe(0);
  });

  it('en Lugunica la maza conserva su golpe de siempre y camina sin inercia', () => {
    const world = new World();
    const hero = world.join(newCharacter('hero', 'account', 'Hero', 'vanguard'));
    world.step(new Map([[hero.id, { ...idleInput(1), sword: true }]]));
    expect(hero.windup).toBeGreaterThan(0);
    expect(hero.move).toBe('');
    const at = hero.x;
    world.step(new Map([[hero.id, { ...idleInput(2), x: 1 }]]));
    expect(hero.x - at).toBeGreaterThan(CLASSES.vanguard.speed * RULES.tick * 0.5);
  });
});
