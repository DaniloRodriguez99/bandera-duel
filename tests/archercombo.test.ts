import { describe, it, expect } from 'vitest';
import { Duel, CLASSES, RULES, idleInput, projectileStats, type Input } from '@bandera/shared';
const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
function setup() {
  const d = new Duel('courtyard', 'ffa3');
  const a = d.add('a', 'A', 'archer'),
    g = d.add('b', 'B', 'guardian'),
    v = d.add('c', 'C', 'vanguard');
  d.state.phase = 'playing';
  Object.assign(a, { x: 200, y: 270, angle: 0 });
  Object.assign(g, { x: 880, y: 500 });
  Object.assign(v, { x: 880, y: 100 });
  return { d, a, g, v };
}
function run(d: Duel, count: number, archer: Partial<Input> = {}, guardian: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    d.step(new Map([['a', input(archer)], ['b', input(guardian)]]));
}
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick) + 1;
const WIND = RULES.arrowDamage * RULES.chargeMultiplier * RULES.windScale;
describe('combos del arquero', () => {
  it('la triple sale casi en fila: pasa por un rival ya alcanzado y llega al siguiente', () => {
    const { d, a, g, v } = setup();
    Object.assign(g, { x: 290, y: 270 });
    Object.assign(v, { x: 360, y: 270 });
    run(d, 1, { volley: true });
    run(d, 12);
    expect(g.hp).toBe(CLASSES.guardian.hp - RULES.arrowDamage);
    expect(v.hp).toBe(CLASSES.vanguard.hp - RULES.arrowDamage);
    expect(a.volleyCd).toBeGreaterThan(0);
  });
  it('con el tiro cargando, E lanza 3 flechas potenciadas al 33 %', () => {
    const { d } = setup();
    run(d, ticks(0.4), { charge: true });
    run(d, 1, { volley: true });
    expect(d.state.arrows).toHaveLength(3);
    for (const arrow of d.state.arrows) {
      expect(arrow.charged).toBe(false);
      expect(arrow.power).toBeCloseTo(1 / 3);
    }
    expect(projectileStats('archer', false, 1 / 3).damage).toBeCloseTo(1 + (RULES.chargeMultiplier - 1) / 3);
  });
  it('salto cargado: el tiro cargado soltado en pleno salto sale de viento hacia el mouse y rompe escudos', () => {
    const { d, a, g, v } = setup();
    run(d, ticks(RULES.overchargeTime), { charge: true, special: true });
    run(d, 1, { dash: true, charge: true, x: 1 });
    expect(a.windDash).toBeGreaterThan(0);
    expect(a.shotCharge).toBeCloseTo(RULES.chargeTime);
    Object.assign(g, { x: a.x + 130, y: a.y, guarding: true, guardLeft: 1, guardHeld: true, angle: Math.PI });
    Object.assign(v, { x: a.x + 250, y: a.y });
    const zombie = { ...d.state.players[0], x: a.x + 190, y: a.y };
    d.state.zombies.push({
      id: 'z-test', owner: 'nadie', team: v.team, x: zombie.x, y: zombie.y, hp: 9, maxHp: 9, angle: 0, windup: 0,
      attackCd: 0, life: 99, target: null, retarget: 99, kind: 'brute', bonus: true, cast: 0, castCd: 0, healCd: 99,
      spawnLeft: 99, frozenLeft: 0, execution: null, slot: 0, rise: 99, role: 'guard',
    });
    run(d, 1, { shot: true, x: 1 }, { guard: true, angle: Math.PI });
    const [arrow] = d.state.arrows;
    expect(arrow).toMatchObject({ wind: true, charged: true });
    expect(arrow.angle).toBeCloseTo(0);
    expect(a.windDash).toBe(0);
    run(d, 14, {}, { guard: true, angle: Math.PI });
    expect(g.guarding).toBe(false);
    expect(g.hp).toBeCloseTo(CLASSES.guardian.hp - WIND);
    expect(v.hp).toBeCloseTo(Math.max(0, CLASSES.vanguard.hp - WIND));
    // It pierces everything in its path, zombies included.
    expect(d.state.zombies.find((z) => z.id === 'z-test')?.hp).toBeCloseTo(9 - WIND);
  });
  it('sin saltar, soltar con clic y espacio llenos da la flecha cargada normal', () => {
    const { d } = setup();
    run(d, ticks(RULES.overchargeTime), { charge: true, special: true });
    run(d, 1, { shot: true, special: true, x: 1 });
    expect(d.state.arrows[0]).toMatchObject({ charged: true });
    expect(d.state.arrows[0].wind).toBeUndefined();
  });
  it('E en pleno salto cargado: triple hacia el mouse aunque se salte en otra dirección', () => {
    const { d } = setup();
    run(d, ticks(RULES.overchargeTime), { special: true });
    run(d, 1, { dash: true, y: 1 });
    run(d, 1, { volley: true, y: 1 });
    const angles = d.state.arrows.map((arrow) => arrow.angle);
    [-RULES.volleyAngle, 0, RULES.volleyAngle].forEach((angle, i) => expect(angles[i]).toBeCloseTo(angle));
    expect(d.state.arrows.every((arrow) => !arrow.wind && !arrow.power)).toBe(true);
  });
  it('salto cargado a la cara del rival con el clic lleno y E: 3 flechas de viento que a quemarropa suman el 120 %', () => {
    const { d, a, g } = setup();
    run(d, ticks(RULES.overchargeTime), { charge: true, special: true });
    run(d, 1, { dash: true, charge: true, x: 1 });
    // E pressed a moment after landing, still inside the combo window, right in the rival's face.
    run(d, ticks(0.5), { charge: true });
    expect(a.windDash).toBeGreaterThan(0);
    Object.assign(g, { x: a.x + 60, y: a.y, hp: 10 });
    run(d, 1, { volley: true });
    const arrows = d.state.arrows;
    expect(arrows).toHaveLength(3);
    expect(arrows.every((arrow) => arrow.wind)).toBe(true);
    [-RULES.volleyAngle, 0, RULES.volleyAngle].forEach((angle, i) => expect(arrows[i].angle).toBeCloseTo(angle));
    expect(RULES.windVolleyScale).toBeLessThan(RULES.windScale);
    run(d, 20);
    expect(10 - g.hp).toBeCloseTo(1.2 * WIND);
  });
  it('un salto no cargado no permite tirar en el aire', () => {
    const { d, a } = setup();
    run(d, ticks(RULES.chargeTime), { charge: true });
    run(d, 1, { dash: true, charge: true, x: 1 });
    expect(a.windDash).toBe(0);
    run(d, 1, { shot: true, x: 1 });
    expect(d.state.arrows).toHaveLength(0);
  });
});
