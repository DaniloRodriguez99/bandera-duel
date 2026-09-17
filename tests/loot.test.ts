import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { newCharacter, normalizeCharacter, WEAPON_IDS, type Character } from '@bandera/shared/world';
import { CHEST_TIERS, rollLoot, type ChestTier } from '@bandera/shared/rpg/loot';
import { COPY_CHARGE_CAP, ITEMS, STARTER_WEAPON, describeBonus, equipmentBonus, statsWithEquipment } from '@bandera/shared/rpg/items';
import { SKILLS_WORLD } from '@bandera/shared/rpg/skills';

/** A small seedable generator, so a thousand rolls are the same thousand rolls every run. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const character = () => newCharacter('p', 'a', 'Rudeus', 'guardian', { sparks: { fuego: 3 }, weapon: 'baston' }, { skillId: 'chispa', rarity: 'comun' });

describe('botín de cofres', () => {
  it('cada tipo de cofre respeta cuántas cosas da y nunca pasa su máximo', () => {
    const expected: Record<ChestTier, [number, number]> = { comun: [1, 2], raro: [2, 2], legendario: [3, 3] };
    for (const tier of Object.keys(CHEST_TIERS) as ChestTier[]) {
      const random = seeded(7);
      for (let i = 0; i < 2000; i++) {
        const drops = rollLoot({ tier, campLevel: 10, character: character(), random });
        expect(drops.length).toBeGreaterThanOrEqual(expected[tier][0]);
        expect(drops.length).toBeLessThanOrEqual(Math.min(expected[tier][1], CHEST_TIERS[tier].maxDrops));
        for (const id of drops) expect(ITEMS[id]).toBeTruthy();
      }
    }
  });

  it('un cofre común nunca da épicas, legendarias ni fragmentos de reflejo', () => {
    const random = seeded(11);
    const conOjo = character();
    conOjo.skills.ojo_impostor = { level: 1, uses: 0, nodes: [] };
    for (let i = 0; i < 2000; i++)
      for (const id of rollLoot({ tier: 'comun', campLevel: 4, character: conOjo, random })) {
        expect(['comun', 'rara']).toContain(ITEMS[id].rarity);
        expect(id).not.toBe('fragmento_reflejo');
      }
  });

  it('el cofre legendario abre con algo épico o mejor', () => {
    const random = seeded(3);
    for (let i = 0; i < 500; i++) {
      const [first] = rollLoot({ tier: 'legendario', campLevel: 18, character: character(), random });
      expect(['epica', 'legendaria', 'unica']).toContain(ITEMS[first].rarity);
    }
  });

  it('el fragmento de reflejo solo le cae a quien tiene el Ojo del Impostor, y no pasa del tope', () => {
    const always = () => 0;
    expect(rollLoot({ tier: 'legendario', campLevel: 18, character: character(), random: always })).not.toContain('fragmento_reflejo');
    const conOjo = character();
    conOjo.skills.ojo_impostor = { level: 1, uses: 0, nodes: [] };
    expect(rollLoot({ tier: 'legendario', campLevel: 18, character: conOjo, random: always })).toContain('fragmento_reflejo');
    conOjo.copyCharges = COPY_CHARGE_CAP;
    expect(rollLoot({ tier: 'legendario', campLevel: 18, character: conOjo, random: always })).not.toContain('fragmento_reflejo');
  });

  it('los grimorios nunca enseñan habilidades de monstruo, el ojo, ni lo que ya sabés', () => {
    const random = seeded(19);
    const c = character();
    for (let i = 0; i < 3000; i++)
      for (const id of rollLoot({ tier: 'raro', campLevel: 12, character: c, random })) {
        const effect = ITEMS[id].grimoire;
        if (effect?.kind !== 'teach') continue;
        expect(SKILLS_WORLD[effect.skillId].school).not.toBe('monstruo');
        expect(effect.skillId).not.toBe('ojo_impostor');
        expect(c.skills[effect.skillId]).toBeUndefined();
      }
  });

  it('el equipo que cae no pide mucho más nivel que el campamento', () => {
    const random = seeded(23);
    for (let i = 0; i < 1000; i++)
      for (const id of rollLoot({ tier: 'comun', campLevel: 4, character: character(), random }))
        if (ITEMS[id].slot) expect(ITEMS[id].level).toBeLessThanOrEqual(6);
  });

  it('el catálogo es coherente: armas con arma válida, grimorios con habilidad existente, íconos que existen', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.kind === 'arma') {
        expect(WEAPON_IDS).toContain(item.weapon);
        expect(item.slot).toBe('weapon');
      }
      if (item.grimoire?.kind === 'teach') expect(SKILLS_WORLD[item.grimoire.skillId]).toBeTruthy();
      expect(existsSync(`packages/client/public/assets/icons/${item.icon}.svg`)).toBe(true);
    }
    for (const w of WEAPON_IDS) {
      expect(ITEMS[STARTER_WEAPON[w]]).toMatchObject({ weapon: w, starter: true });
    }
  });

  it('los bonos del equipo se suman y se dicen en palabras', () => {
    const c = character();
    c.equipment.armor = { uid: 'i1', itemId: 'cota_malla' };
    c.equipment.amulet = { uid: 'i2', itemId: 'ojo_arana' };
    expect(equipmentBonus(c)).toMatchObject({ damage: 0.05, speed: -0.03 });
    expect(statsWithEquipment(c).vigor).toBe(c.stats.vigor + 3);
    expect(describeBonus(ITEMS.cota_malla.bonus)).toEqual(['+3 Vigor', '−3 % velocidad']);
  });
});

describe('la bolsa en la ficha', () => {
  it('se nace con el arma de nacimiento puesta y la bolsa vacía', () => {
    const c = newCharacter('p', 'a', 'Rentt', 'guardian', { sparks: { sigilo: 3 }, weapon: 'daga' });
    expect(c.equipment.weapon.itemId).toBe('daga_oxidada');
    expect(c.inventory).toEqual([]);
  });

  it('una ficha vieja sin bolsa entra con la bolsa vacía y con SU arma de nacimiento', () => {
    const viejo = { ...newCharacter('p', 'a', 'Rentt', 'archer') } as Partial<Character>;
    viejo.weapon = 'daga';
    delete viejo.inventory;
    delete viejo.equipment;
    delete viejo.itemSerial;
    const una = normalizeCharacter(viejo as Character);
    expect(una.equipment.weapon.itemId).toBe('daga_oxidada');
    expect(una.inventory).toEqual([]);
    expect(una.itemSerial).toBe(1);
    // Travel normalizes again on every join: it must change nothing.
    expect(normalizeCharacter(una)).toEqual(una);
  });

  it('una ficha con objetos nunca vuelve a usar un uid', () => {
    const c = newCharacter('p', 'a', 'Rentt', 'guardian') as Partial<Character>;
    c.inventory = [{ uid: 'i7', itemId: 'jubon_cuero' }];
    delete c.itemSerial;
    expect(normalizeCharacter(c as Character).itemSerial).toBe(8);
  });
});
