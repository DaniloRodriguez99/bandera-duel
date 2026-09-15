import { describe, it, expect } from 'vitest';
import { Duel, CLASSES, RULES, idleInput, sanitizeInput, projectileStats, type Input } from '@bandera/shared';
const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
function setup() {
  const d = new Duel('courtyard', 'ffa3');
  const w = d.add('w', 'W', 'vanguard'),
    g = d.add('g', 'G', 'guardian'),
    a = d.add('a', 'A', 'archer');
  d.state.phase = 'playing';
  Object.assign(w, { x: 200, y: 270, angle: 0 });
  Object.assign(g, { x: 880, y: 500 });
  Object.assign(a, { x: 880, y: 100 });
  return { d, w, g, a };
}
function run(d: Duel, count: number, warrior: Partial<Input> = {}) {
  for (let i = 0; i < count; i++) d.step(new Map([['w', input(warrior)]]));
}
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
/** Warrior facing an archer 200 px away. */
function duel() {
  const d = new Duel();
  const w = d.add('w', 'W', 'vanguard'),
    a = d.add('a', 'A', 'archer');
  d.state.phase = 'playing';
  Object.assign(w, { x: 400, y: 270, angle: Math.PI });
  Object.assign(a, { x: 200, y: 270, angle: 0 });
  return { d, w, a };
}
function clash(d: Duel, count: number, warrior: Partial<Input> = {}, archer: Partial<Input> = {}) {
  for (let i = 0; i < count; i++) d.step(new Map([['w', input(warrior)], ['a', input(archer)]]));
}
describe('guerrero', () => {
  it('esquiva con espacio con un dash más corto y camina más lento que antes', () => {
    expect(CLASSES.vanguard.dash).toBe(true);
    expect(CLASSES.guardian.dash).toBe(true);
    expect(CLASSES.vanguard.speed).toBeLessThan(155);
    expect(CLASSES.vanguard.speed).toBeGreaterThan(RULES.zombieSpeed);
    const { d, w } = setup();
    run(d, 1, { dash: true, x: 1 });
    expect(w.dashCd).toBeGreaterThan(0);
    expect(w.dashLeft).toBeCloseTo(RULES.dashDuration * RULES.vanguardDash - RULES.tick);
  });
  it('Q lanza un tajo que viaja y corta a todos los rivales en su camino', () => {
    const { d, w, g, a } = setup();
    Object.assign(g, { x: 260, y: 270, invuln: 0 });
    Object.assign(a, { x: 330, y: 280, invuln: 0 });
    run(d, 1, { slash: true });
    expect(d.state.arrows).toHaveLength(1);
    expect(d.state.arrows[0]).toMatchObject({ slash: true, classId: 'vanguard' });
    expect(w.slashCd).toBeGreaterThan(RULES.slashCooldown - 0.1);
    run(d, 20);
    expect(g.hp).toBe(CLASSES.guardian.hp - RULES.slashDamage);
    expect(a.hp).toBe(CLASSES.archer.hp - RULES.slashDamage);
  });
  it('el tajo tiene alcance corto y recarga', () => {
    const { d, g } = setup();
    Object.assign(g, { x: 200 + RULES.slashSpeed * RULES.slashLife + 80, y: 270, invuln: 0 });
    run(d, 1, { slash: true });
    run(d, ticks(RULES.slashLife) + 5);
    expect(d.state.arrows).toHaveLength(0);
    expect(g.hp).toBe(CLASSES.guardian.hp);
    run(d, 1, { slash: true });
    expect(d.state.arrows).toHaveLength(0);
  });
  it('solo el guerrero usa el tajo y la entrada se valida', () => {
    const { d } = setup();
    d.step(new Map([['g', input({ slash: true })]]));
    expect(d.state.arrows).toHaveLength(0);
    expect(sanitizeInput({ ...idleInput(), slash: 'sí' })).toMatchObject({ slash: false });
    expect(projectileStats('vanguard').radius).toBeGreaterThan(projectileStats('archer').radius);
  });
  it('E devuelve la flecha al arquero con el mismo daño', () => {
    const { d, w, a } = duel();
    clash(d, 1, { counter: true }, { shot: true });
    clash(d, 12, { counter: true });
    expect(d.state.arrows[0]).toMatchObject({ owner: 'w', team: w.team, reflected: 1 });
    clash(d, 20, { counter: true });
    expect(w.hp).toBe(CLASSES.vanguard.hp);
    expect(a.hp).toBe(CLASSES.archer.hp - RULES.arrowDamage);
    expect(d.state.events.some((e) => e.kind === 'counter')).toBe(true);
  });
  it('E mantenido hasta cargar devuelve al doble de velocidad y daño', () => {
    const { d, a } = duel();
    clash(d, ticks(RULES.counterChargeTime) + 1, { counter: true });
    clash(d, 1, { counter: true }, { shot: true });
    clash(d, 11, { counter: true });
    expect(d.state.arrows[0]).toMatchObject({ owner: 'w', reflected: 2, damageScale: RULES.counterBoost });
    clash(d, 15, { counter: true });
    expect(a.hp).toBe(CLASSES.archer.hp - RULES.counterBoost * RULES.arrowDamage);
  });
  it('al soltar E dura un instante y entra en recarga; sin contraataque recibe el golpe', () => {
    const { d, w, a } = duel();
    clash(d, 3, { counter: true });
    clash(d, ticks(RULES.counterWindow) + 1);
    expect(w.counterLeft).toBe(0);
    expect(w.counterCd).toBeGreaterThan(RULES.counterCooldown - 0.2);
    clash(d, 1, { counter: true }, { shot: true });
    clash(d, 15, { counter: true });
    expect(w.hp).toBe(CLASSES.vanguard.hp - RULES.arrowDamage);
    expect(a.hp).toBe(CLASSES.archer.hp);
  });
  it('mantener E más del máximo lo termina y hay que soltar para volver a usarlo', () => {
    const { d, w } = duel();
    clash(d, ticks(RULES.counterMaxHold + RULES.counterWindow) + 2, { counter: true });
    expect(w.counterLeft).toBe(0);
    expect(w.counterCd).toBeGreaterThan(0);
    w.counterCd = 0;
    clash(d, 3, { counter: true });
    expect(w.counterLeft).toBe(0);
    clash(d, 1);
    clash(d, 1, { counter: true });
    expect(w.counterLeft).toBeGreaterThan(0);
  });
  it('solo el guerrero contraataca y la entrada se valida', () => {
    const { d, a } = duel();
    clash(d, 5, {}, { counter: true });
    expect(a.counterLeft).toBe(0);
    expect(sanitizeInput({ ...idleInput(), counter: 'sí' })).toMatchObject({ counter: false });
  });
});
