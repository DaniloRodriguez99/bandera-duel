import { afterAll, describe, it, expect } from 'vitest';
import { Client } from '@colyseus/sdk';
import { WebSocket } from 'ws';
import { matchMaker } from '@colyseus/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Character } from '@bandera/shared/world';
import { createServer } from '../packages/server/src/app.js';
import { WorldRoom, characterStore, useCharacterStore } from '../packages/server/src/world-room.js';
import { FileStore } from '../packages/server/src/store/file.js';
import { createShutdown } from '../packages/server/src/store/shutdown.js';

(globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
// Its own port, like every file that builds a server: this one shuts its server down mid-test.
const PORT = 2571;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw Error('Timeout esperando estado');
    await sleep(30);
  }
}

let dir = '';
afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('apagado del servidor', () => {
  it('apagar guarda el progreso hecho después del último guardado periódico', async () => {
    dir = await mkdtemp(join(tmpdir(), 'bandera-shutdown-'));
    const path = join(dir, 'personajes.json');
    const store = new FileStore(path);
    useCharacterStore(store);
    const server = createServer();
    await server.listen(PORT, '127.0.0.1');

    const sdk = new Client(`ws://127.0.0.1:${PORT}`);
    const room = await sdk.joinOrCreate('world', {
      account: 'Apagon', password: 'apagon12', create: true, createCharacter: true,
      characterId: 'apagon-1', name: 'Apagon', classId: 'guardian',
    });
    let sheet: Character | null = null;
    room.onMessage('*', () => {});
    room.onMessage('sheet', (m: Character) => (sheet = m));
    await until(() => sheet !== null);

    // Progress the periodic 15 s flush has not seen: only the shutdown path can save it.
    const host = matchMaker.getLocalRoomById(room.roomId) as unknown as {
      worlds: Map<string, { grantXp(id: string, xp: number): unknown }>;
    };
    host.worlds.get('umbral')!.grantXp('apagon-1', 5000);
    await until(() => (sheet?.level ?? 1) > 1);
    const nivel = sheet!.level;
    const escriturasAntes = store.writes;

    const close = store.close.bind(store);
    let cierres = 0;
    store.close = () => {
      cierres++;
      return close();
    };
    const shutdown = createShutdown({
      server,
      flush: () => WorldRoom.flushAll(),
      store: characterStore,
      log: () => {},
    });
    // Two signals in a row, as an impatient Ctrl+C or Cloud Run's SIGTERM plus a retry would send.
    const [primero, segundo] = await Promise.all([shutdown(), shutdown()]);
    expect(primero).toBe(true);
    expect(segundo).toBe(true);
    expect(cierres).toBe(1);
    expect(store.writes).toBeGreaterThan(escriturasAntes);

    const releido = new FileStore(path);
    const cuenta = await releido.verify('Apagon', 'apagon12');
    const guardado = await releido.load(cuenta!, 'apagon-1');
    expect(guardado?.level).toBe(nivel);
    expect(guardado!.level).toBeGreaterThan(1);
    await releido.close();
  });
});
