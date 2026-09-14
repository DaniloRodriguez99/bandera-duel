import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Client, type Room as ClientRoom } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import { createServer } from '../packages/server/src/app.js';
import type { DuelRoom } from '../packages/server/src/room.js';
import { HOMES, RULES, idleInput, type Snapshot, type ClassId } from '@bandera/shared';
const server = createServer();
const sdk = new Client('ws://127.0.0.1:2568');
const sessions: ClientRoom[] = [];
const states = new Map<string, Snapshot>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw Error('Timeout esperando estado');
    await sleep(30);
  }
}
async function track(p: Promise<ClientRoom>) {
  const r = await p;
  sessions.push(r);
  r.onMessage('snapshot', (s: Snapshot) => states.set(r.sessionId, s));
  r.onMessage('pong', () => {}); r.onMessage('roomInfo', () => {});
  r.onMessage('selectionError', () => {});
  r.send('sync');
  await until(() => states.has(r.sessionId));
  return r;
}
async function pair(first:ClassId='guardian',second:ClassId='guardian') {
  const a = await track(sdk.create('duel', { name: 'Azul',classId:first })),
    b = await track(sdk.joinById(a.roomId, { name: 'Rojo',classId:second }));
  const host = matchMaker.getLocalRoomById(a.roomId) as DuelRoom;
  return { a, b, host };
}
beforeAll(async () => {
  await server.listen(2568, '127.0.0.1');
});
afterAll(async () => {
  await Promise.all(
    sessions.map(async (r) => {
      try {
        await Promise.race([r.leave(), sleep(500)]);
      } catch {}
    }),
  );
  await server.gracefullyShutdown(false);
});
describe('servidor con clientes Colyseus reales', () => {
  it.each([['archer','guardian'],['archer','vanguard'],['guardian','vanguard'],['necromancer','vanguard']] as [ClassId,ClassId][])('sincroniza clases %s vs %s y rechaza armas no autorizadas',async(first,second)=>{
    const {a,b,host}=await pair(first,second);await until(()=>states.get(a.sessionId)?.players.length===2);
    expect(states.get(b.sessionId)?.players.map(p=>p.classId)).toEqual([first,second]);host.game.state.phase='playing';
    a.send('input',{...idleInput(1),guard:true});b.send('input',{...idleInput(1),shot:true,dash:true,summon:true});await sleep(120);
    expect(host.game.state.arrows).toHaveLength(0);expect(host.game.state.zombies).toHaveLength(0);expect(host.game.state.players[1].dashCd).toBe(0);
    if(first==='archer'||first==='necromancer')expect(host.game.state.players[0].guarding).toBe(false);
    await a.leave();await b.leave();
  });
  it('valida selección, anula listo y bloquea cambios en partida',async()=>{
    await expect(sdk.create('duel',{name:'X',classId:'wizard'})).rejects.toThrow();
    const {a,b,host}=await pair();a.send('ready');await until(()=>host.game.state.players[0].ready);
    b.send('selectClass','vanguard');await until(()=>host.game.state.players[1].classId==='vanguard');expect(host.game.state.players[0].ready).toBe(false);
    b.send('selectClass','wizard');await sleep(100);expect(host.game.state.players[1].classId).toBe('vanguard');
    host.game.state.phase='playing';b.send('selectClass','archer');await sleep(100);expect(host.game.state.players[1].classId).toBe('vanguard');
    await a.leave();await b.leave();
  });
  it('libera escudo sostenido si dejan de llegar entradas durante 250 ms',async()=>{
    const {a,b,host}=await pair();host.game.state.phase='playing';a.send('input',{...idleInput(1),guard:true});await until(()=>host.game.state.players[0].guarding);
    await until(()=>!host.game.state.players[0].guarding);expect(host.game.state.players[0].guardCd).toBeGreaterThan(0);await a.leave();await b.leave();
  });
  it('salud, validación de nombre, sala privada y cupo', async () => {
    expect((await fetch('http://127.0.0.1:2568/health')).status).toBe(200);
    expect(
      (await fetch('http://127.0.0.1:2568/health', { headers: { Origin: 'https://evil.example' } }))
        .status,
    ).toBe(403);
    await expect(sdk.create('duel', { name: '<script>' })).rejects.toThrow();
    const { a, b, host } = await pair();
    expect(a.roomId).toMatch(/^[a-f0-9]{32}$/);
    expect(host.maxClients).toBe(RULES.maxPlayers + 5);
    const c = await track(sdk.joinById(a.roomId, { name: 'Tercero' })),
      d = await track(sdk.joinById(a.roomId, { name: 'Cuarto' }));
    await expect(sdk.joinById(a.roomId, { name: 'Quinto' })).rejects.toThrow();
    for (const r of [a, b, c, d]) r.send('ready');
    await until(() => states.get(a.sessionId)?.phase === 'playing');
    expect(states.get(d.sessionId)?.players.map((p) => p.team)).toEqual(['blue', 'red', 'green', 'violet']);
  });
  it('rechaza teletransporte y daño enviado; limita velocidad con ráfagas de inputs', async () => {
    const { a, b, host } = await pair();
    host.game.state.phase = 'playing';
    const p = host.game.state.players[0],
      x = p.x;
    a.send('input', { seq: 1, x: 1000, y: 0, angle: 0, hp: 999 });
    await sleep(150);
    expect(p.x).toBe(x);
    expect(p.hp).toBe(3);
    for (let seq = 2; seq < 32; seq++) a.send('input', { seq, x: 1, y: 0, angle: 0, hp: 999 });
    await sleep(220);
    expect(p.x - x).toBeLessThan(55);
    expect(p.hp).toBe(3);
    a.send('input', { seq: 1, x: -1, y: 0, angle: 0 });
    await sleep(100);
    expect(p.x).toBeGreaterThan(x);
    await a.leave();
    await b.leave();
  });
  it('ambos reciben captura y resultado idénticos y pueden pedir revancha', async () => {
    const { a, b, host } = await pair();
    host.game.state.phase = 'playing';
    host.game.state.score.blue = 2;
    const p = host.game.state.players[0];
    Object.assign(p, HOMES.blue);
    Object.assign(host.game.state.flags[1], { status: 'carried', carrier: p.id });
    await until(
      () =>
        states.get(a.sessionId)?.phase === 'finished' &&
        states.get(b.sessionId)?.phase === 'finished',
    );
    expect(states.get(a.sessionId)?.score).toEqual(states.get(b.sessionId)?.score);
    expect(states.get(a.sessionId)?.winner).toBe('blue');
    a.send('ready');
    b.send('ready');
    await until(() => states.get(a.sessionId)?.phase === 'countdown');
    expect(states.get(a.sessionId)?.score.blue).toBe(0);
  });
  it('pausa, reconecta la misma sesión y conserva el reloj con 150ms de latencia', async () => {
    const { a, b, host } = await pair('vanguard','archer');
    host.game.state.phase = 'playing';
    server.simulateLatency(150);
    a.reconnection.minUptime = 0;
    a.reconnection.minDelay = 700;
    a.reconnection.delay = 700;
    const before = host.game.state.timeLeft;
    host.clients.find((c) => c.sessionId === a.sessionId)!.ref.close(4010);
    await until(() => host.game.state.paused);
    const paused = host.game.state.timeLeft;
    await sleep(250);
    expect(host.game.state.timeLeft).toBe(paused);
    await until(() => !host.game.state.paused, 12000);
    expect(host.game.state.players.find((p) => p.id === a.sessionId)?.connected).toBe(true);
    expect(host.game.state.players.find((p) => p.id === a.sessionId)?.classId).toBe('vanguard');
    expect(before - host.game.state.timeLeft).toBeLessThan(2);
    server.simulateLatency(0);
    await a.leave();
    await b.leave();
  });
  it('vence por abandono al salir expresamente', async () => {
    const { a, b, host } = await pair();
    host.game.state.phase = 'playing';
    await b.leave();
    await until(() => states.get(a.sessionId)?.phase === 'finished');
    expect(states.get(a.sessionId)?.reason).toBe('abandono');
    expect(states.get(a.sessionId)?.winner).toBe('blue');
  });
  it('con tres jugadores un abandono elimina sin terminar; el último en pie gana', async () => {
    const { a, b, host } = await pair();
    const c = await track(sdk.joinById(a.roomId, { name: 'Verde' }));
    await until(() => host.game.state.players.length === 3);
    host.game.state.phase = 'playing';
    await c.leave();
    await until(() => host.game.state.players[2].eliminated);
    expect(host.game.state.phase).toBe('playing');
    await b.leave();
    await until(() => states.get(a.sessionId)?.phase === 'finished');
    expect(states.get(a.sessionId)).toMatchObject({ winner: 'blue', reason: 'abandono' });
  });
  it('reserva 15s y finaliza por abandono cuando no reconecta', async () => {
    const { a, b, host } = await pair();
    host.game.state.phase = 'playing';
    b.reconnection.enabled = false;
    host.clients.find((c) => c.sessionId === b.sessionId)!.ref.close(4010);
    await until(() => host.game.state.paused);
    await until(() => states.get(a.sessionId)?.phase === 'finished', 18000);
    expect(states.get(a.sessionId)?.winner).toBe('blue');
  });
});

