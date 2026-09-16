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
  entered: { characterId: string; zoneId: string } | null;
  refused: { to: string; minLevel: number; open: boolean } | null;
  system: { kind: string; title: string; text: string; incantation?: string }[];
}

/** The zone worlds inside the room, for tests that need to move or level a character by hand. */
interface ZoneWorldForTests {
  grantXp(id: string, xp: number): unknown;
  state: { players: { id: string; x: number; y: number }[] };
  definition: { portals: { to: string; minLevel: number; area: { x: number; y: number; w: number; h: number } }[] };
}
const zoneWorld = (roomId: string, zoneId: string) =>
  (matchMaker.getLocalRoomById(roomId) as unknown as { worlds: Map<string, ZoneWorldForTests> }).worlds.get(zoneId)!;

async function connect(options: Record<string, unknown>): Promise<Session> {
  const room = await sdk.joinOrCreate('world', options);
  sessions.push(room);
  const session: Session = { room, snapshots: [], characters: null, sheet: null, entered: null, refused: null, system: [] };
  room.onMessage('system', (m: Session['system'][number]) => session.system.push(m));
  room.onMessage('refused', (m: Session['refused']) => (session.refused = m));
  room.onMessage('snapshot', (s: Snapshot) => session.snapshots.push(s));
  room.onMessage('characters', (m: Session['characters']) => (session.characters = m));
  room.onMessage('sheet', (m: Character) => (session.sheet = m));
  room.onMessage('entered', (m: { characterId: string; zoneId: string }) => (session.entered = m));
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
    // Level the character up before leaving, so we can tell a real save from a fresh character.
    zoneWorld(roomId, 'umbral').grantXp('ainz-1', 500);
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

  it('sin el nivel, el portal devuelve al jugador y le dice cuánto le falta', async () => {
    const s = await connect({
      account: 'Novato', password: 'novato12', create: true,
      characterId: 'novato-1', name: 'Novato', classId: 'guardian',
    });
    await until(() => s.entered !== null);
    const valle = zoneWorld(s.room.roomId, 'umbral');
    const portal = valle.definition.portals[0];
    const p = valle.state.players.find((q) => q.id === 'novato-1')!;
    Object.assign(p, { x: portal.area.x + portal.area.w / 2, y: portal.area.y + portal.area.h / 2 });
    await until(() => s.refused !== null);
    expect(s.refused).toMatchObject({ to: portal.to, minLevel: portal.minLevel, open: true });
    expect(s.entered?.zoneId).toBe('umbral');
  });

  it('con el nivel, cruzar el portal lleva al personaje a la otra zona y lo guarda allá', async () => {
    const s = await connect({
      account: 'Viajero', password: 'portal12', create: true,
      characterId: 'viajero-1', name: 'Viajero', classId: 'archer',
    });
    await until(() => s.entered !== null);
    const valle = zoneWorld(s.room.roomId, 'umbral');
    valle.grantXp('viajero-1', 5000);
    const portal = valle.definition.portals[0];
    const p = valle.state.players.find((q) => q.id === 'viajero-1')!;
    Object.assign(p, { x: portal.area.x + portal.area.w / 2, y: portal.area.y + portal.area.h / 2 });
    await until(() => s.entered?.zoneId === portal.to);
    // The snapshots now come from the other zone, and the valley no longer holds the character.
    await until(() => (s.snapshots.at(-1) as Snapshot & { zoneId?: string }).zoneId === portal.to);
    expect(valle.state.players.some((q) => q.id === 'viajero-1')).toBe(false);
    const cuenta = await characterStore().verify('Viajero', 'portal12');
    const guardado = await characterStore().load(cuenta!, 'viajero-1');
    expect(guardado?.zoneId).toBe(portal.to);
  });

  it('ganar experiencia le manda al jugador su ficha actualizada', async () => {
    const s = await connect({
      account: 'Aprendiz', password: 'aprende1', create: true,
      characterId: 'aprendiz-1', name: 'Aprendiz', classId: 'mage',
    });
    await until(() => s.sheet !== null);
    zoneWorld(s.room.roomId, 'umbral').grantXp('aprendiz-1', 500);
    await until(() => (s.sheet?.level ?? 1) > 1);
    expect(s.sheet!.unspent).toBeGreaterThan(0);
  });

  it('crear con chispas y arma tira el destino en el servidor y lo manda en la ficha', async () => {
    const s = await connect({
      account: 'Isekai', password: 'destino1', create: true,
      characterId: 'isekai-1', name: 'Rudeus', classId: 'guardian',
      creation: { sparks: { fuego: 2, agua: 1 }, weapon: 'baston' },
    });
    await until(() => s.sheet !== null);
    expect(s.sheet!.weapon).toBe('baston');
    expect(s.sheet!.classId).toBe('mage');
    expect(s.sheet!.affinities.fuego!.points).toBeGreaterThanOrEqual(2);
    expect(s.sheet!.destiny.skillId).toBeTruthy();
    expect(s.sheet!.slots.e).toBe(s.sheet!.destiny.skillId);
  });

  it('una creación tramposa se ignora y el personaje nace común', async () => {
    const s = await connect({
      account: 'Tramposo', password: 'trampa12', create: true,
      characterId: 'tramposo-1', name: 'Tramposo', classId: 'guardian',
      creation: { sparks: { fuego: 9 }, weapon: 'baston' },
    });
    await until(() => s.sheet !== null);
    expect(s.sheet!.affinities.fuego).toBeUndefined();
    expect(s.sheet!.destiny.skillId).toBe('parada');
  });

  it('apretar una ranura lanza la habilidad y el Sistema le avisa solo a quien la lanzó', async () => {
    const s = await connect({
      account: 'Parador', password: 'parry123', create: true,
      characterId: 'parador-1', name: 'Noor', classId: 'guardian',
    });
    const testigo = await connect({
      account: 'Testigo', password: 'mirar123', create: true,
      characterId: 'testigo-1', name: 'Testigo', classId: 'guardian',
    });
    await until(() => s.entered !== null && testigo.entered !== null);
    s.room.send('cast', { slot: 'e', aimX: 900, aimY: 760 });
    await until(() => s.system.some((n) => n.kind === 'callout'));
    expect(s.system.find((n) => n.kind === 'callout')!.title).toBe('Parada');
    await sleep(200);
    expect(testigo.system.some((n) => n.kind === 'callout')).toBe(false);
  });

  it('la sala de duelo sigue funcionando igual al lado', async () => {
    const duelo = await sdk.create('duel', { name: 'Azul', classId: 'guardian' });
    sessions.push(duelo);
    expect(duelo.roomId).toBeTruthy();
    await duelo.leave();
  });
});
