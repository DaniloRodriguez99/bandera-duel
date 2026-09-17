import { describe, it, expect } from 'vitest';
import { newCharacter } from '@bandera/shared/world';
import { migrate } from '../packages/server/src/store/migrate.js';
import { SAVE_VERSION } from '../packages/server/src/store/characters.js';

const guardado = () => ({ version: 1, character: newCharacter('p1', 'a1', 'Noor', 'guardian'), updatedAt: 1 });

describe('migración de guardados', () => {
  it('un v1 válido pasa tal cual', () => {
    const raw = guardado();
    const saved = migrate(JSON.parse(JSON.stringify(raw)));
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.character).toEqual(raw.character);
    expect(saved.updatedAt).toBe(1);
  });

  it('a un v1 de antes de las habilidades le completa lo que falta', () => {
    const { character } = guardado();
    const viejo: Record<string, unknown> = { ...character, level: 8 };
    for (const campo of ['skills', 'slots', 'affinities', 'trees', 'passives', 'bonusMana', 'destiny', 'weapon'])
      delete viejo[campo];
    const saved = migrate({ version: 1, character: viejo, updatedAt: 0 });
    expect(saved.character.level).toBe(8);
    expect(saved.character.trees).toEqual([]);
    expect(saved.character.bonusMana).toBe(0);
    expect(saved.character.slots).toMatchObject({ q: null, space: null });
    expect(saved.character.weapon).toBe('espada');
  });

  it('la basura no se convierte en un personaje nuevo: tira save-invalido', () => {
    const rotos: unknown[] = [
      null,
      'texto',
      [],
      { version: 1 },
      { version: 0, character: guardado().character },
      { version: '1', character: guardado().character },
    ];
    const cambios: Record<string, unknown>[] = [
      { id: '' },
      { level: 0 },
      { level: 61 },
      { level: 2.5 },
      { xp: Number.NaN },
      { x: 'lejos' },
      { zoneId: 'narnia' },
      { classId: 'bardo' },
      { weapon: 'banana' },
      { stats: { might: 'mucho' } },
      { trees: 'lobo' },
      { skills: { parada: { level: 1, uses: -1, nodes: [] } } },
      { slots: { e: 42 } },
      { destiny: { skillId: 'parada', rarity: 'divina' } },
    ];
    // Not JSON-roundtripped on purpose: NaN cannot come from a file, but a driver bug can produce it.
    for (const cambio of cambios) rotos.push({ ...guardado(), character: { ...guardado().character, ...cambio } });
    for (const raw of rotos) {
      let error: unknown;
      try {
        migrate(raw);
      } catch (e) {
        error = e;
      }
      expect(error, JSON.stringify(raw)).toMatchObject({ code: 'save-invalido' });
    }
  });

  it('una versión futura no se interpreta a ciegas', () => {
    expect(() => migrate({ ...guardado(), version: SAVE_VERSION + 1 })).toThrow(
      expect.objectContaining({ code: 'save-futuro' }),
    );
  });
});