it('espectadores entran durante el duelo, no juegan ni pausan y ven revancha', async () => {
  const {a,b,host}=await pair();
  host.game.state.phase='playing';
  const viewer=await track(sdk.joinById(a.roomId,{name:'Publico',spectator:true}));
  expect(states.get(viewer.sessionId)?.players).toHaveLength(2);
  viewer.send('ready');viewer.send('selectClass','archer');
  viewer.send('input',{...idleInput(1),shot:true,sword:true,dash:true,guard:true});
  await sleep(100);
  expect(host.game.state.players.every(p=>!p.ready)).toBe(true);
  expect(host.game.state.arrows).toHaveLength(0);
  const token=viewer.reconnectionToken;
  viewer.reconnection.enabled=false;
  viewer.connection.transport.ws.close();
  await sleep(100);
  expect(host.game.state.paused).toBe(false);
  const back=await track(sdk.reconnect(token));
  host.game.finish('blue','abandono');
  await until(()=>states.get(back.sessionId)?.phase==='finished');
  expect(states.get(back.sessionId)?.winner).toBe('blue');
  a.send('ready');b.send('ready');
  await until(()=>states.get(back.sessionId)?.phase==='playing');
  await back.leave();
  expect(host.game.state.paused).toBe(false);
  expect(host.game.state.players).toHaveLength(2);
  await a.leave();await b.leave();
});

