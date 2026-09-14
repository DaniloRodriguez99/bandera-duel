import { describe, it, expect } from 'vitest';
import {
  Duel,
  CLASSES,
  CLASS_IDS,
  RULES,
  idleInput,
  sanitizeInput,
  findPath,
  pathCells,
  blocked,
  distance,
  type ClassId,
  type Input,
} from '@bandera/shared';
const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
function setup(classes: ClassId[] = ['necromancer', 'guardian']) {
  const d = new Duel();
  const players = classes.map((classId, i) => d.add(String(i), `P${i}`, classId));
  d.state.phase = 'playing';
  return { d, players };
}
function run(d: Duel, count: number, inputs: Record<string, Partial<Input>> = {}) {
  for (let i = 0; i < count; i++)
    d.step(new Map(Object.entries(inputs).map(([id, options]) => [id, input(options)])));
}
describe('nigromante', () => {
  it('lanza fuego con velocidad, vida y recarga propias', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 200, y: 470 });
    run(d, 1, { 0: { shot: true } });
    const fire = d.state.arrows[0];
    expect(fire.classId).toBe('necromancer');
    expect(fire.x - 200).toBeCloseTo(RULES.fireSpeed / 30);
    expect(n.shotCd).toBeCloseTo(RULES.fireCooldown);
    run(d, 30);
    expect(d.state.arrows).toHaveLength(1);
    run(d, 10);
    expect(d.state.arrows).toHaveLength(0);
  });
  it('el fuego daña, lo frenan los muros y lo bloquea el escudo', () => {
    const hit = setup();
    Object.assign(hit.players[0], { x: 200, y: 270, angle: 0 });
    Object.assign(hit.players[1], { x: 300, y: 270 });
    run(hit.d, 1, { 0: { shot: true } });
    run(hit.d, 10);
    expect(hit.players[1].hp).toBe(2);
    const wall = setup();
    Object.assign(wall.players[0], { x: 200, y: 150, angle: 0 });
    Object.assign(wall.players[1], { x: 330, y: 150 });
    run(wall.d, 1, { 0: { shot: true } });
    run(wall.d, 12);
    expect(wall.players[1].hp).toBe(3);
    expect(wall.d.state.arrows).toHaveLength(0);
    const shield = setup();
    Object.assign(shield.players[0], { x: 200, y: 270, angle: 0 });
    Object.assign(shield.players[1], { x: 300, y: 270, angle: Math.PI });
    run(shield.d, 1, { 0: { shot: true }, 1: { guard: true, angle: Math.PI } });
    run(shield.d, 10, { 1: { guard: true, angle: Math.PI } });
    expect(shield.players[1].hp).toBe(3);
    expect(shield.d.state.events.some((e) => e.kind === 'block')).toBe(true);
  });
  it('no usa espada, escudo ni dash, y las demás clases no invocan', () => {
    const { d, players: [n] } = setup();
    run(d, 1, { 0: { sword: true, guard: true, dash: true } });
    expect(n.windup).toBe(0);
    expect(n.guarding).toBe(false);
    expect(n.dashCd).toBe(0);
    for (const classId of CLASS_IDS.filter((id) => !CLASSES[id].summon)) {
      const other = setup([classId, 'guardian']);
      run(other.d, 1, { 0: { summon: true } });
      expect(other.d.state.zombies).toHaveLength(0);
    }
    expect(sanitizeInput({ ...idleInput(), summon: 'sí' })?.summon).toBe(false);
    expect(sanitizeInput({ ...idleInput(), summon: true })?.summon).toBe(true);
  });
  it('cada ejecución invoca 2 zombies y hay como máximo 2 ejecuciones activas', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(g, { x: 880, y: 500 });
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies).toHaveLength(2);
    expect(new Set(d.state.zombies.map((z) => z.execution)).size).toBe(1);
    expect(d.state.zombies.every((z) => z.owner === n.id && z.team === n.team)).toBe(true);
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies).toHaveLength(2);
    expect(n.summonCd).toBeGreaterThan(4.9);
    run(d, Math.ceil(RULES.summonCooldown / RULES.tick));
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies).toHaveLength(4);
    expect(n.activeExecutions).toBe(2);
    run(d, Math.ceil(RULES.summonCooldown / RULES.tick));
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies).toHaveLength(4);
    expect(n.summonCd).toBe(0);
  });
  it('terminar una ejecución libera su lugar y los zombies sin ejecución no cuentan', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(g, { x: 880, y: 500 });
    run(d, 1, { 0: { summon: true } });
    run(d, Math.ceil(RULES.summonCooldown / RULES.tick));
    run(d, 1, { 0: { summon: true } });
    const first = d.state.zombies[0].execution;
    for (const z of d.state.zombies.filter((z) => z.execution === first)) d.damageZombie(z, g.team, 99);
    run(d, 1);
    expect(n.activeExecutions).toBe(1);
    run(d, Math.ceil(RULES.summonCooldown / RULES.tick));
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies).toHaveLength(4);
    d.state.zombies.push({ ...d.state.zombies[0], id: 'extra', execution: null, slot: 3 });
    run(d, 1);
    expect(n.activeExecutions).toBe(2);
    expect(d.activeExecutions(n.id)).toBe(2);
  });
  it('los zombies van al rival marcado con el cursor aunque otro esté igual de cerca', () => {
    const { d, players: [n, a, b] } = setup(['necromancer', 'guardian', 'vanguard']);
    Object.assign(n, { x: 480, y: 100, angle: 0 });
    Object.assign(a, { x: 330, y: 80 });
    Object.assign(b, { x: 630, y: 80 });
    run(d, 1, { 0: { summon: true, aimX: 640, aimY: 90 } });
    run(d, 3, { 0: { aimX: 640, aimY: 90 } });
    expect(d.state.zombies.map((z) => z.target)).toEqual([b.id, b.id]);
  });
  it('sin rival cerca del cursor, los zombies caminan hacia esa zona', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 880, y: 500 });
    run(d, 1, { 0: { summon: true, aimX: 420, aimY: 270 } });
    run(d, 70, { 0: { aimX: 420, aimY: 270 } });
    for (const z of d.state.zombies) expect(distance(z, { x: 420, y: 270 })).toBeLessThan(90);
  });
  it('dos ejecuciones rodean al rival marcado desde varios lados en vez de hacer fila', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 480, y: 470, angle: -Math.PI / 2 });
    Object.assign(g, { x: 480, y: 270, invuln: 999 });
    const aim = { aimX: 480, aimY: 270 };
    run(d, 1, { 0: { summon: true, ...aim } });
    Object.assign(n, { summonCd: 0, attackLock: 0 });
    run(d, 1, { 0: { summon: true, ...aim } });
    expect(d.state.zombies).toHaveLength(4);
    let closest = Infinity;
    for (let i = 0; i < 120 && closest > 30; i++) {
      run(d, 1, { 0: aim });
      closest = Math.max(...d.state.zombies.map((z) => distance(z, g)));
    }
    expect(d.state.zombies.every((z) => z.target === g.id && distance(z, g) < 60)).toBe(true);
    const bearings = d.state.zombies.map((z) => Math.atan2(z.y - g.y, z.x - g.x)).sort((a, b) => a - b);
    const gaps = bearings.map((b, i) => (i ? b - bearings[i - 1] : b + 2 * Math.PI - bearings.at(-1)!));
    expect(2 * Math.PI - Math.max(...gaps)).toBeGreaterThan((150 * Math.PI) / 180);
  });
  it('en una zona vacía cada zombie ocupa su propio lugar alrededor del cursor', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 880, y: 500 });
    const aim = { aimX: 420, aimY: 270 };
    run(d, 1, { 0: { summon: true, ...aim } });
    Object.assign(n, { summonCd: 0, attackLock: 0 });
    run(d, 1, { 0: { summon: true, ...aim } });
    run(d, 90, { 0: aim });
    const zombies = d.state.zombies;
    expect(zombies).toHaveLength(4);
    for (const z of zombies) expect(distance(z, { x: 420, y: 270 })).toBeLessThan(90);
    for (let i = 0; i < zombies.length; i++)
      for (let j = i + 1; j < zombies.length; j++) expect(distance(zombies[i], zombies[j])).toBeGreaterThan(30);
  });
  it('salen del suelo escalonados y toman caminos distintos', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 880, y: 500 });
    run(d, 1, { 0: { summon: true } });
    const [first, second] = d.state.zombies;
    expect(second.rise).toBeGreaterThan(first.rise);
    const x = first.x;
    run(d, 5);
    expect(first.x).toBe(x);
    const over = findPath({ x: 200, y: 160 }, { x: 340, y: 160 });
    const around = findPath({ x: 200, y: 160 }, { x: 340, y: 160 }, pathCells(over));
    const shared = [...pathCells(around)].filter((cell) => pathCells(over).has(cell));
    expect(around.length).toBeGreaterThan(2);
    expect(shared.length).toBeLessThan(around.length / 2);
  });
  it('el cursor sobre un rival lejano lo marca en todo el mapa', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 200, y: 270, angle: 0 });
    Object.assign(g, { x: 880, y: 270 });
    run(d, 1, { 0: { summon: true, aimX: 880, aimY: 270 } });
    run(d, 60, { 0: { aimX: 880, aimY: 270 } });
    expect(d.state.zombies.every((z) => z.target === g.id && z.x > 300)).toBe(true);
  });
  it('valida el punto apuntado', () => {
    expect(sanitizeInput({ ...idleInput(), aimX: 9999, aimY: 20 })).toMatchObject({ aimX: RULES.width, aimY: 20 });
    expect(sanitizeInput({ ...idleInput(), aimX: 'x', aimY: -5 })).toMatchObject({ aimX: -1, aimY: -1 });
  });
  it('los zombies son más lentos que todas las clases', () => {
    expect(RULES.zombieSpeed).toBeLessThan(Math.min(...CLASS_IDS.map((id) => CLASSES[id].speed)));
  });
  it('cada zombie elige su objetivo cercano y se separan ante dos rivales', () => {
    const { d, players: [n, a, b] } = setup(['necromancer', 'guardian', 'vanguard']);
    Object.assign(n, { x: 480, y: 100, angle: 0 });
    Object.assign(a, { x: 330, y: 80 });
    Object.assign(b, { x: 630, y: 80 });
    run(d, 1, { 0: { summon: true } });
    run(d, 3);
    expect(new Set(d.state.zombies.map((z) => z.target))).toEqual(new Set([a.id, b.id]));
    run(d, Math.ceil((RULES.zombieRise + 0.15) / RULES.tick));
    const chaser = d.state.zombies.find((z) => z.target === a.id)!;
    const before = { x: chaser.x, y: chaser.y },
      gap = distance(chaser, a);
    run(d, 1);
    const moved = distance(before, chaser);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(RULES.zombieSpeed / 30 + 1e-6);
    run(d, 20);
    expect(distance(chaser, a)).toBeLessThan(gap - 50);
  });
  it('rodea un muro para alcanzar a un rival detrás', () => {
    const path = findPath({ x: 200, y: 160 }, { x: 340, y: 160 });
    expect(path.length).toBeGreaterThan(2);
    expect(path.every((p) => !blocked(p.x, p.y))).toBe(true);
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 200, y: 160, angle: Math.PI / 2 });
    Object.assign(g, { x: 340, y: 160 });
    run(d, 1, { 0: { summon: true, angle: Math.PI / 2 } });
    for (let i = 0; i < 150 && g.hp === 3; i++) run(d, 1, { 0: { angle: Math.PI / 2 } });
    expect(g.hp).toBeLessThan(3);
    expect(d.state.zombies.every((z) => !blocked(z.x, z.y))).toBe(true);
  });
  it('su golpe suelta la bandera y suma muerte, sin atacar a su equipo', () => {
    const { d, players: [n, g] } = setup();
    Object.assign(n, { x: 480, y: 100, angle: 0 });
    Object.assign(g, { x: 540, y: 100, hp: 1 });
    Object.assign(d.state.flags[0], { status: 'carried', carrier: g.id });
    run(d, 1, { 0: { summon: true } });
    for (let i = 0; i < 120 && g.hp > 0; i++) run(d, 1);
    expect(g.hp).toBe(0);
    expect(g.deaths).toBe(1);
    expect(d.state.flags[0].status).toBe('dropped');
    expect(n.hp).toBe(CLASSES.necromancer.hp);
  });
  it('espada y flechas destruyen zombies enemigos', () => {
    const sword = setup(['necromancer', 'vanguard']);
    const [n, v] = sword.players;
    Object.assign(n, { x: 100, y: 500, angle: 0 });
    Object.assign(v, { x: 480, y: 100, angle: Math.PI / 2 });
    run(sword.d, 1, { 0: { summon: true } });
    const zombie = sword.d.state.zombies[0];
    Object.assign(zombie, { x: 480, y: 150 });
    run(sword.d, 1, { 1: { sword: true, angle: Math.PI / 2 } });
    run(sword.d, 12, { 1: { angle: Math.PI / 2 } });
    expect(sword.d.state.zombies.map((z) => z.id)).not.toContain(zombie.id);
    const arrow = setup(['necromancer', 'archer']);
    Object.assign(arrow.players[0], { x: 100, y: 500, angle: 0 });
    Object.assign(arrow.players[1], { x: 380, y: 270, angle: 0 });
    run(arrow.d, 1, { 0: { summon: true } });
    const target = arrow.d.state.zombies[0];
    Object.assign(target, { x: 430, y: 270, hp: 1 });
    run(arrow.d, 1, { 1: { shot: true } });
    run(arrow.d, 5);
    expect(arrow.d.state.zombies.map((z) => z.id)).not.toContain(target.id);
  });
  it('los zombies desaparecen al capturar y al eliminar a su dueño', () => {
    const { d, players: [n] } = setup(['necromancer', 'guardian', 'archer']);
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies).toHaveLength(2);
    d.resetArena();
    expect(d.state.zombies).toHaveLength(0);
    run(d, Math.ceil(RULES.summonCooldown / RULES.tick) + 1);
    run(d, 1, { 0: { summon: true } });
    expect(d.state.zombies).toHaveLength(2);
    d.eliminate(n);
    expect(d.state.zombies).toHaveLength(0);
  });
});
