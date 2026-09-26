import { describe, it, expect } from 'vitest';
import {
  Duel,
  RULES,
  HOMES,
  CORNER_HOMES,
  TEAMS,
  WALLS,
  idleInput,
  sanitizeInput,
  validName,
  blocked,
  blinkTarget,
  blinkReach,
  CLASSES,
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
  it('un toque de Parpadeo espera 0,5 s y salta ~110 u, atravesando un muro', () => {
    const d = duel('mage'),
      p = d.state.players[0];
    place(p, 200, 164);
    movePlayer(p, { ...idleInput(), blink: true, blinkRelease: true }, false);
    expect(p.blinkCommitted).toBe(true);
    const windup = Math.round(RULES.mageBlinkMinCharge / RULES.tick);
    for (let i = 2; i < windup; i++) movePlayer(p, idleInput(), false);
    expect(p.x).toBe(200);
    expect(p.dashCd).toBe(0);
    movePlayer(p, idleInput(), false);
    expect(p.x).toBeCloseTo(200 + blinkReach(RULES.mageBlinkMinCharge));
    expect(p.x).toBeGreaterThan(WALLS[0].x + WALLS[0].w);
    expect(blocked(p.x, p.y)).toBe(false);
    expect(p.dashCd).toBeGreaterThan(0);
    expect(p.blinkCharge).toBe(0);
  });
  it('Parpadeo cargado 2 s llega a 260 u como máximo, o al cursor si está más cerca', () => {
    const d = duel('mage'),
      p = d.state.players[0];
    const jump = (aimX: number) => {
      place(p, 400, 270);
      p.dashCd = 0;
      p.dashLeft = 0;
      for (let i = 0; i < Math.ceil(RULES.mageBlinkChargeTime / RULES.tick) + 5; i++)
        movePlayer(p, { ...idleInput(), blink: true, aimX, aimY: 270 }, false);
      expect(p.x).toBe(400);
      expect(p.blinkCharge).toBe(RULES.mageBlinkChargeTime);
      movePlayer(p, { ...idleInput(), blinkRelease: true, aimX, aimY: 270 }, false);
    };
    jump(900);
    expect(p.x).toBeCloseTo(400 + RULES.mageBlinkRange);
    jump(460);
    expect(p.x).toBeCloseTo(460);
  });
  it('cargando Parpadeo camina a media velocidad, y soltar sin lanzarlo lo cancela', () => {
    const d = duel('mage'),
      p = d.state.players[0];
    place(p, 400, 270);
    movePlayer(p, { ...idleInput(), blink: true, x: 1 }, false);
    expect(p.x - 400).toBeCloseTo(CLASSES.mage.speed * RULES.chargeMoveSpeed * RULES.tick);
    for (let i = 0; i < 20; i++) movePlayer(p, { ...idleInput(), blink: true }, false);
    const x = p.x;
    movePlayer(p, idleInput(), false);
    expect(p.blinkCharge).toBe(0);
    expect(p.x).toBe(x);
    expect(p.dashCd).toBe(0);
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

describe('blinkTarget', () => {
  it('aterriza en el destino libre', () => {
    const to = blinkTarget({ x: 400, y: 270 }, 0, 100, WALLS);
    expect(to.x).toBeCloseTo(500);
    expect(to.y).toBeCloseTo(270);
  });
  it('retrocede al borde si el destino cae dentro de un muro', () => {
    const from = { x: 200, y: 164 };
    const to = blinkTarget(from, 0, 60, WALLS); // 200 + 60 = 260 cae dentro de WALLS[0]
    expect(blocked(to.x, to.y)).toBe(false);
    expect(to.x).toBeLessThan(WALLS[0].x);
  });
  it('no sale de los límites', () => {
    const to = blinkTarget({ x: 33, y: 270 }, Math.PI, 300, WALLS);
    expect(blocked(to.x, to.y)).toBe(false);
    expect(to.x).toBeGreaterThanOrEqual(32);
  });
  it('queda en el origen cuando el recorrido es nulo', () => {
    const from = { x: 400, y: 270 };
    expect(blinkTarget(from, 0, 0, WALLS)).toEqual(from);
  });
});
describe('todos contra todos', () => {
  function group(n: number) {
    const d = new Duel('courtyard', n === 2 ? 'duel' : n === 3 ? 'ffa3' : 'ffa4');
    for (let i = 0; i < n; i++) d.add(String(i), `P${i}`);
    return d;
  }
  it('asigna colores y esquinas, y rechaza al quinto jugador', () => {
    const d = group(4);
    expect(d.state.players.map((p) => p.team)).toEqual(TEAMS);
    expect(d.state.bases.map((b) => b.home)).toEqual(TEAMS.map((t) => CORNER_HOMES[t]));
    expect(d.state.players.map((p) => ({ x: p.x, y: p.y }))).toEqual(d.state.bases.map((b) => b.spawn));
    expect(d.state.flags).toHaveLength(4);
    expect(() => d.add('x', 'X')).toThrow('Sala llena');
    expect(group(2).state.bases.map((b) => b.home)).toEqual([HOMES.blue, HOMES.red]);
  });
  it('empieza con tres jugadores listos', () => {
    const d = group(3);
    d.ready('0');
    d.ready('1');
    expect(d.state.phase).toBe('lobby');
    d.ready('2');
    expect(d.state.phase).toBe('countdown');
    expect(d.state.flags.map((f) => f.team)).toEqual(['blue', 'red', 'green']);
  });
  it('se roba cualquier bandera rival y capturar exige la propia en casa', () => {
    const d = group(4),
      [blue, , green] = d.state.players;
    d.state.phase = 'playing';
    Object.assign(green, CORNER_HOMES.blue);
    d.step(new Map());
    expect(d.state.flags.find((f) => f.team === 'blue')?.carrier).toBe(green.id);
    place(green, 480, 270);
    Object.assign(blue, CORNER_HOMES.violet);
    d.step(new Map());
    expect(d.state.flags.find((f) => f.team === 'violet')?.carrier).toBe(blue.id);
    Object.assign(blue, CORNER_HOMES.blue);
    d.step(new Map());
    expect(d.state.score.blue).toBe(0);
    Object.assign(green, CORNER_HOMES.green);
    d.step(new Map());
    expect(d.state.score.green).toBe(1);
    expect(d.state.phase).toBe('capture');
  });
  it('mantiene reapariciones ilimitadas después de cinco muertes', () => {
    const d = group(3),
      [a, b] = d.state.players;
    d.state.phase = 'playing';
    for (let death = 1; death <= RULES.maxDeaths + 1; death++) {
      a.invuln = 0;
      d.damage(a, b, 0, 99);
      expect(a.deaths).toBe(death);
      steps(d, 91);
      expect(a.hp).toBe(3);
    }
    expect(a.eliminated).toBe(false);
    expect(d.state.flags.some((f) => f.team === a.team)).toBe(true);
    expect(d.state.phase).toBe('playing');
  });
  it('el último equipo con participantes gana por abandono', () => {
    const d = group(3),
      [a, b] = d.state.players;
    d.state.phase = 'playing';
    d.abandon(a.id);
    expect(d.state.phase).toBe('playing');
    d.abandon(b.id);
    expect(d.state).toMatchObject({ phase: 'finished', winner: 'green', reason: 'abandono' });
    expect(d.state.players).toHaveLength(1);
    expect(d.state.flags).toHaveLength(1);
  });
  it('por tiempo gana el mayor marcador y hay empate entre líderes', () => {
    const d = group(4);
    d.state.phase = 'playing';
    Object.assign(d.state.score, { red: 2, green: 2 });
    d.state.timeLeft = 0.01;
    d.step(new Map());
    expect(d.state.winner).toBe('draw');
    const e = group(4);
    e.state.phase = 'playing';
    e.state.score.violet = 1;
    e.state.timeLeft = 0.01;
    e.step(new Map());
    expect(e.state.winner).toBe('violet');
  });
});
