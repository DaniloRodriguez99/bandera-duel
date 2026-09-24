import { afterAll, describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newCharacter } from '@bandera/shared/world';
import {
  MAX_CHARACTERS,
  MemoryStore,
  StoreError,
  hashPassword,
  verifyPassword,
  type CharacterStore,
} from '../packages/server/src/store/characters.js';
import { FileStore } from '../packages/server/src/store/file.js';
import { PostgresStore } from '../packages/server/src/store/postgres.js';

const temporales: string[] = [];
/** A fresh directory per store, so no two tests ever share a file. */
async function carpetaTemporal() {
  const dir = await mkdtemp(join(tmpdir(), 'bandera-store-'));
  temporales.push(dir);
  return dir;
}
afterAll(async () => {
  await Promise.all(temporales.map((dir) => rm(dir, { recursive: true, force: true })));
});

/**
 * One contract suite, run against every driver. A Postgres driver reuses it verbatim by adding
 * its own factory, which is the point of keeping the interface narrow.
 */
const drivers: [string, () => Promise<CharacterStore>][] = [
  ['MemoryStore', async () => new MemoryStore()],
  ['FileStore', async () => new FileStore(join(await carpetaTemporal(), 'personajes.json'))],
];
/**
 * Postgres runs the same contract when a throwaway database is given. Each store gets its own
 * schema-free start by wiping the tables, so point this only at a database made for tests.
 */
const testDatabase = process.env.TEST_DATABASE_URL;
const abiertos: CharacterStore[] = [];
if (testDatabase)
  drivers.push([
    'PostgresStore',
    async () => {
      const store = new PostgresStore(testDatabase);
      abiertos.push(store);
      await store.listCharacters('nadie');
      await (store as unknown as { pool: { query(sql: string): Promise<unknown> } }).pool.query(
        'truncate bandera_parties, bandera_characters, bandera_accounts',
      );
      return store;
    },
  ]);
afterAll(async () => {
  await Promise.all(abiertos.map((store) => store.close().catch(() => {})));
});

