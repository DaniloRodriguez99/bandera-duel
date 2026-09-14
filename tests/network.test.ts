import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Client, type Room as ClientRoom } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import { createServer } from '../packages/server/src/app.js';
import type { DuelRoom } from '../packages/server/src/room.js';
import { HOMES, idleInput, type Snapshot, type ClassId } from '@bandera/shared';
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
  r.onMessage('pong', () => {});
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
  it.each([['archer','guardian'],['archer','vanguard'],['guardian','vanguard']] as [ClassId,ClassId][])('sincroniza clases %s vs %s y rechaza armas no autorizadas',async(first,second)=>{
    const {a,b,host}=await pair(first,second);await until(()=>states.get(a.sessionId)?.players.length===2);
    expect(states.get(b.sessionId)?.players.map(p=>p.classId)).toEqual([first,second]);host.game.state.phase='playing';
    a.send('input',{...idleInput(1),guard:true});b.send('input',{...idleInput(1),shot:true,dash:true});await sleep(120);
    expect(host.game.state.arrows).toHaveLength(0);expect(host.game.state.players[1].dashCd).toBe(0);
    if(first==='archer')expect(host.game.state.players[0].guarding).toBe(false);
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
    expect(host.maxClients).toBe(2);
    await expect(sdk.joinById(a.roomId, { name: 'Tercero' })).rejects.toThrow();
    a.send('ready');
    b.send('ready');
    await until(() => states.get(a.sessionId)?.phase === 'playing');
    expect(states.get(b.sessionId)?.players).toHaveLength(2);
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
