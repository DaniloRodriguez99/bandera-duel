import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  DESTINY_POOL,
  MONSTER_TREES,
  RANKS,
  SKILLS_WORLD,
  canLearn,
  cultivate,
  effectiveSkill,
  rankOf,
  refusalFor,
  rollDestiny,
  schoolOpen,
  skillName,
  usesToLevel,
  type AffinityState,
  type SkillProgress,
} from '@bandera/shared/rpg/skills';
import { BASE_STATS } from '@bandera/shared/rpg/progression';
import { MOB_FAMILIES } from '@bandera/shared/rpg/mobs';

const fresh = (level = 1, nodes: string[] = []): SkillProgress => ({ level, uses: 0, nodes });
/** A dice that returns the given values in order. */
const dice = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('habilidades del mundo', () => {
  it('la tirada del destino respeta los cortes de rareza', () => {
    expect(rollDestiny(dice(0.02, 0)).rarity).toBe('legendaria');
    expect(rollDestiny(dice(0.1, 0)).rarity).toBe('epica');
    expect(rollDestiny(dice(0.3, 0)).rarity).toBe('rara');
    expect(rollDestiny(dice(0.9, 0)).rarity).toBe('comun');
    for (const r of [0.02, 0.1, 0.3, 0.9]) {
      const { skillId, rarity } = rollDestiny(dice(r, 0.99));
      expect(DESTINY_POOL[rarity as keyof typeof DESTINY_POOL]).toContain(skillId);
    }
  });

  it('el destino sigue un guion: las chispas y el arma pesan, pero queda lugar para la sorpresa', () => {
    let seed = 12345;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const elegido = { sparks: { agua: 1, viento: 1, fuerza: 1 }, weapon: 'espada' };
    const escuelas = new Map<string, number>();
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const school = SKILLS_WORLD[rollDestiny(random, elegido).skillId].school;
      escuelas.set(school, (escuelas.get(school) ?? 0) + 1);
    }
    const propias = ['agua', 'viento', 'fuerza'].reduce((sum, a) => sum + (escuelas.get(a) ?? 0), 0);
    expect(propias / N).toBeGreaterThan(0.65);
    // The parry is a body skill: possible, never the likely answer to water, wind and strength.
    expect((escuelas.get('cuerpo') ?? 0) / N).toBeLessThan(0.12);
    const ajenas = [...escuelas].filter(([school]) => !['agua', 'viento', 'fuerza', 'cuerpo', 'destreza'].includes(school));
    expect(ajenas.reduce((sum, [, n]) => sum + n, 0)).toBeGreaterThan(0);

    const fuego = { sparks: { fuego: 3 }, weapon: 'baston' };
    let deFuego = 0;
    for (let i = 0; i < N; i++) if (SKILLS_WORLD[rollDestiny(random, fuego).skillId].school === 'fuego') deFuego++;
    expect(deFuego / N).toBeGreaterThan(0.6);
  });

  it('cada afinidad tiene al menos una habilidad común con la que nacer', () => {
    for (const affinity of ['fuego', 'agua', 'tierra', 'viento', 'rayo', 'sombra', 'luz', 'fuerza', 'destreza', 'sigilo'])
      expect(DESTINY_POOL.comun.some((id) => SKILLS_WORLD[id].school === affinity), affinity).toBe(true);
  });

  it('el destino nunca reparte árboles de monstruo', () => {
    for (const pool of Object.values(DESTINY_POOL))
      for (const id of pool) {
        expect(SKILLS_WORLD[id], id).toBeTruthy();
        expect(SKILLS_WORLD[id].school, id).not.toBe('monstruo');
      }
  });

  it('las comunes tienen el camino más largo y terminan más arriba que las legendarias', () => {
    const road = (id: string) => {
      const skill = SKILLS_WORLD[id];
      let total = 0;
      for (let level = 1; level < skill.maxLevel; level++) total += usesToLevel(skill, level);
      return { levels: skill.maxLevel, total };
    };
    expect(road('parada').levels).toBeGreaterThan(road('mil_espadas').levels);
    expect(road('parada').total).toBeGreaterThan(road('mil_espadas').total);
    expect(usesToLevel(SKILLS_WORLD.parada, 5)).toBeGreaterThan(usesToLevel(SKILLS_WORLD.parada, 1));
  });

  it('la Parada cambia de nombre al evolucionar', () => {
    expect(skillName(SKILLS_WORLD.parada, 1)).toBe('Parada');
    expect(skillName(SKILLS_WORLD.parada, 4)).toBe('Parada Fluida');
    expect(skillName(SKILLS_WORLD.parada, 11)).toBe('Contraparada');
    expect(skillName(SKILLS_WORLD.parada, 12)).toBe('Parada Absoluta');
  });

  it('aprender un nodo pide nivel, puntos, previas y atributos', () => {
    const parada = SKILLS_WORLD.parada;
    expect(canLearn(parada, fresh(1), 'parada:1', 5, BASE_STATS).reason).toMatch(/nivel 2/);
    expect(canLearn(parada, fresh(2), 'parada:1', 0, BASE_STATS).reason).toMatch(/puntos/);
    expect(canLearn(parada, fresh(2), 'parada:1', 1, BASE_STATS).ok).toBe(true);
    expect(canLearn(parada, fresh(4), 'parada:2', 5, BASE_STATS).reason).toMatch(/Reflejo/);
    // Parada de Hierro asks for Vigor 8; a child has 3.
    expect(canLearn(parada, fresh(4, ['parada:1']), 'parada:3', 5, BASE_STATS).reason).toMatch(/Vigor 8/);
  });

  it('elegir una rama cierra la otra para siempre', () => {
    const parada = SKILLS_WORLD.parada;
    const fuerte = { ...BASE_STATS, vigor: 20 };
    const progreso = fresh(4, ['parada:1', 'parada:2']);
    const otra = canLearn(parada, progreso, 'parada:3', 9, fuerte);
    expect(otra.ok).toBe(false);
    expect(otra.reason).toMatch(/cerrado para siempre/);
  });

  it('el nivel y los nodos cambian lo que la skill hace de verdad', () => {
    const chispa = SKILLS_WORLD.chispa;
    const base = effectiveSkill(chispa, fresh(1));
    const entrenada = effectiveSkill(chispa, fresh(6, ['chispa:1', 'chispa:3']));
    expect(entrenada.mana).toBeLessThan(base.mana);
    expect(entrenada.cooldown).toBeLessThan(base.cooldown);
    expect(entrenada.effect.kind).toBe('bolt');
    if (entrenada.effect.kind === 'bolt' && base.effect.kind === 'bolt') {
      expect(entrenada.effect.damage).toBeGreaterThan(base.effect.damage);
      expect(entrenada.effect.pierce).toBe(true);
      expect(base.effect.pierce).toBeFalsy();
    }
    expect(entrenada.name).toBe('Lanza de Fuego');
  });

  it('el cultivo crece rápido de chico, lento de joven y nada de adulto', () => {
    const chico: AffinityState = { points: 1, xp: 0, cultivation: 1 };
    for (let i = 0; i < 500; i++) cultivate(chico, 5);
    expect(chico.cultivation).toBe(3);
    const joven: AffinityState = { points: 1, xp: 0, cultivation: 1 };
    for (let i = 0; i < 500; i++) cultivate(joven, 15);
    expect(joven.cultivation).toBeGreaterThan(1);
    expect(joven.cultivation).toBeLessThanOrEqual(1.8);
    const adulto: AffinityState = { points: 1, xp: 0, cultivation: 1 };
    for (let i = 0; i < 500; i++) cultivate(adulto, 25);
    expect(adulto.cultivation).toBe(1);
  });

  it('los siete rangos de Mushoku Tensei', () => {
    expect(RANKS).toHaveLength(7);
    expect(RANKS[rankOf(0)]).toBe('Principiante');
    expect(RANKS[rankOf(700)]).toBe('Santo');
    expect(RANKS[rankOf(1e9)]).toBe('Dios');
  });

  it('una escuela cerrada no deja lanzar, y lo dice con la voz del Sistema', () => {
    expect(schoolOpen(SKILLS_WORLD.chispa, {}, [])).toBe(false);
    expect(schoolOpen(SKILLS_WORLD.chispa, { fuego: { points: 1, xp: 0, cultivation: 1 } }, [])).toBe(true);
    expect(schoolOpen(SKILLS_WORLD.parada, {}, [])).toBe(true);
    expect(schoolOpen(SKILLS_WORLD.devorar, {}, [])).toBe(false);
    expect(schoolOpen(SKILLS_WORLD.devorar, {}, ['ghoul'])).toBe(true);
    expect(refusalFor('fuego')).toBe('Tu cuerpo no reconoce el flujo del fuego.');
  });

  it('cada árbol de monstruo apunta a una familia y a skills que existen', () => {
    for (const [family, tree] of Object.entries(MONSTER_TREES)) {
      expect(MOB_FAMILIES[family as keyof typeof MOB_FAMILIES], family).toBeTruthy();
      expect(tree.passive.name, family).toBeTruthy();
      for (const id of tree.skills) {
        expect(SKILLS_WORLD[id], `${family}: ${id}`).toBeTruthy();
        expect(SKILLS_WORLD[id].school, `${family}: ${id}`).toBe('monstruo');
      }
    }
  });

  it('cada nodo apunta a previas y ramas de su propio árbol, y cada ícono existe', () => {
    for (const skill of Object.values(SKILLS_WORLD)) {
      const ids = new Set(skill.tree.map((n) => n.id));
      for (const n of skill.tree) {
        expect(n.id.startsWith(`${skill.id}:`), n.id).toBe(true);
        for (const required of n.requires ?? []) expect(ids.has(required), `${n.id} → ${required}`).toBe(true);
      }
      expect(existsSync(`packages/client/public/assets/icons/${skill.icon}.svg`), skill.icon).toBe(true);
      for (let i = 1; i < skill.evolutions.length; i++)
        expect(skill.evolutions[i].level, skill.id).toBeGreaterThan(skill.evolutions[i - 1].level);
    }
  });
});
