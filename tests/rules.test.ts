import { describe, it, expect } from 'vitest';
import {
  Duel,
  RULES,
  HOMES,
  WALLS,
  idleInput,
  sanitizeInput,
  validName,
  blocked,
  movePlayer,
  type Player,
  type ClassId,
} from '@bandera/shared';
function duel(classId: ClassId = 'guardian') {
  const d = new Duel();
  d.add('a', 'Azul',classId);
  d.add('b', 'Rojo');
  d.state.phase = 'playing';
  return d;
}
function steps(d: Duel, n: number) {
  for (let i = 0; i < n; i++) d.step(new Map());
}
function place(p: Player, x: number, y: number) {
  p.x = x;
  p.y = y;
}
describe('banderas y victoria', () => {
  it('recoge la bandera enemiga y captura solo con la propia en casa', () => {
    const d = duel(),
      p = d.state.players[0];
    Object.assign(p, HOMES.red);
    d.step(new Map());
    expect(d.state.flags[1].carrier).toBe(p.id);
    Object.assign(p, HOMES.blue);
    d.step(new Map());
    expect(d.state.score.blue).toBe(1);
    expect(d.state.phase).toBe('capture');
    expect(d.state.flags.every((f) => f.status === 'home')).toBe(true);
  });
  it('no captura si ambas banderas están robadas', () => {
    const d = duel();
    Object.assign(d.state.players[0], HOMES.red);
    Object.assign(d.state.players[1], HOMES.blue);
    d.step(new Map());
    expect(d.state.flags.every((f) => f.status === 'carried')).toBe(true);
    Object.assign(d.state.players[0], HOMES.blue);
    d.step(new Map());
    expect(d.state.score.blue).toBe(0);
  });
  it('un golpe suelta bandera, bloquea recogida 0.7s y luego permite recuperarla', () => {
    const d = duel(),
      p = d.state.players[0],
      q = d.state.players[1];
    Object.assign(p, HOMES.red);
    d.step(new Map());
    d.damage(p, q, 0);
    expect(d.state.flags[1].status).toBe('dropped');
    steps(d, 10);
    expect(d.state.flags[1].carrier).toBe(null);
    steps(d, 13);
    expect(d.state.flags[1].carrier).toBe(p.id);
  });
  it('la bandera propia vuelve al tocarla y tiene prioridad sobre recogidas simultáneas', () => {
    const d = duel();
    Object.assign(d.state.flags[0], { status: 'dropped', x: 480, y: 270, returnLeft: 10 });
    for (const p of d.state.players) place(p, 480, 270);
    d.step(new Map());
    expect(d.state.flags[0].status).toBe('home');
  });
  it('retorna automáticamente a los 10 segundos', () => {
    const d = duel();
    Object.assign(d.state.flags[0], { status: 'dropped', x: 480, y: 80, returnLeft: 10 });
    steps(d, 301);
    expect(d.state.flags[0].status).toBe('home');
  });
  it('pausa el reloj durante captura y desconexión', () => {
    const d = duel();
    d.state.phase = 'capture';
    d.state.phaseLeft = 2;
    steps(d, 30);
    expect(d.state.timeLeft).toBe(180);
    d.state.paused = true;
    steps(d, 90);
    expect(d.state.phaseLeft).toBeCloseTo(1);
  });
  it('termina al llegar a tres capturas y reinicia por acuerdo de revancha', () => {
    const d = duel();
    d.state.score.blue = 2;
    const p = d.state.players[0];
    Object.assign(d.state.flags[1], { status: 'carried', carrier: p.id });
    Object.assign(p, HOMES.blue);
    d.step(new Map());
    expect(d.state.winner).toBe('blue');
    d.ready('a');
    expect(d.state.phase).toBe('finished');
    d.ready('b');
    expect(d.state.phase).toBe('countdown');
    expect(d.state.score.blue).toBe(0);
    expect(d.state.timeLeft).toBe(180);
  });
  it('resuelve empate y victoria por tiempo', () => {
    const d = duel();
    d.state.timeLeft = 0.01;
    d.step(new Map());
    expect(d.state.winner).toBe('draw');
    const e = duel();
    e.state.timeLeft = 0.01;
    e.state.score.red = 1;
    e.step(new Map());
    expect(e.state.winner).toBe('red');
  });
});
describe('combate y geometría', () => {
  it('los eventos tienen identificadores numéricos únicos sin filtrar el estado del jugador', () => {
    const d = duel();
    d.event('shot', d.state.players[0], 'blue');
    d.event('hit', d.state.players[1], 'blue');
    expect(d.state.events.map((e) => e.id)).toEqual([1, 2]);
    expect(d.state.events[0]).not.toHaveProperty('hp');
  });
  it('una flecha daña al rival y desaparece al impactar', () => {
    const d = duel('archer'),
      p = d.state.players[0],
      q = d.state.players[1];
    place(p, 420, 270);
    place(q, 510, 270);
    d.step(new Map([[p.id, { ...idleInput(1), shot: true }]]));
    steps(d, 6);
    expect(q.hp).toBe(2);
    expect(d.state.arrows).toHaveLength(0);
  });
  it('normaliza diagonales y rechaza entradas malformadas sin aceptar coordenadas', () => {
    expect(sanitizeInput({ ...idleInput(), x: 1, y: 1 })?.x).toBeCloseTo(Math.SQRT1_2);
    expect(sanitizeInput({ ...idleInput(), x: 100 })).toBe(null);
    expect(sanitizeInput({ ...idleInput(), angle: NaN })).toBe(null);
    expect(sanitizeInput({ ...idleInput(), seq: -1 })).toBe(null);
    expect(sanitizeInput({ ...idleInput(), hp: 999 })).not.toHaveProperty('hp');
    expect(validName('<script>')).toBe(null);
    expect(validName('  Caballero Ñ  ')).toBe('Caballero Ñ');
  });
  it('dash y movimiento no atraviesan paredes ni bordes', () => {
    const d = duel('archer'),
      p = d.state.players[0];
    place(p, WALLS[0].x - 15, 150);
    const input = { ...idleInput(), x: 1, dash: true };
    movePlayer(p, input, false);
    expect(p.x).toBeLessThan(WALLS[0].x - RULES.radius + 1);
    expect(blocked(p.x, p.y)).toBe(false);
    place(p, 33, 270);
    movePlayer(p, { ...input, x: -1 }, false);
    expect(p.x).toBeGreaterThanOrEqual(32);
  });
  it('el portador se mueve 15% más lento pero puede atacar sin soltar', () => {
    const d = duel(),
      p = d.state.players[0],
      q = d.state.players[1];
    place(p, 400, 270);
    place(q, 400, 270);
    const input = { ...idleInput(1), x: 1 };
    movePlayer(p, input, true);
    movePlayer(q, input, false);
    expect((p.x - 400) / (q.x - 400)).toBeCloseTo(0.85);
    Object.assign(d.state.flags[1], { status: 'carried', carrier: p.id });
    d.step(new Map([[p.id, { ...idleInput(2), sword: true }]]));
    expect(p.windup).toBeGreaterThan(0);
    expect(d.state.flags[1].carrier).toBe(p.id);
  });
  it('la espada requiere preparación, apunta al frente y respeta recarga', () => {
    const d = duel(),
      p = d.state.players[0],
      q = d.state.players[1];
    place(p, 420, 270);
    place(q, 458, 270);
    d.step(new Map([[p.id, { ...idleInput(1), sword: true }]]));
    expect(q.hp).toBe(3);
    steps(d, 4);
    expect(q.hp).toBe(2);
    const before = d.state.events.filter((e) => e.kind === 'sword').length;
    d.step(new Map([[p.id, { ...idleInput(2), sword: true }]]));
    steps(d, 4);
    expect(d.state.events.filter((e) => e.kind === 'sword')).toHaveLength(before);
  });
  it('las paredes bloquean espada y flechas', () => {
    const d = duel('archer'),
      p = d.state.players[0],
      q = d.state.players[1];
    place(p, 480, 150);
    place(q, 480, 219);
    d.step(new Map([[p.id, { ...idleInput(1), angle: Math.PI / 2, sword: true }]]));
    steps(d, 5);
    expect(q.hp).toBe(3);
    steps(d, 7);
    d.step(new Map([[p.id, { ...idleInput(2), angle: Math.PI / 2, shot: true }]]));
    steps(d, 10);
    expect(q.hp).toBe(3);
    expect(d.state.arrows).toHaveLength(0);
  });
  it('evita espada y disparo simultáneos y limita disparos repetidos', () => {
    const d = duel('archer'),
      p = d.state.players[0];
    d.step(new Map([[p.id, { ...idleInput(1), sword: true, shot: true }]]));
    expect(d.state.arrows).toHaveLength(0);
    steps(d, 8);
    d.step(new Map([[p.id, { ...idleInput(2), shot: true }]]));
    expect(d.state.arrows).toHaveLength(1);
    d.step(new Map([[p.id, { ...idleInput(3), shot: true }]]));
    expect(d.state.arrows).toHaveLength(1);
  });
  it('protección de daño, muerte y reaparición funcionan', () => {
    const d = duel(),
      p = d.state.players[0],
      q = d.state.players[1];
    d.damage(p, q, 0);
    d.damage(p, q, 0);
    expect(p.hp).toBe(2);
    p.invuln = 0;
    d.damage(p, q, 0);
    p.invuln = 0;
    d.damage(p, q, 0);
    expect(p.hp).toBe(0);
    steps(d, 91);
    expect(p.hp).toBe(3);
    expect(p.invuln).toBeGreaterThan(0);
    d.step(new Map([[p.id, { ...idleInput(1), sword: true }]]));
    expect(p.invuln).toBe(0);
  });
});