describe.each(drivers)('contrato del guardado: %s', (_nombre, crear) => {
  it('crea una cuenta y entra con la clave correcta', async () => {
    const store = await crear();
    const id = await store.createAccount('Rudeus', 'roxy1234');
    expect(await store.verify('Rudeus', 'roxy1234')).toBe(id);
  });

  it('rechaza la clave equivocada y la cuenta que no existe', async () => {
    const store = await crear();
    await store.createAccount('Rudeus', 'roxy1234');
    expect(await store.verify('Rudeus', 'otra')).toBe(null);
    expect(await store.verify('Nadie', 'roxy1234')).toBe(null);
  });

  it('el nombre no distingue mayúsculas y no se puede repetir', async () => {
    const store = await crear();
    await store.createAccount('Rudeus', 'roxy1234');
    await expect(store.createAccount('rudeus', 'otra')).rejects.toBeInstanceOf(StoreError);
  });

  it('guarda un personaje y lo devuelve igual', async () => {
    const store = await crear();
    const cuenta = await store.createAccount('Noor', 'parry123');
    const personaje = newCharacter('p1', cuenta, 'Noor', 'guardian');
    await store.createCharacter(cuenta, personaje);
    const recuperado = await store.load(cuenta, 'p1');
    expect(recuperado).toMatchObject({ id: 'p1', name: 'Noor', level: 1 });
    expect(recuperado?.zoneId).toBe(personaje.zoneId);
  });

  it('guarda y elimina un party persistente por cualquiera de sus miembros', async () => {
    const store = await crear();
    const party = { id: 'party-1', leaderId: 'p1', members: [
      { id: 'p1', name: 'Noor', joinedAt: 1 }, { id: 'p2', name: 'Rudeus', joinedAt: 2 },
    ] };
    await store.saveParty(party);
    expect(await store.partyFor('p2')).toEqual(party);
    await store.deleteParty(party.id);
    expect(await store.partyFor('p1')).toBe(null);
  });

  it('la lista muestra nivel y zona, que es lo que ve el jugador al volver', async () => {
    const store = await crear();
    const cuenta = await store.createAccount('Noor', 'parry123');
    const personaje = newCharacter('p1', cuenta, 'Noor', 'archer');
    personaje.level = 7;
    await store.createCharacter(cuenta, personaje);
    const lista = await store.listCharacters(cuenta);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: 'p1', level: 7, classId: 'archer', weapon: 'arco', affinity: null });
    expect(lista[0].zoneId).toBe(personaje.zoneId);
  });

  it(`no deja pasar de ${MAX_CHARACTERS} personajes`, async () => {
    const store = await crear();
    const cuenta = await store.createAccount('Noor', 'parry123');
    for (let i = 0; i < MAX_CHARACTERS; i++)
      await store.createCharacter(cuenta, newCharacter(`p${i}`, cuenta, `P${i}`, 'guardian'));
    await expect(
      store.createCharacter(cuenta, newCharacter('extra', cuenta, 'Extra', 'guardian')),
    ).rejects.toMatchObject({ code: 'limite-personajes' });
    expect(await store.listCharacters(cuenta)).toHaveLength(MAX_CHARACTERS);
  });

  it('guardar el progreso pisa lo anterior', async () => {
    const store = await crear();
    const cuenta = await store.createAccount('Noor', 'parry123');
    const personaje = newCharacter('p1', cuenta, 'Noor', 'mage');
    await store.createCharacter(cuenta, personaje);
    personaje.level = 12;
    personaje.x = 2400;
    await store.save(personaje);
    const recuperado = await store.load(cuenta, 'p1');
    expect(recuperado?.level).toBe(12);
    expect(recuperado?.x).toBe(2400);
  });

  it('los personajes de una cuenta no se ven desde otra', async () => {
    const store = await crear();
    const mia = await store.createAccount('Noor', 'parry123');
    const ajena = await store.createAccount('Otro', 'clave123');
    await store.createCharacter(mia, newCharacter('p1', mia, 'Noor', 'guardian'));
    expect(await store.listCharacters(ajena)).toHaveLength(0);
    expect(await store.load(ajena, 'p1')).toBe(null);
  });

  it('elimina definitivamente solo personajes propios y libera su espacio', async () => {
    const store = await crear();
    const mia = await store.createAccount('Noor', 'parry123');
    const ajena = await store.createAccount('Otra', 'clave123');
    await store.createCharacter(mia, newCharacter('p1', mia, 'Valorian', 'mage'));
    await expect(store.deleteCharacter(ajena, 'p1')).rejects.toMatchObject({ code: 'no-existe' });
    expect(await store.load(mia, 'p1')).not.toBeNull();
    await store.deleteCharacter(mia, 'p1');
    expect(await store.load(mia, 'p1')).toBeNull();
    expect(await store.listCharacters(mia)).toHaveLength(0);
    await store.createCharacter(mia, newCharacter('p2', mia, 'Nuevo', 'guardian'));
    expect(await store.listCharacters(mia)).toHaveLength(1);
  });

  it('lo guardado y lo que se juega no comparten objetos: el progreso sin guardar no se filtra', async () => {
    const store = await crear();
    const cuenta = await store.createAccount('Noor', 'parry123');
    const vivo = newCharacter('p1', cuenta, 'Noor', 'mage');
    await store.createCharacter(cuenta, vivo);
    // Mutating the live character after saving must not reach the store...
    vivo.stats.might = 99;
    vivo.trees.push('lobo');
    const cargado = await store.load(cuenta, 'p1');
    expect(cargado?.stats.might).toBe(3);
    expect(cargado?.trees).toEqual([]);
    // ...and mutating what load() returned must not reach it either.
    cargado!.stats.vigor = 77;
    cargado!.skills.parada.level = 9;
    const otra = await store.load(cuenta, 'p1');
    expect(otra?.stats.vigor).toBe(3);
    expect(otra?.skills.parada.level).toBe(1);
  });

  it('dos altas simultáneas con el mismo nombre: entra una sola', async () => {
    const store = await crear();
    const resultados = await Promise.allSettled([
      store.createAccount('Gemelo', 'clave123'),
      store.createAccount('gemelo', 'clave456'),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});

describe('guardado de personajes', () => {
  it('la clave se guarda hasheada con sal propia, nunca en claro', async () => {
    const hash = await hashPassword('roxy1234');
    expect(hash).not.toContain('roxy1234');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('roxy1234', hash)).toBe(true);
    expect(await verifyPassword('otra', hash)).toBe(false);
    // Two accounts with the same password must not share a hash.
    expect(await hashPassword('roxy1234')).not.toBe(hash);
  });

  it('un hash con formato roto no deja entrar', async () => {
    expect(await verifyPassword('roxy1234', 'texto-cualquiera')).toBe(false);
    expect(await verifyPassword('roxy1234', 'scrypt$solo-sal')).toBe(false);
  });
});
