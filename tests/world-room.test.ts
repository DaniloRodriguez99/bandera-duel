import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Client, type Room as ClientRoom } from '@colyseus/sdk';
import { WebSocket } from 'ws';
import { matchMaker } from '@colyseus/core';
import { createServer } from '../packages/server/src/app.js';
import { WorldRoom, characterStore } from '../packages/server/src/world-room.js';
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
  socialInvites: { id: string; kind: string; from: { id: string; name: string } }[];
  socialResults: string[];
  party: { id: string; leaderId: string; members: { id: string }[] } | null;
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
  const room = await sdk.joinOrCreate('world', { ...options, ...(options.create === true && options.characterId ? { createCharacter: true } : {}) });
  sessions.push(room);
  const session: Session = { room, snapshots: [], characters: null, sheet: null, entered: null, refused: null, system: [], socialInvites: [], socialResults: [], party: null };
  room.onMessage('system', (m: Session['system'][number]) => session.system.push(m));
  room.onMessage('refused', (m: Session['refused']) => (session.refused = m));
  room.onMessage('snapshot', (s: Snapshot) => session.snapshots.push(s));
  room.onMessage('characters', (m: Session['characters']) => (session.characters = m));
  room.onMessage('sheet', (m: Character) => (session.sheet = m));
  room.onMessage('entered', (m: { characterId: string; zoneId: string }) => (session.entered = m));
  room.onMessage('socialInvite', (m: Session['socialInvites'][number]) => session.socialInvites.push(m));
  room.onMessage('socialResult', (m: { text: string }) => session.socialResults.push(m.text));
  room.onMessage('party', (m: Session['party']) => (session.party = m));
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
  it('invita, rechaza y forma un party persistente con aceptación explícita', async () => {
    const a = await connect({ account: 'SocialA', password: 'social12', create: true, characterId: 'social-a', name: 'Social A', classId: 'guardian' });
    const b = await connect({ account: 'SocialB', password: 'social12', create: true, characterId: 'social-b', name: 'Social B', classId: 'guardian' });
    await until(() => a.entered !== null && b.entered !== null);
    a.room.send('socialInvite', { targetId: 'social-b', kind: 'trade' });
    await until(() => b.socialInvites.some((i) => i.kind === 'trade'));
    b.room.send('socialRespond', { inviteId: b.socialInvites.find((i) => i.kind === 'trade')!.id, accept: false });
    await until(() => a.socialResults.some((m) => /rechazada/.test(m)));

    a.room.send('socialInvite', { targetId: 'social-b', kind: 'party' });
    await until(() => b.socialInvites.some((i) => i.kind === 'party'));
    b.room.send('socialRespond', { inviteId: b.socialInvites.find((i) => i.kind === 'party')!.id, accept: true });
    await until(() => (a.party?.members.length ?? 0) === 2 && (b.party?.members.length ?? 0) === 2);
    expect(a.party?.leaderId).toBe('social-a');
    expect((await characterStore().partyFor('social-b'))?.id).toBe(a.party?.id);
  });
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

  it('en el Valle el otro jugador llega azul y en el Bosque, rojo; y morir allá avisa y cobra', async () => {
    const a = await connect({ account: 'Rival1', password: 'rival123', create: true, characterId: 'rival-a', name: 'Rival A', classId: 'guardian' });
    const b = await connect({ account: 'Rival2', password: 'rival123', create: true, characterId: 'rival-b', name: 'Rival B', classId: 'guardian' });
    await until(() => a.entered !== null && b.entered !== null);
    const room = matchMaker.getLocalRoomById(a.room.roomId) as unknown as {
      travel(id: string, to: string, arrive: { x: number; y: number }): Promise<void>;
      worlds: Map<string, { state: { players: { id: string; x: number; y: number }[] } }>;
    };
    const valle = zoneWorld(a.room.roomId, 'umbral');
    const pa = valle.state.players.find((p) => p.id === 'rival-a')!;
    Object.assign(valle.state.players.find((p) => p.id === 'rival-b')!, { x: pa.x + 60, y: pa.y });
    const colorDe = (s: Session, id: string) => s.snapshots.at(-1)?.players.find((p) => p.id === id)?.team;
    await until(() => colorDe(a, 'rival-b') !== undefined);
    expect(colorDe(a, 'rival-b')).toBe('blue');

    // Far from the Bosque shrine, so nothing but the test decides who gets hurt.
    await room.travel('rival-a', 'bosque', { x: 1300, y: 1000 });
    await room.travel('rival-b', 'bosque', { x: 1340, y: 1000 });
    await until(() => (a.snapshots.at(-1) as Snapshot & { zoneId?: string }).zoneId === 'bosque' && colorDe(a, 'rival-b') !== undefined);
    await until(() => colorDe(a, 'rival-b') === 'red');
    expect(colorDe(a, 'rival-a')).toBe('blue');

    const bosque = room.worlds.get('bosque') as unknown as {
      state: { players: (Snapshot['players'][number])[] };
      characters: Map<string, Character>;
      damage(target: object, source: object, angle: number, amount: number): boolean;
    };
    const cb = bosque.characters.get('rival-b')!;
    cb.level = 5;
    cb.xp = 100;
    const pb = bosque.state.players.find((p) => p.id === 'rival-b')!;
    pb.invuln = 0;
    expect(bosque.damage(pb, bosque.state.players.find((p) => p.id === 'rival-a')!, 0, 999)).toBe(true);
    await until(() => b.system.some((n) => n.kind === 'death') && (b.sheet?.xp ?? 100) < 100);
    expect(a.system.some((n) => n.kind === 'kill')).toBe(true);
  });

  it('quien pasa quieto el tiempo de inactividad queda afuera, avisado y guardado; moverse lo evita', async () => {
    const antes = WorldRoom.idleSeconds;
    WorldRoom.idleSeconds = 1.5;
    try {
      const quieto = await connect({ account: 'Quieto', password: 'quieto12', create: true, characterId: 'quieto-1', name: 'Quieto', classId: 'guardian' });
      const activo = await connect({ account: 'Activo', password: 'activo12', create: true, characterId: 'activo-1', name: 'Activo', classId: 'guardian' });
      let avisado: { seconds: number } | null = null;
      let afuera = false;
      quieto.room.onMessage('idle', (m: { seconds: number }) => (avisado = m));
      quieto.room.onLeave(() => (afuera = true));
      await until(() => quieto.entered !== null && activo.entered !== null);
      const valle = zoneWorld(quieto.room.roomId, 'umbral');
      zoneWorld(quieto.room.roomId, 'umbral').grantXp('quieto-1', 500);
      let seq = 0;
      const paso = setInterval(() => activo.room.send('input', { seq: ++seq, x: seq % 2 ? 1 : -1, y: 0, angle: 0, aimX: 0, aimY: 0 }), 100);
      try {
        await until(() => afuera, 5000);
        // Past another check of the idle clock: the one moving must still be there.
        await sleep(1500);
      } finally {
        clearInterval(paso);
      }
      expect(avisado).toEqual({ seconds: 1.5 });
      expect(valle.state.players.some((p) => p.id === 'quieto-1')).toBe(false);
      expect(valle.state.players.some((p) => p.id === 'activo-1')).toBe(true);
      const cuenta = await characterStore().verify('Quieto', 'quieto12');
      expect((await characterStore().load(cuenta!, 'quieto-1'))!.level).toBeGreaterThan(1);
    } finally {
      WorldRoom.idleSeconds = antes;
    }
  });

  it('abrir un cofre guarda al personaje en el momento, sin esperar el volcado', async () => {
    const s = await connect({ account: 'Cofre', password: 'cofre123', create: true, characterId: 'cofre-1', name: 'Cofre', classId: 'guardian' });
    await until(() => s.entered !== null && s.sheet !== null);
    const valle = zoneWorld(s.room.roomId, 'umbral') as unknown as ZoneWorldForTests & {
      state: { chests: { id: string; x: number; y: number }[]; players: { id: string; x: number; y: number; invuln: number }[] };
    };
    const chest = valle.state.chests[0];
    const p = valle.state.players.find((q) => q.id === 'cofre-1')!;
    Object.assign(p, { x: chest.x, y: chest.y + 20, invuln: 999 });
    // The snapshot now carries the chest, which it did not from the village.
    await until(() => (s.snapshots.at(-1) as Snapshot & { chests?: { id: string }[] }).chests?.some((c) => c.id === chest.id) ?? false);
    await until(() => (s.sheet?.inventory.length ?? 0) > 0, 6000);
    const cuenta = await characterStore().verify('Cofre', 'cofre123');
    const guardado = await characterStore().load(cuenta!, 'cofre-1');
    expect(guardado!.inventory.map((i) => i.uid)).toEqual(s.sheet!.inventory.map((i) => i.uid));
  });

  it('desde el pueblo no llegan los cofres de la otra punta del valle', async () => {
    const s = await connect({ account: 'Lejos', password: 'lejos123', create: true, characterId: 'lejos-1', name: 'Lejos', classId: 'guardian' });
    await until(() => s.entered !== null && s.snapshots.length > 0);
    const ultimo = s.snapshots.at(-1) as Snapshot & { chests?: unknown[] };
    expect(ultimo.chests).toEqual([]);
  });

  it('equipar por mensaje valida en el servidor: un uid inventado no cambia nada', async () => {
    const s = await connect({ account: 'Armero', password: 'armero12', create: true, characterId: 'armero-1', name: 'Armero', classId: 'guardian' });
    await until(() => s.entered !== null && s.sheet !== null);
    s.room.send('equip', { uid: 'i999' });
    s.room.send('equip', { uid: '../../etc' });
    await sleep(200);
    expect(s.sheet!.equipment.weapon.itemId).toBe('espada_madera');
    const world = zoneWorld(s.room.roomId, 'umbral') as unknown as ZoneWorldForTests & {
      characters: Map<string, Character>;
      give(id: string, itemId: string): { uid: string } | null;
    };
    world.characters.get('armero-1')!.level = 4;
    const espada = world.give('armero-1', 'espada_acero')!;
    s.room.send('equip', { uid: espada.uid });
    await until(() => s.sheet?.equipment.weapon.itemId === 'espada_acero');
    expect(s.sheet!.inventory.map((i) => i.itemId)).toContain('espada_madera');
  });

  it('entrar dos veces con el mismo personaje no lo duplica: la sesión nueva toma la ficha viva', async () => {
    const a = await connect({ account: 'Doble', password: 'doble123', create: true, characterId: 'doble-1', name: 'Doble', classId: 'guardian' });
    await until(() => a.entered !== null);
    const world = zoneWorld(a.room.roomId, 'umbral') as unknown as ZoneWorldForTests & {
      give(id: string, itemId: string): { uid: string } | null;
    };
    const libro = world.give('doble-1', 'manual_practica')!;
    let reemplazada = false;
    let cerrada = false;
    a.room.onMessage('replaced', () => (reemplazada = true));
    a.room.onLeave(() => (cerrada = true));
    const b = await connect({ account: 'Doble', password: 'doble123', characterId: 'doble-1' });
    await until(() => b.entered !== null && b.sheet !== null && cerrada);
    expect(reemplazada).toBe(true);
    await sleep(200);
    expect(world.state.players.filter((p) => p.id === 'doble-1')).toHaveLength(1);
    expect(b.sheet!.inventory.map((i) => i.uid)).toContain(libro.uid);
    const x = world.state.players.find((p) => p.id === 'doble-1')!.x;
    let seq = 0;
    const paso = setInterval(() => b.room.send('input', { seq: ++seq, x: 1, y: 0, angle: 0, aimX: 0, aimY: 0 }), 33);
    try {
      await until(() => world.state.players.find((p) => p.id === 'doble-1')!.x > x + 40);
    } finally {
      clearInterval(paso);
    }
  });

  it('otra cuenta no puede entrar con el id de un personaje que ya está en el mundo', async () => {
    const a = await connect({ account: 'Dueno', password: 'dueno123', create: true, characterId: 'mismo-id', name: 'Dueño', classId: 'guardian' });
    await until(() => a.entered !== null);
    await expect(
      sdk.joinOrCreate('world', { account: 'Intruso', password: 'intruso1', create: true, characterId: 'mismo-id', name: 'Intruso' }),
    ).rejects.toBeTruthy();
    const world = zoneWorld(a.room.roomId, 'umbral');
    expect(world.state.players.filter((p) => p.id === 'mismo-id')).toHaveLength(1);
  });

  it('la sala de duelo sigue funcionando igual al lado', async () => {
    const duelo = await sdk.create('duel', { name: 'Azul', classId: 'guardian' });
    sessions.push(duelo);
    expect(duelo.roomId).toBeTruthy();
    await duelo.leave();
  });
});
