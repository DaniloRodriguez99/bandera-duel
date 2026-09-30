import { describe, expect, it } from 'vitest';
import {
  CLASSES,
  Duel,
  MAPS,
  RULES,
  idleInput,
  waveHalfWidth,
  type Arrow,
  type ClassId,
  type Input,
  type WaveSpec,
} from '@bandera/shared';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
/** A plain crescent 48 wide that crosses 300 u without losing strength. */
const slash = (values: Partial<WaveSpec> = {}): WaveSpec => ({
  halfWidth: 24,
  spread: 0,
  bow: 8,
  thickness: 16,
  range: 300,
  speed: 420,
  damage: 1.5,
  falloff: [[0, 1]],
  knockback: 24,
  cut: 0,
  resist: 1,
  tint: 'scarlet',
  ...values,
});
function arena(rival: ClassId = 'archer', third: ClassId = 'mage') {
  const duel = new Duel('courtyard', 'ffa3');
  const caster = duel.add('caster', 'Caster', 'vanguard');
  const near = duel.add('near', 'Near', rival);
  const far = duel.add('far', 'Far', third);
  duel.state.phase = 'playing';
  // The middle lane of the courtyard is open from wall to wall.
  Object.assign(caster, { x: 200, y: 270, angle: 0, invuln: 0 });
  Object.assign(near, { x: 300, y: 270, invuln: 0, hp: 10, maxHp: 10 });
  Object.assign(far, { x: 880, y: 500, invuln: 0, hp: 10, maxHp: 10, magicShieldHits: 0 });
  const run = (count: number, inputs: [string, Partial<Input>][] = []) => {
    for (let i = 0; i < count; i++)
      duel.step(new Map(inputs.map(([id, value]) => [id, { ...idleInput(), ...value }])));
  };
  return { duel, caster, near, far, run };
}

describe('tajos que viajan', () => {
  it('golpea una sola vez a cada rival que cruza y se apaga al final de su alcance', () => {
    const { duel, caster, near, far, run } = arena();
    Object.assign(far, { x: 420, y: 280 });
    duel.spawnWave(caster, caster, 0, slash());
    expect(duel.state.waves).toHaveLength(1);
    run(ticks(300 / 420) + 2);
    expect(near.hp).toBe(10 - 1.5);
    expect(far.hp).toBe(10 - 1.5);
    expect(duel.state.waves).toHaveLength(0);
    expect(caster.hp).toBe(CLASSES.vanguard.hp);
  });

  it('no alcanza a quien está fuera de su ancho ni detrás de donde salió', () => {
    const { duel, caster, near, far, run } = arena();
    Object.assign(near, { x: 300, y: 270 + 24 + RULES.radius + 4 });
    Object.assign(far, { x: 150, y: 270 });
    duel.spawnWave(caster, caster, 0, slash());
    run(ticks(1));
    expect(near.hp).toBe(10);
    expect(far.hp).toBe(10);
  });

  it('el daño cae con la distancia según su curva', () => {
    const { duel, caster, near, far, run } = arena();
    Object.assign(near, { x: 230, y: 270 });
    Object.assign(far, { x: 480, y: 270 });
    duel.spawnWave(caster, caster, 0, slash({ damage: 4, falloff: [[0, 1], [1, 0.5]] }));
    run(ticks(1));
    // 30 u of 300: almost all of it. 280 u: a little over half.
    expect(10 - near.hp).toBeGreaterThan(3.6);
    expect(10 - far.hp).toBeGreaterThan(2);
    expect(10 - far.hp).toBeLessThan(2.3);
  });

  it('un tajo con apertura se ensancha y alcanza a los lados lejos, no cerca', () => {
    const { duel, caster, near, far, run } = arena();
    const wide = slash({ halfWidth: 30, spread: 0.45, range: 500 });
    expect(waveHalfWidth({ x: 0, y: 0, angle: 0, ...wide }, 250)).toBeCloseTo(142.5);
    Object.assign(caster, { x: 310, y: 270 });
    // Both stand well off its line: too far aside 25 u out, inside the fan 250 u out.
    Object.assign(near, { x: 335, y: 205 });
    Object.assign(far, { x: 560, y: 220 });
    duel.spawnWave(caster, caster, 0, wide);
    run(ticks(1.3));
    expect(near.hp).toBe(10);
    expect(far.hp).toBeLessThan(10);
  });

  it('los muros hacen sombra: quien se cubre detrás no recibe el tajo', () => {
    const { duel, caster, near, far, run } = arena();
    const wall = MAPS.courtyard.walls.find((w) => w.x > 400 && w.y < 270 && w.x + w.w < 600)!;
    // The caster stands level with the wall; one rival hides right behind it, the other in the open lane.
    Object.assign(caster, { x: 200, y: wall.y + wall.h / 2 });
    Object.assign(near, { x: wall.x + wall.w + 30, y: wall.y + wall.h / 2 });
    Object.assign(far, { x: wall.x + wall.w + 30, y: wall.y + wall.h + 45 });
    duel.spawnWave(caster, caster, 0, slash({ halfWidth: 110, range: 600, damage: 2 }));
    run(ticks(1.5));
    expect(near.hp).toBe(10);
    expect(far.hp).toBe(8);
  });

  it('se apaga cuando un muro frena todo su frente', () => {
    const { duel, caster, run } = arena();
    const wall = MAPS.courtyard.walls.find((w) => w.x > 400 && w.y < 270 && w.x + w.w < 600)!;
    Object.assign(caster, { x: wall.x - 120, y: wall.y + wall.h / 2 });
    duel.spawnWave(caster, caster, 0, slash({ halfWidth: 10, range: 900 }));
    run(ticks(0.6));
    expect(duel.state.waves).toHaveLength(0);
  });

  it('no hiere a aliados ni a su dueño, y atraviesa zombies y los daña', () => {
    const { duel, caster, near, far, run } = arena('necromancer');
    far.team = caster.team;
    Object.assign(far, { x: 260, y: 270 });
    Object.assign(near, { x: 700, y: 270 });
    run(1, [['near', { summon: true }]]);
    const zombie = duel.state.zombies[0];
    Object.assign(zombie, { x: 340, y: 270, spawnLeft: 0, rise: 0, frozenLeft: 99 });
    const hp = zombie.hp;
    duel.spawnWave(caster, caster, 0, slash({ range: 250, damage: 1 }));
    run(ticks(0.8));
    expect(far.hp).toBe(10);
    expect(zombie.hp).toBe(hp - 1);
  });
});