it('listado público, contraseña para ambos roles y espectadores desactivados', async () => {
  const a = await track(sdk.create('duel', {name:'Host',title:'Torneo',visibility:'public',password:'clave',allowSpectators:false}));
  const hidden = await track(sdk.create('duel',{name:'Privado',title:'Secreta'}));
  const listed = await (await fetch('http://127.0.0.1:2568/rooms')).json();
  expect(listed.some((r:any)=>r.roomId===hidden.roomId)).toBe(false);
  expect(listed.find((r:any)=>r.roomId===a.roomId)).toMatchObject({title:'Torneo',passwordRequired:true,allowSpectators:false});
  expect(JSON.stringify(listed)).not.toContain('clave');
  await expect(sdk.joinById(a.roomId,{name:'Intruso'})).rejects.toThrow('Contraseña');
  await expect(sdk.joinById(a.roomId,{name:'Miron',spectator:true,password:'clave'})).rejects.toThrow('no admite');
  const b = await track(sdk.joinById(a.roomId,{name:'Rival',password:'clave'}));
  await b.leave();await a.leave();await hidden.leave();
  await until(()=>!matchMaker.getLocalRoomById(a.roomId));
  const after=await (await fetch('http://127.0.0.1:2568/rooms')).json();
  expect(after.some((r:any)=>r.roomId===a.roomId)).toBe(false);
});

it('cinco espectadores como máximo y contador al salir y reconectar', async () => {
  const {a,b,host}=await pair();
  const viewers=[];
  for(let i=0;i<5;i++)viewers.push(await track(sdk.joinById(a.roomId,{name:`Vista${i}`,spectator:true})));
  expect(host.publicInfo().spectators).toBe(5);
  await expect(sdk.joinById(a.roomId,{name:'Sexto',spectator:true})).rejects.toThrow();
  const v=viewers.pop()!, token=v.reconnectionToken;
  v.reconnection.enabled=false;v.connection.transport.ws.close();
  await until(()=>host.publicInfo().spectators===4);
  const back=await track(sdk.reconnect(token));
  await until(()=>host.publicInfo().spectators===5);
  await back.leave();await until(()=>host.publicInfo().spectators===4);
  const replacement=await track(sdk.joinById(a.roomId,{name:'Nuevo',spectator:true}));
  expect(host.publicInfo().spectators).toBe(5);
  for(const viewer of [...viewers,replacement])await viewer.leave();
  await a.leave();await b.leave();
});
