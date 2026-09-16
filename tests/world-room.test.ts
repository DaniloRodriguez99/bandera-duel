import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Client, type Room as ClientRoom } from '@colyseus/sdk';
import { WebSocket } from 'ws';
import { matchMaker } from '@colyseus/core';
import { createServer } from '../packages/server/src/app.js';
import { characterStore, type WorldRoom } from '../packages/server/src/world-room.js';
import type { Character } from '@bandera/shared/world';
import type { Snapshot } from '@bandera/shared';

(globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
// Its own port: both this file and network.test.ts build a server at module scope, and waiting
// for the other one's teardown to have freed 2568 is not a bet worth taking.
const server = createServer();
const sdk = new Client('ws://127.0.0.1:2569');
const sessions: ClientRoom[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw Error('Timeout esperando estado');
    await sleep(30);
  }
}

interface Session {
  room: ClientRoom;
  snapshots: Snapshot[];
  characters: { characters: { id: string; level: number; zoneId: string }[] } | null;
  sheet: Character | null;
  entered: { characterId: string } | null;
}

async function connect(options: Record<string, unknown>): Promise<Session> {
  const room = await sdk.joinOrCreate('world', options);
  sessions.push(room);
  const session: Session = { room, snapshots: [], characters: null, sheet: null, entered: null };
  room.onMessage('snapshot', (s: Snapshot) => session.snapshots.push(s));
  room.onMessage('characters', (m: Session['characters']) => (session.characters = m));
  room.onMessage('sheet', (m: Character) => (session.sheet = m));
  room.onMessage('entered', (m: { characterId: string }) => (session.entered = m));
  return session;
}

beforeAll(async () => {
  await server.listen(2569, '127.0.0.1');
});
afterAll(async () => {
  await Promise.all(
    sessions.map(async (s) => {
      try {
        await Promise.race([s.room.leave(), sleep(500)]);
      } catch {}
    }),
  );
  await server.gracefullyShutdown(false);
});

describe('sala del mundo', () => {
  it('sin personaje elegido devuelve la lista para elegir', async () => {
    const s = await connect({ account: 'Rudeus', password: 'roxy1234', create: true });
    await until(() => s.characters !== null);
    expect(s.characters?.characters).toEqual([]);
    expect(s.entered).toBe(null);
  });

  it('crea el personaje, entra al mundo y recibe su ficha y el mundo alrededor', async () => {
    const s = await connect({
      account: 'Noor',
      password: 'parry123',
      create: true,
      characterId: 'noor-1',
      name: 'Noor',
      classId: 'guardian',
    });
    await until(() => s.entered !== null && s.sheet !== null && s.snapshots.length > 0);
    expect(s.entered?.characterId).toBe('noor-1');
    expect(s.sheet).toMatchObject({ id: 'noor-1', level: 1, classId: 'guardian' });
    // The private sheet carries progression; the shared snapshot does not.
    expect(s.sheet?.xp).toBe(0);
    expect(s.snapshots[0].players.some((p) => p.id === 'noor-1')).toBe(true);
  });

  it('rechaza la clave equivocada', async () => {
    await expect(sdk.joinOrCreate('world', { account: 'Noor', password: 'equivocada' })).rejects.toBeTruthy();
  });

  it('exige una clave de al menos 6 caracteres', async () => {
    await expect(sdk.joinOrCreate('world', { account: 'Corta', password: 'abc', create: true })).rejects.toBeTruthy();
  });

  it('se puede entrar con la partida ya en marcha, que es lo que la sala de duelo prohíbe', async () => {
    const primero = await connect({
      account: 'Rentt', password: 'ghoul123', create: true,
      characterId: 'rentt-1', name: 'Rentt', classId: 'archer',
    });
    await until(() => primero.entered !== null);
    // Let the world run for a while, so nobody could mistake this for a lobby.
    await sleep(300);
    const segundo = await connect({
      account: 'Jinwoo', password: 'sombras1', create: true,
      characterId: 'jinwoo-1', name: 'Jinwoo', classId: 'mage',
    });
    await until(() => segundo.entered !== null && segundo.snapshots.length > 0);
    expect(segundo.room.roomId).toBe(primero.room.roomId);
    await until(() => segundo.snapshots.at(-1)!.players.length >= 1);
  });

  it('la sala sigue viva cuando se va el último, y volver trae el personaje con su nivel', async () => {
    const s = await connect({
      account: 'Ainz', password: 'nazarick1', create: true,
      characterId: 'ainz-1', name: 'Ainz', classId: 'necromancer',
    });
    await until(() => s.entered !== null);
    const roomId = s.room.roomId;
    const host = matchMaker.getLocalRoomById(roomId) as unknown as WorldRoom;
    // Level the character up before leaving, so we can tell a real save from a fresh character.
    (host as unknown as { world: { grantXp(id: string, xp: number): unknown } }).world.grantXp('ainz-1', 500);
    await s.room.leave();
    await sleep(200);
    // A duel room would have closed itself here; this one is still standing.
    expect(matchMaker.getLocalRoomById(roomId)).toBeTruthy();
    const vuelta = await connect({ account: 'Ainz', password: 'nazarick1' });
    await until(() => vuelta.characters !== null);
    const guardado = vuelta.characters?.characters.find((c) => c.id === 'ainz-1');
    expect(guardado).toBeTruthy();
    expect(guardado!.level).toBeGreaterThan(1);
    expect(guardado!.zoneId).toBe('umbral');
  });

  it('el guardado es del proceso, no de la sala: cerrarla no se lleva las cuentas', async () => {
    const store = characterStore();
    const s = await connect({ account: 'Rentt2', password: 'ghoul123', create: true });
    await until(() => s.characters !== null);
    const host = matchMaker.getLocalRoomById(s.room.roomId) as unknown as { onDispose(): Promise<void> };
    await host.onDispose();
    // The identity check is the real pin: one store per process, not one per room. MemoryStore's
    // close() is a no-op, so this would not have caught the old bug on its own — it will matter
    // when the driver is Postgres and close() drops a live pool.
    expect(characterStore()).toBe(store);
    expect(await store.verify('Rentt2', 'ghoul123')).toBeTruthy();
  });

  it('la sala de duelo sigue funcionando igual al lado', async () => {
    const duelo = await sdk.create('duel', { name: 'Azul', classId: 'guardian' });
    sessions.push(duelo);
    expect(duelo.roomId).toBeTruthy();
    await duelo.leave();
  });
});
