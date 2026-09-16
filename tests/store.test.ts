import { describe, it, expect } from 'vitest';
import { newCharacter } from '@bandera/shared/world';
import {
  MAX_CHARACTERS,
  MemoryStore,
  StoreError,
  hashPassword,
  verifyPassword,
  type CharacterStore,
} from '../packages/server/src/store/characters.js';

/**
 * One contract suite, run against the in-memory driver. A Postgres driver reuses it verbatim by
 * passing its own factory, which is the point of keeping the interface narrow.
 */
function describeStore(nombre: string, crear: () => CharacterStore) {
  describe(nombre, () => {
    it('crea una cuenta y entra con la clave correcta', async () => {
      const store = crear();
      const id = await store.createAccount('Rudeus', 'roxy1234');
      expect(await store.verify('Rudeus', 'roxy1234')).toBe(id);
    });

    it('rechaza la clave equivocada y la cuenta que no existe', async () => {
      const store = crear();
      await store.createAccount('Rudeus', 'roxy1234');
      expect(await store.verify('Rudeus', 'otra')).toBe(null);
      expect(await store.verify('Nadie', 'roxy1234')).toBe(null);
    });

    it('el nombre no distingue mayúsculas y no se puede repetir', async () => {
      const store = crear();
      await store.createAccount('Rudeus', 'roxy1234');
      await expect(store.createAccount('rudeus', 'otra')).rejects.toBeInstanceOf(StoreError);
    });

    it('guarda un personaje y lo devuelve igual', async () => {
      const store = crear();
      const cuenta = await store.createAccount('Noor', 'parry123');
      const personaje = newCharacter('p1', cuenta, 'Noor', 'guardian');
      await store.createCharacter(cuenta, personaje);
      const recuperado = await store.load(cuenta, 'p1');
      expect(recuperado).toMatchObject({ id: 'p1', name: 'Noor', level: 1 });
      expect(recuperado?.zoneId).toBe(personaje.zoneId);
    });

    it('la lista muestra nivel y zona, que es lo que ve el jugador al volver', async () => {
      const store = crear();
      const cuenta = await store.createAccount('Noor', 'parry123');
      const personaje = newCharacter('p1', cuenta, 'Noor', 'archer');
      personaje.level = 7;
      await store.createCharacter(cuenta, personaje);
      const lista = await store.listCharacters(cuenta);
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({ id: 'p1', level: 7, classId: 'archer' });
      expect(lista[0].zoneId).toBe(personaje.zoneId);
    });

    it(`no deja pasar de ${MAX_CHARACTERS} personajes`, async () => {
      const store = crear();
      const cuenta = await store.createAccount('Noor', 'parry123');
      for (let i = 0; i < MAX_CHARACTERS; i++)
        await store.createCharacter(cuenta, newCharacter(`p${i}`, cuenta, `P${i}`, 'guardian'));
      await expect(
        store.createCharacter(cuenta, newCharacter('extra', cuenta, 'Extra', 'guardian')),
      ).rejects.toMatchObject({ code: 'limite-personajes' });
      expect(await store.listCharacters(cuenta)).toHaveLength(MAX_CHARACTERS);
    });

    it('guardar el progreso pisa lo anterior', async () => {
      const store = crear();
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
      const store = crear();
      const mia = await store.createAccount('Noor', 'parry123');
      const ajena = await store.createAccount('Otro', 'clave123');
      await store.createCharacter(mia, newCharacter('p1', mia, 'Noor', 'guardian'));
      expect(await store.listCharacters(ajena)).toHaveLength(0);
      expect(await store.load(ajena, 'p1')).toBe(null);
    });
  });
}

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

  describeStore('MemoryStore', () => new MemoryStore());
});
