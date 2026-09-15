import { describe, it, expect } from 'vitest';
import { Duel, CLASSES, RULES, idleInput, sanitizeInput, type Input } from '@bandera/shared';
const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
function setup() {
  const d = new Duel();
  const k = d.add('k', 'K', 'guardian'),
    a = d.add('a', 'A', 'archer');
  d.state.phase = 'playing';
  Object.assign(k, { x: 400, y: 270, angle: Math.PI });
  Object.assign(a, { x: 200, y: 270, angle: 0 });
  return { d, k, a };
}
function run(d: Duel, count: number, knight: Partial<Input> = {}, archer: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    d.step(new Map([['k', input(knight)], ['a', input(archer)]]));
}
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
describe('caballero', () => {
  it('esquiva con espacio y el dash cargado dura más', () => {
    expect(CLASSES.guardian.dash).toBe(true);
    const tap = setup();
    run(tap.d, 1, { dash: true, x: 1 });
    expect(tap.k.dashLeft).toBeGreaterThan(0);
    expect(tap.k.dashCd).toBeGreaterThan(0);
    const held = setup();
    run(held.d, ticks(RULES.overchargeTime) + 1, { special: true });
    run(held.d, 1, { dash: true, x: 1 });
    expect(held.k.dashLeft).toBeGreaterThan(tap.k.dashLeft + 0.05);
  });
  it('Q devuelve la flecha al arquero con el mismo daño', () => {
    const { d, k, a } = setup();
    run(d, 1, { counter: true }, { shot: true });
    run(d, 12, { counter: true });
    expect(d.state.arrows[0]).toMatchObject({ owner: 'k', team: k.team, reflected: 1 });
    run(d, 20, { counter: true });
    expect(k.hp).toBe(CLASSES.guardian.hp);
    expect(a.hp).toBe(CLASSES.archer.hp - RULES.arrowDamage);
    expect(d.state.events.some((e) => e.kind === 'counter')).toBe(true);
  });
  it('mantenido hasta cargar, la devuelve al doble de velocidad y daño', () => {
    const { d, a } = setup();
    run(d, ticks(RULES.counterChargeTime) + 1, { counter: true });
    run(d, 1, { counter: true }, { shot: true });
    run(d, 11, { counter: true });
    expect(d.state.arrows[0]).toMatchObject({ owner: 'k', reflected: 2, damageScale: RULES.counterBoost });
    run(d, 15, { counter: true });
    expect(a.hp).toBe(CLASSES.archer.hp - RULES.counterBoost * RULES.arrowDamage);
  });
  it('al soltar dura un instante y entra en recarga; sin contraataque recibe el golpe', () => {
    const { d, k, a } = setup();
    run(d, 3, { counter: true });
    run(d, ticks(RULES.counterWindow) + 1);
    expect(k.counterLeft).toBe(0);
    expect(k.counterCd).toBeGreaterThan(RULES.counterCooldown - 0.2);
    run(d, 1, { counter: true }, { shot: true });
    run(d, 15, { counter: true });
    expect(k.hp).toBe(CLASSES.guardian.hp - RULES.arrowDamage);
    expect(a.hp).toBe(CLASSES.archer.hp);
  });
  it('mantener más del máximo lo termina y hay que soltar Q para volver a usarlo', () => {
    const { d, k } = setup();
    run(d, ticks(RULES.counterMaxHold + RULES.counterWindow) + 2, { counter: true });
    expect(k.counterLeft).toBe(0);
    expect(k.counterCd).toBeGreaterThan(0);
    k.counterCd = 0;
    run(d, 3, { counter: true });
    expect(k.counterLeft).toBe(0);
    run(d, 1);
    run(d, 1, { counter: true });
    expect(k.counterLeft).toBeGreaterThan(0);
  });
  it('solo el caballero contraataca y la entrada se valida', () => {
    const { d, a } = setup();
    run(d, 5, {}, { counter: true });
    expect(a.counterLeft).toBe(0);
    expect(sanitizeInput({ ...idleInput(), counter: 'sí' })).toMatchObject({ counter: false });
  });
});
