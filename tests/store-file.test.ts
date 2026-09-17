import { afterAll, describe, it, expect } from 'vitest';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newCharacter } from '@bandera/shared/world';
import { FileStore } from '../packages/server/src/store/file.js';
import { MemoryStore } from '../packages/server/src/store/characters.js';
import { storeFromEnv } from '../packages/server/src/store/env.js';

const temporales: string[] = [];
async function archivoTemporal() {
  const dir = await mkdtemp(join(tmpdir(), 'bandera-file-'));
  temporales.push(dir);
  return { dir, path: join(dir, 'personajes.json') };
}
afterAll(async () => {
  await Promise.all(temporales.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('FileStore', () => {
  it('el archivo con las claves hasheadas solo lo puede leer su dueño', async () => {
    const { path } = await archivoTemporal();
    const store = new FileStore(path);
    await store.createAccount('Rudeus', 'roxy1234');
    await store.close();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('lo guardado sobrevive a un FileStore nuevo sobre el mismo archivo', async () => {
    const { path } = await archivoTemporal();
    const antes = new FileStore(path);
    const cuenta = await antes.createAccount('Rudeus', 'roxy1234');
    const personaje = newCharacter('p1', cuenta, 'Rudeus', 'mage');
    await antes.createCharacter(cuenta, personaje);
    personaje.level = 9;
    personaje.stats.spirit = 12;
    await antes.save(personaje);
    await antes.close();

    const despues = new FileStore(path);
    expect(await despues.verify('rudeus', 'roxy1234')).toBe(cuenta);
    expect(await despues.verify('Rudeus', 'otra')).toBe(null);
    const cargado = await despues.load(cuenta, 'p1');
    expect(cargado).toMatchObject({ id: 'p1', level: 9, stats: { spirit: 12 } });
    // A new account must not reuse an id the file already handed out.
    expect(await despues.createAccount('Sylphie', 'viento12')).not.toBe(cuenta);
    await despues.close();
  });

  it('con el archivo corrupto se niega a arrancar y no lo toca', async () => {
    const { path } = await archivoTemporal();
    const roto = '{"format":"bandera-duel/characters","version":1,"nextId":3,"accounts":[{"id":"a1"';
    await writeFile(path, roto);
    const store = new FileStore(path);
    await expect(store.verify('Rudeus', 'roxy1234')).rejects.toMatchObject({ code: 'archivo-corrupto' });
    // Every later call refuses too, including the ones that would write.
    await expect(store.createAccount('Rudeus', 'roxy1234')).rejects.toMatchObject({ code: 'archivo-corrupto' });
    await store.close();
    expect(await readFile(path, 'utf8')).toBe(roto);
  });

  it('un JSON válido que no es un archivo de personajes también se rechaza', async () => {
    const { path } = await archivoTemporal();
    await writeFile(path, '[]');
    await expect(new FileStore(path).listCharacters('a1')).rejects.toMatchObject({ code: 'archivo-corrupto' });
    expect(await readFile(path, 'utf8')).toBe('[]');
  });

  it('un personaje roto no se resetea: cargarlo falla y el archivo lo conserva', async () => {
    const { path } = await archivoTemporal();
    const store = new FileStore(path);
    const cuenta = await store.createAccount('Noor', 'parry123');
    await store.createCharacter(cuenta, newCharacter('p1', cuenta, 'Noor', 'guardian'));
    await store.close();
    const data = JSON.parse(await readFile(path, 'utf8'));
    data.accounts[0].characters.p1.character.level = 'mucho';
    await writeFile(path, JSON.stringify(data));

    const otra = new FileStore(path);
    await expect(otra.load(cuenta, 'p1')).rejects.toMatchObject({ code: 'save-invalido' });
    // Another account keeps working, and a write elsewhere carries the broken save through untouched.
    const ajena = await otra.createAccount('Otro', 'clave123');
    await otra.createCharacter(ajena, newCharacter('p2', ajena, 'Otro', 'archer'));
    await otra.close();
    const final = JSON.parse(await readFile(path, 'utf8'));
    expect(final.accounts[0].characters.p1.character.level).toBe('mucho');
  });

  it('una ráfaga de guardados se junta en una sola escritura', async () => {
    const { path } = await archivoTemporal();
    const store = new FileStore(path);
    const cuenta = await store.createAccount('Noor', 'parry123');
    const personajes = Array.from({ length: 5 }, (_, i) => newCharacter(`p${i}`, cuenta, `P${i}`, 'guardian'));
    for (const p of personajes) await store.createCharacter(cuenta, p);
    const antes = store.writes;
    // What a world flush does: twenty saves fired together.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => {
        const p = personajes[i % personajes.length];
        p.xp = i;
        return store.save(p);
      }),
    );
    expect(store.writes - antes).toBeLessThanOrEqual(2);
    await store.close();
    const final = new FileStore(path);
    expect((await final.load(cuenta, 'p4'))?.xp).toBe(19);
  });

  it('las escrituras nunca se pisan: guardados mientras otra escritura está en curso quedan todos', async () => {
    const { path } = await archivoTemporal();
    const store = new FileStore(path);
    const cuenta = await store.createAccount('Noor', 'parry123');
    const p = newCharacter('p1', cuenta, 'Noor', 'guardian');
    await store.createCharacter(cuenta, p);
    const pendientes: Promise<void>[] = [];
    for (let i = 1; i <= 30; i++) {
      p.x = i;
      pendientes.push(store.save(p));
      if (i % 5 === 0) await new Promise((r) => setImmediate(r));
    }
    await Promise.all(pendientes);
    await store.close();
    expect((await new FileStore(path).load(cuenta, 'p1'))?.x).toBe(30);
  });

  it('un temporal que quedó de una escritura cortada se ignora', async () => {
    const { dir, path } = await archivoTemporal();
    const store = new FileStore(path);
    const cuenta = await store.createAccount('Noor', 'parry123');
    await store.createCharacter(cuenta, newCharacter('p1', cuenta, 'Noor', 'guardian'));
    await store.close();
    await writeFile(`${path}.4242.deadbeef.tmp`, '{"format":"bandera-duel/charac');

    const otra = new FileStore(path);
    expect(await otra.listCharacters(cuenta)).toHaveLength(1);
    await otra.close();
    expect((await readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('después de cerrar no acepta más cambios', async () => {
    const { path } = await archivoTemporal();
    const store = new FileStore(path);
    await store.createAccount('Noor', 'parry123');
    await store.close();
    await store.close();
    await expect(store.createAccount('Otro', 'clave123')).rejects.toMatchObject({ code: 'store-cerrado' });
  });
});

describe('elección del driver', () => {
  it('sin variables usa memoria y no avisa fuera de producción', () => {
    const avisos: string[] = [];
    expect(storeFromEnv({}, (m) => avisos.push(m))).toBeInstanceOf(MemoryStore);
    expect(avisos).toEqual([]);
  });

  it('en producción sin guardado real avisa que se pierde todo al reiniciar', () => {
    const avisos: string[] = [];
    expect(storeFromEnv({ NODE_ENV: 'production' }, (m) => avisos.push(m))).toBeInstanceOf(MemoryStore);
    expect(avisos).toHaveLength(1);
  });

  it('con STORE_FILE usa el archivo', async () => {
    const { path } = await archivoTemporal();
    const store = storeFromEnv({ STORE_FILE: path });
    expect(store).toBeInstanceOf(FileStore);
    expect((store as FileStore).path).toBe(path);
  });

  it('con DATABASE_URL falla en vez de usar memoria a escondidas', () => {
    expect(() => storeFromEnv({ DATABASE_URL: 'postgres://x', STORE_FILE: '/tmp/x.json' })).toThrow(/Postgres/);
  });
});
