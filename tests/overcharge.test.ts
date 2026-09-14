import { describe, it, expect } from 'vitest';
import {
  Duel,
  CLASSES,
  RULES,
  idleInput,
  sanitizeInput,
  chargePower,
  countsTowardLimit,
  blocked,
  distance,
  projectileStats,
  type ClassId,
  type Input,
} from '@bandera/shared';
const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
function setup(classes: ClassId[]) {
  const d = new Duel();
  const players = classes.map((classId, i) => d.add(String(i), `P${i}`, classId));
  // Automatic zombies: these tests cover the abilities, not the guard circle or the cursor.
  for (const p of players) p.zombieAuto = true;
  d.state.phase = 'playing';
  return { d, players };
}
function run(d: Duel, count: number, inputs: Record<string, Partial<Input>> = {}) {
  for (let i = 0; i < count; i++)
    d.step(new Map(Object.entries(inputs).map(([id, options]) => [id, input(options)])));
}
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
describe('sobrecarga', () => {
  it('un toque conserva el daño y la recarga normales', () => {
    const { d, players: [m, v] } = setup(['mage', 'vanguard']);
    Object.assign(m, { x: 200, y: 270, angle: 0 });
    Object.assign(v, { x: 300, y: 270 });
    run(d, 1, { 0: { charge: true } });
    run(d, 1, { 0: { shot: true } });
    expect(d.state.arrows[0].power ?? 0).toBe(0);
    expect(m.shotCd).toBeCloseTo(RULES.shotCooldown);
    run(d, 8);
    expect(v.hp).toBe(4);
  });
  it('mantener carga y soltar lanza la gran bola de fuego con más daño y explosión', () => {
    const { d, players: [m, v, g] } = setup(['mage', 'vanguard', 'guardian']);
    Object.assign(m, { x: 200, y: 270, angle: 0 });
    Object.assign(v, { x: 320, y: 270 });
    Object.assign(g, { x: 320, y: 300 });
    run(d, ticks(RULES.overchargeTime) + 1, { 0: { charge: true } });
    expect(chargePower(m.shotCharge)).toBeCloseTo(1);
    run(d, 1, { 0: { shot: true } });
    expect(d.state.arrows[0].power).toBeCloseTo(1);
    run(d, 10);
    expect(v.hp).toBeCloseTo(5 - 2.5);
    expect(g.hp).toBeLessThan(3);
    expect(d.state.events.some((e) => e.kind === 'explosion')).toBe(true);
  });
  it('la bola de fuego cargada sale más rápido y cruza toda la arena', () => {
    const { d, players: [m, v] } = setup(['mage', 'vanguard']);
    Object.assign(m, { x: 60, y: 270, angle: 0 });
    Object.assign(v, { x: 880, y: 480 });
    run(d, ticks(RULES.overchargeTime) + 1, { 0: { charge: true } });
    run(d, 1, { 0: { shot: true } });
    const ball = d.state.arrows[0];
    expect(ball.x - 60).toBeGreaterThan((projectileStats('mage').speed / 30) * 1.5);
    let far = ball.x;
    for (let i = 0; i < 60 && d.state.arrows.length; i++) {
      run(d, 1);
      far = Math.max(far, d.state.arrows[0]?.x ?? far);
    }
    expect(far).toBeGreaterThan(880);
    expect(projectileStats('mage').life * projectileStats('mage').speed).toBeLessThan(880);
  });
  it('sin la habilidad lista no carga; el golpe cargado pega más fuerte y más lejos', () => {
    const waiting = setup(['mage', 'vanguard']);
    waiting.players[0].shotCd = 1;
    run(waiting.d, 10, { 0: { charge: true } });
    expect(waiting.players[0].shotCharge).toBe(0);
    const { d, players: [g, v] } = setup(['guardian', 'vanguard']);
    Object.assign(g, { x: 200, y: 270, angle: 0 });
    Object.assign(v, { x: 200 + CLASSES.guardian.meleeRange + 10, y: 270 });
    run(d, ticks(RULES.overchargeTime) + 1, { 0: { charge: true } });
    run(d, 1, { 0: { sword: true } });
    run(d, ticks(CLASSES.guardian.windup) + 2);
    expect(v.hp).toBeCloseTo(3);
    expect(d.state.events.some((e) => e.kind === 'sword' && (e.power ?? 0) > 0.9)).toBe(true);
  });
  it('el dash cargado recorre más distancia', () => {
    const tap = setup(['archer', 'guardian']);
    Object.assign(tap.players[0], { x: 100, y: 270, angle: 0 });
    run(tap.d, 1, { 0: { special: true } });
    run(tap.d, 1, { 0: { dash: true } });
    run(tap.d, 10);
    const full = setup(['archer', 'guardian']);
    Object.assign(full.players[0], { x: 100, y: 270, angle: 0 });
    run(full.d, ticks(RULES.overchargeTime) + 1, { 0: { special: true } });
    run(full.d, 1, { 0: { dash: true } });
    run(full.d, 10);
    expect(full.players[0].x - 100).toBeGreaterThan((tap.players[0].x - 100) * 1.5);
  });
  it('espacio cargado invoca un solo zombie con gorro que se cura e invoca cada 5 s fuera del tope', () => {
    const { d, players: [n, g] } = setup(['necromancer', 'guardian']);
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 880, y: 500 });
    const hats = () => d.state.zombies.filter((z) => z.kind === 'hat');
    run(d, ticks(0.6), { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    expect(hats()).toHaveLength(1);
    expect(countsTowardLimit(hats()[0])).toBe(false);
    expect(d.state.zombies).toHaveLength(1);
    run(d, ticks(RULES.summonCooldown) + 1);
    run(d, ticks(0.6), { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    expect(hats()).toHaveLength(1);
    expect(n.summonCd).toBe(0);
    const hat = hats()[0];
    d.damageZombie(hat, g.team, 2);
    run(d, ticks(RULES.hatHealEvery * 2) + 1);
    expect(hat.hp).toBeGreaterThan(RULES.hatHp - 2);
    const minions = new Set<string>();
    for (let i = 0; i < ticks(RULES.hatSpawnEvery * 3); i++) {
      run(d, 1);
      for (const z of d.state.zombies) if (z.kind === 'brute' && z.bonus) minions.add(z.id);
    }
    expect(minions.size).toBeGreaterThanOrEqual(3);
  });
  it('los zombies bonus no ocupan el tope de los normales', () => {
    const { d, players: [n, g] } = setup(['necromancer', 'guardian']);
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 880, y: 500 });
    run(d, ticks(0.6), { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    for (let i = 0; i < 3; i++) {
      run(d, ticks(RULES.summonCooldown) + 1);
      run(d, 1, { 0: { summon: true } });
    }
    expect(d.activeExecutions(n.id)).toBe(RULES.zombieExecutions);
    expect(d.state.zombies.filter((z) => z.execution !== null)).toHaveLength(2 * RULES.zombieExecutions);
    expect(d.state.zombies.filter(countsTowardLimit).length).toBeGreaterThan(0);
    expect(d.state.zombies.some((z) => z.kind === 'hat')).toBe(true);
  });
  it('el gorro lanza fuego y hielo con los dos brazos y el hielo congela', () => {
    const { d, players: [n, g] } = setup(['necromancer', 'archer']);
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 360, y: 270 });
    run(d, ticks(0.6), { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    let spell = d.state.arrows.filter((a) => a.element);
    for (let i = 0; i < 90 && spell.length < 2; i++) {
      run(d, 1);
      spell = d.state.arrows.filter((a) => a.element);
    }
    expect(spell.map((a) => a.element).sort()).toEqual(['fire', 'ice']);
    expect(spell.every((a) => a.damageScale === RULES.spellDamage)).toBe(true);
    for (let i = 0; i < 40 && g.frozenLeft === 0; i++) run(d, 1);
    expect(g.frozenLeft).toBeGreaterThan(0);
    expect(g.hp).toBe(3 - RULES.spellDamage);
    const x = g.x;
    run(d, 3, { 1: { x: -1 } });
    expect(g.x).toBe(x);
  });
  it('el escudo que bloquea el hielo evita el congelamiento y un zombie congelado no avanza', () => {
    const { d, players: [n, g] } = setup(['necromancer', 'guardian']);
    Object.assign(n, { x: 150, y: 270, angle: 0 });
    Object.assign(g, { x: 400, y: 270, angle: Math.PI });
    d.state.arrows.push({
      id: 900,
      owner: n.id,
      team: n.team,
      classId: 'necromancer',
      x: 350,
      y: 270,
      angle: 0,
      life: 1,
      element: 'ice',
      damageScale: RULES.spellDamage,
    });
    run(d, 6, { 1: { guard: true, angle: Math.PI } });
    expect(g.frozenLeft).toBe(0);
    expect(g.hp).toBe(3);
    run(d, 1, { 0: { summon: true } });
    const zombie = d.state.zombies[0];
    zombie.frozenLeft = 1;
    const at = { x: zombie.x, y: zombie.y };
    run(d, 10);
    expect({ x: zombie.x, y: zombie.y }).toEqual(at);
  });
  it('con el aura llena, sin zombies y junto a un muerto, lo resucita como esclavo de su clase', () => {
    const { d, players: [n, v, a] } = setup(['necromancer', 'vanguard', 'archer']);
    Object.assign(n, { x: 300, y: 270, angle: 0 });
    Object.assign(v, { x: 450, y: 270 });
    Object.assign(a, { x: 880, y: 500 });
    v.invuln = 0;
    d.damage(v, a, 0, 99);
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    const thrall = d.state.zombies.find((z) => z.kind === 'thrall');
    expect(thrall).toMatchObject({ classId: 'vanguard', name: v.name, bonus: true, hp: CLASSES.vanguard.hp });
    expect(n.thrall).toMatchObject({ classId: 'vanguard', name: v.name });
    run(d, ticks(RULES.respawn));
    expect(v.hp).toBe(CLASSES.vanguard.hp);
  });
  it('con el muerto lejos sale el gorro; el esclavo es único y se reinvoca tras 20 s', () => {
    const far = setup(['necromancer', 'vanguard', 'archer']);
    Object.assign(far.players[0], { x: 200, y: 270, angle: 0 });
    Object.assign(far.players[1], { x: 520, y: 270 });
    Object.assign(far.players[2], { x: 880, y: 500 });
    far.players[1].invuln = 0;
    far.d.damage(far.players[1], far.players[2], 0, 99);
    run(far.d, ticks(RULES.raiseCharge) + 1, { 0: { special: true } });
    run(far.d, 1, { 0: { summon: true } });
    expect(far.d.state.zombies.map((z) => z.kind)).toEqual(['hat']);
    const { d, players: [n, v, a] } = setup(['necromancer', 'guardian', 'archer']);
    Object.assign(n, { x: 300, y: 270, angle: 0 });
    Object.assign(v, { x: 420, y: 270 });
    Object.assign(a, { x: 880, y: 500 });
    v.invuln = 0;
    d.damage(v, a, 0, 99);
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    run(d, ticks(RULES.summonCooldown) + 1);
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies.filter((z) => z.kind === 'thrall')).toHaveLength(1);
    for (const z of d.state.zombies) d.damageZombie(z, a.team, 99);
    run(d, 1);
    expect(n.thrallCd).toBeGreaterThan(RULES.thrallCooldown - 0.1);
    run(d, ticks(RULES.thrallCooldown) + 1);
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies.find((z) => z.kind === 'thrall')).toMatchObject({ classId: 'guardian' });
  });
  it('el esclavo ataca con su clase y el daño se acredita al nigromante', () => {
    const { d, players: [n, v, a] } = setup(['necromancer', 'vanguard', 'archer']);
    Object.assign(n, { x: 300, y: 270, angle: 0 });
    Object.assign(v, { x: 420, y: 270 });
    Object.assign(a, { x: 880, y: 500 });
    v.invuln = 0;
    d.damage(v, a, 0, 99);
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    const thrall = d.state.zombies.find((z) => z.kind === 'thrall')!;
    Object.assign(a, { x: thrall.x + 60, y: thrall.y, hp: 3, invuln: 0 });
    for (let i = 0; i < 90 && a.hp === 3; i++) run(d, 1);
    expect(a.hp).toBe(3 - CLASSES.vanguard.meleeDamage);
    expect(d.state.events.some((e) => e.kind === 'hit' && e.team === n.team)).toBe(true);
  });
  it('la tumba deja resucitar aunque el muerto ya reapareció y con otros zombies vivos', () => {
    const { d, players: [n, v, a] } = setup(['necromancer', 'vanguard', 'archer']);
    Object.assign(n, { x: 300, y: 270, angle: 0 });
    Object.assign(v, { x: 450, y: 270 });
    Object.assign(a, { x: 880, y: 500 });
    run(d, 1, { 0: { summon: true } });
    v.invuln = 0;
    d.damage(v, a, 0, 99);
    expect(d.state.graves).toMatchObject([{ classId: 'vanguard', name: v.name }]);
    run(d, ticks(RULES.summonCooldown));
    expect(v.hp).toBeGreaterThan(0);
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true } });
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies.find((z) => z.kind === 'thrall')).toMatchObject({ classId: 'vanguard', role: 'cursor' });
    expect(d.state.zombies.some((z) => z.execution !== null)).toBe(true);
    expect(d.state.graves).toHaveLength(0);
  });
  it('el mandala se abre bajo el mouse dentro del alcance y levanta ahí al caído', () => {
    const { d, players: [n, v, a] } = setup(['necromancer', 'vanguard', 'archer']);
    Object.assign(n, { x: 300, y: 270, angle: 0 });
    Object.assign(v, { x: 450, y: 270 });
    Object.assign(a, { x: 880, y: 500 });
    v.invuln = 0;
    d.damage(v, a, 0, 99);
    const aim = { aimX: 380, aimY: 230 };
    expect(blocked(380, 230, RULES.zombieRadius)).toBe(false);
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true, ...aim } });
    run(d, 1, { 0: { summon: true, ...aim } });
    const thrall = d.state.zombies.find((z) => z.kind === 'thrall')!;
    expect(thrall).toMatchObject({ classId: 'vanguard', role: 'cursor' });
    expect(distance(thrall, { x: 380, y: 230 })).toBeLessThan(1);
    expect(thrall.rise).toBeGreaterThan(0);
    const x = thrall.x;
    run(d, 5, { 0: aim });
    expect(thrall.x).toBe(x);
    for (const z of d.state.zombies) d.damageZombie(z, a.team, 99);
    run(d, ticks(RULES.thrallCooldown) + 1);
    const far = { aimX: 900, aimY: 270 };
    run(d, ticks(RULES.raiseCharge) + 1, { 0: { special: true, ...far } });
    run(d, 1, { 0: { summon: true, ...far } });
    const recalled = d.state.zombies.find((z) => z.kind === 'thrall')!;
    expect(distance(recalled, n)).toBeLessThanOrEqual(RULES.raiseRange + 1);
    expect(recalled.x).toBeGreaterThan(n.x + 100);
  });
  it('la tumba se deshace a los 10 s', () => {
    const { d, players: [, v, a] } = setup(['necromancer', 'vanguard', 'archer']);
    v.invuln = 0;
    d.damage(v, a, 0, 99);
    run(d, ticks(RULES.graveLife) - 2);
    expect(d.state.graves).toHaveLength(1);
    run(d, 3);
    expect(d.state.graves).toHaveLength(0);
  });
  it('las entradas mantenidas se validan', () => {
    expect(sanitizeInput({ ...idleInput(), special: 'sí', charge: 1 })).toMatchObject({ special: false, charge: false });
    expect(sanitizeInput({ ...idleInput(), special: true, power: 99 })).not.toHaveProperty('power');
  });
});
