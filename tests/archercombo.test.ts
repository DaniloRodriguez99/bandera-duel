import { describe, it, expect } from 'vitest';
import { Duel, CLASSES, RULES, idleInput, projectileStats, type Input } from '@bandera/shared';
const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
function setup() {
  const d = new Duel();
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
  it('clic y espacio al máximo avanzando hacia el tiro: flecha de viento que atraviesa y rompe el escudo', () => {
    const { d, a, g, v } = setup();
    Object.assign(g, { x: 320, y: 270 });
    Object.assign(v, { x: 440, y: 270 });
    run(d, ticks(RULES.overchargeTime), { charge: true, special: true });
    Object.assign(g, { guarding: true, guardLeft: 1, guardHeld: true, angle: Math.PI });
    run(d, 1, { shot: true, special: true, x: 1 }, { guard: true, angle: Math.PI });
    const [arrow] = d.state.arrows;
    expect(arrow).toMatchObject({ wind: true, charged: true });
    expect(a.dashCd).toBeGreaterThan(0);
    expect(a.specialCharge).toBe(0);
    run(d, 12, {}, { guard: true, angle: Math.PI });
    expect(g.guarding).toBe(false);
    expect(g.hp).toBeCloseTo(CLASSES.guardian.hp - WIND);
    expect(v.hp).toBeCloseTo(Math.max(0, CLASSES.vanguard.hp - WIND));
  });
  it('sin avanzar hacia el tiro sale la flecha cargada normal', () => {
    const { d } = setup();
    run(d, ticks(RULES.overchargeTime), { charge: true, special: true });
    run(d, 1, { shot: true, special: true, x: -1 });
    expect(d.state.arrows[0]).toMatchObject({ charged: true });
    expect(d.state.arrows[0].wind).toBeUndefined();
  });
  it('combinado con E: 3 flechas de viento más débiles que juntas hacen el 120 %', () => {
    const { d, g } = setup();
    Object.assign(g, { x: 330, y: 270, hp: 10 });
    run(d, ticks(RULES.overchargeTime), { charge: true, special: true });
    run(d, 1, { volley: true, special: true, x: 1 });
    expect(d.state.arrows).toHaveLength(3);
    expect(d.state.arrows.every((arrow) => arrow.wind)).toBe(true);
    expect(RULES.windVolleyScale).toBeLessThan(RULES.windScale);
    run(d, 12);
    expect(10 - g.hp).toBeCloseTo(1.2 * WIND);
  });
});