describe('tajos contra otras habilidades', () => {
  const arrow = (id: number, value: Partial<Arrow> = {}): Arrow => ({
    id, owner: 'near', team: 'red', classId: 'archer', x: 420, y: 270, angle: Math.PI, life: 1, ...value,
  });

  it('un tajo que corta parte las flechas que cruza y debilita lo que no llega a cortar', () => {
    const { duel, caster, near, run } = arena();
    Object.assign(near, { x: 800, y: 270 });
    near.team = 'red';
    duel.spawnWave(caster, caster, 0, slash({ cut: 0.5, damage: 0, range: 400 }));
    // A light arrow resists 0.75: a cut of 0.5 takes two thirds of it. A heavy one resists 1.
    duel.state.arrows.push(arrow(1), arrow(2, { y: 280, power: 1, skillId: 'mage.fireball', classId: 'mage' }));
    const cuts = () => duel.state.events.filter((e) => e.kind === 'projectileCut');
    // Both are still in flight when the slash meets them.
    for (let i = 0; i < 8 && cuts().length < 2; i++) run(1);
    expect(duel.state.arrows.find((a) => a.id === 1)?.damageScale).toBeCloseTo(1 - 0.5 / 0.75);
    expect(duel.state.arrows.find((a) => a.id === 2)?.damageScale).toBeCloseTo(0.5);
    expect(cuts()).toHaveLength(2);
    expect(cuts().every((e) => e.share !== undefined && e.share < 1)).toBe(true);
  });

  it('con potencia de corte completa las destruye antes de que exploten', () => {
    const { duel, caster, near, run } = arena();
    Object.assign(near, { x: 800, y: 270 });
    near.team = 'red';
    duel.spawnWave(caster, caster, 0, slash({ cut: 1, damage: 0, range: 400 }));
    duel.state.arrows.push(arrow(1), arrow(2, { y: 280, power: 1, skillId: 'mage.fireball', classId: 'mage' }));
    run(ticks(0.25));
    expect(duel.state.arrows).toHaveLength(0);
    expect(duel.state.events.some((e) => e.kind === 'explosion')).toBe(false);
    expect(duel.state.events.filter((e) => e.kind === 'projectileCut' && e.share === undefined)).toHaveLength(2);
    expect(caster.hp).toBe(CLASSES.vanguard.hp);
  });

  it('un tajo debilitado llega con menos daño, y no se corta dos veces con el mismo tajo', () => {
    const { duel, caster, near, run } = arena();
    near.team = 'red';
    Object.assign(near, { x: 800, y: 270 });
    caster.hp = caster.maxHp = 10;
    duel.spawnWave(caster, caster, 0, slash({ cut: 0.5, damage: 0, range: 120, speed: 120 }));
    duel.state.arrows.push(arrow(1, { x: 330, power: 1, skillId: 'mage.fireball', classId: 'mage' }));
    run(ticks(0.6));
    // The orb was worth 2.5 at full power: half of it arrives.
    expect(10 - caster.hp).toBeCloseTo(1.25);
  });

  it('un tajo cortante abre un hueco en el tajo enemigo: quien queda detrás del corte se salva', () => {
    const { duel, caster, near, far, run } = arena('guardian', 'archer');
    far.team = near.team;
    // The big slash travels east from the caster; the knight's cut meets it half way, heading west.
    Object.assign(near, { x: 520, y: 270 });
    Object.assign(far, { x: 600, y: 270 });
    const third = duel.state.players[2];
    const big = duel.spawnWave(caster, caster, 0, slash({ halfWidth: 120, range: 700, damage: 3, speed: 300, resist: 1 }));
    duel.spawnWave(near, near, Math.PI, slash({ halfWidth: 30, range: 260, damage: 0, cut: 1, speed: 300, tint: 'violet' }));
    run(ticks(1.6));
    expect(big.gaps).toHaveLength(1);
    expect(big.gaps[0].strength).toBe(1);
    // Both stand in the lane the cut opened.
    expect(near.hp).toBe(10);
    expect(third.hp).toBe(10);
  });

  it('un tajo más resistente que el corte solo pierde una parte en el hueco', () => {
    const { duel, caster, near, run } = arena('guardian');
    Object.assign(near, { x: 520, y: 270 });
    duel.spawnWave(caster, caster, 0, slash({ halfWidth: 120, range: 700, damage: 4, speed: 300, resist: 2 }));
    duel.spawnWave(near, near, Math.PI, slash({ halfWidth: 30, range: 260, damage: 0, cut: 1, speed: 300 }));
    run(ticks(1.6));
    expect(10 - near.hp).toBeCloseTo(2);
  });

  it('el parry del guerrero devuelve el tajo con lo que traía, y más rápido', () => {
    const { duel, caster, near, run } = arena('vanguard');
    caster.hp = caster.maxHp = 10;
    // His guard up, facing the slash as it comes.
    near.counterLeft = 5;
    const facing: [string, Partial<Input>][] = [['near', { angle: Math.PI }]];
    const sent = slash({ damage: 2, falloff: [[0, 1], [1, 0.5]] });
    duel.spawnWave(caster, caster, 0, sent);
    run(ticks(0.2), facing);
    const back = duel.state.waves.find((w) => w.owner === 'near');
    expect(back).toMatchObject({ reflected: 1, team: near.team, speed: sent.speed * 1.25 });
    expect(duel.state.events.some((e) => e.kind === 'counter')).toBe(true);
    run(ticks(0.6), facing);
    expect(near.hp).toBe(10);
    // It left at 2 and had lost a little by the time it was turned.
    expect(10 - caster.hp).toBeGreaterThan(1.6);
    expect(10 - caster.hp).toBeLessThan(2);
  });

  it('el parry solo cubre el frente: de espaldas el tajo entra', () => {
    const { duel, caster, near, run } = arena('vanguard');
    near.counterLeft = 5;
    duel.spawnWave(caster, caster, 0, slash({ damage: 2, falloff: [[0, 1]] }));
    run(ticks(0.4), [['near', { angle: 0 }]]);
    expect(duel.state.waves.some((w) => w.owner === 'near')).toBe(false);
    expect(near.hp).toBe(8);
  });
});
