import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { RULES, idleInput, solid, type Zombie } from '@bandera/shared';
import { World, newCharacter, worldInput, type Creation } from '@bandera/shared/world';
import { WEAPON_IDS } from '@bandera/shared/rpg/character';
import { WEAPON_PROFILE } from '@bandera/shared/rpg/weapons';
import { COMBO_SKILLS, comboId } from '@bandera/shared/rpg/combos';
import { AFFINITIES, AFFINITY_PASSIVES, CHANNEL_LEVEL, DESTINY_POOL, SKILLS_WORLD, affinityBonus, destinyWeight, rollDestiny, type Affinity } from '@bandera/shared/rpg/skills';
import { ITEMS } from '@bandera/shared/rpg/items';
import { MOB_FAMILIES } from '@bandera/shared/rpg/mobs';
import { worldTerrain } from '@bandera/shared/rpg/terrain';

/**
 * The contract of choices: whatever is picked at birth — a weapon, where the three sparks go —
 * shows in how the character looks, how it attacks, and what fate and the trees hand it.
 */

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Every way to place three sparks: all in one, two and one, one each (a sample of those). */
function sparkings(): Partial<Record<Affinity, number>>[] {
  const out: Partial<Record<Affinity, number>>[] = [];
  for (const a of AFFINITIES) {
    out.push({ [a]: 3 });
    for (const b of AFFINITIES) if (b !== a) out.push({ [a]: 2, [b]: 1 });
  }
  for (let i = 0; i < AFFINITIES.length; i++) out.push({ [AFFINITIES[i]]: 1, [AFFINITIES[(i + 3) % 10]]: 1, [AFFINITIES[(i + 6) % 10]]: 1 });
  return out;
}

function quietSpot(world: World) {
  const ground = worldTerrain('bosque');
  for (let y = 400; y < ground.bounds.maxY - 400; y += 40)
    for (let x = 600; x < ground.bounds.maxX - 400; x += 40) {
      let ok = true;
      for (let d = -80; d <= 160 && ok; d += 20) ok = !solid(x + d, y, 40, ground) && !solid(x + d, y - 60, 40, ground) && !solid(x + d, y + 60, 40, ground);
      if (ok) return { x, y };
    }
  throw new Error('sin lugar tranquilo');
}

/** A character born with a creation and a destiny, alone with one monster right in front. */
function born(creation: Creation, skillId: string) {
  // The wild, not the valley: in a sanctuary no blow lands.
  const world = new World('bosque');
  world.random = seeded(3);
  world.state.zombies = [];
  const c = newCharacter('h', 'cuenta', 'Noor', 'guardian', creation, { skillId, rarity: SKILLS_WORLD[skillId].rarity });
  const at = quietSpot(world);
  Object.assign(c, at);
  const p = world.join(c);
  p.invuln = 999;
  p.mana = p.maxMana = 100;
  const z = (world as unknown as { newZombie(o: object, at: object, f: object, extra: object): Zombie }).newZombie(
    // Wild, but of no camp: a camp's leash would pull it home and make it forget every chase.
    { id: 'wild:bosque:prueba', team: 'red', angle: Math.PI },
    { x: at.x + 30, y: at.y },
    { x: at.x + 30, y: at.y },
    { family: 'jabali', faction: 'monster', level: 1, hp: 50, maxHp: 50, name: MOB_FAMILIES.jabali.name },
  );
  z.hp = z.maxHp = 50;
  world.state.zombies.push(z);
  return { world, c, p, z };
}

describe('el arma elegida se ve y ataca como esa arma', () => {
  it('cada arma tiene un aspecto propio y un ataque acorde', () => {
    const looks = new Set(WEAPON_IDS.map((w) => WEAPON_PROFILE[w].look));
    expect(looks.size).toBe(WEAPON_IDS.length);
    expect(WEAPON_PROFILE.daga).toMatchObject({ attack: 'melee', stat: 'agility', look: 'picaro' });
    expect(WEAPON_PROFILE.arco).toMatchObject({ attack: 'ranged', look: 'arquero' });
    expect(WEAPON_PROFILE.baston).toMatchObject({ attack: 'spell', stat: 'spirit' });
  });

  it('el clic de la daga es un golpe cuerpo a cuerpo, nunca una flecha', () => {
    const click = worldInput({ ...idleInput(), shot: true }, 'daga');
    expect(click.sword).toBe(true);
    expect(click.shot).toBe(false);
    expect(worldInput({ ...idleInput(), shot: true }, 'arco').shot).toBe(true);
  });

  it('el personaje en el mundo lleva el aspecto de su arma', () => {
    for (const weapon of WEAPON_IDS) {
      const { p } = born({ sparks: { fuerza: 3 }, weapon }, 'parada');
      expect(p.look, weapon).toBe(WEAPON_PROFILE[weapon].look);
    }
  });
});

describe('arma × afinidad: una habilidad por cada cruce', () => {
  it('existen los 50 cruces, con su escuela, su arma y su ícono', () => {
    for (const weapon of WEAPON_IDS)
      for (const affinity of AFFINITIES) {
        const skill = SKILLS_WORLD[comboId(weapon, affinity)];
        expect(skill, `${weapon}×${affinity}`).toBeTruthy();
        expect(skill.school).toBe(affinity);
        expect(skill.weapon).toBe(weapon);
        expect(skill.effect.kind).toBe('imbue');
        expect(existsSync(`packages/client/public/assets/icons/${skill.icon}.svg`), skill.icon).toBe(true);
      }
    expect(Object.keys(COMBO_SKILLS)).toHaveLength(50);
    expect(SKILLS_WORLD.combo_daga_rayo.name).toBe('Daga Electrizante');
  });

  it('los cruces no se leen en grimorios: se canalizan', () => {
    for (const id of Object.keys(COMBO_SKILLS)) expect(ITEMS[`grimorio:${id}`], id).toBeUndefined();
  });

  it('toda habilidad de afinidad puede canalizarse en el arma', () => {
    for (const skill of Object.values(SKILLS_WORLD)) {
      const canal = skill.tree.some((n) => n.grants.channel);
      expect(canal, skill.id).toBe(!skill.weapon && AFFINITIES.includes(skill.school as Affinity));
    }
  });
});

describe('el destino sigue las elecciones', () => {
  it('sortea todas las habilidades propias del personaje en su rareza, sin duplicados', () => {
    const ids = Object.values(DESTINY_POOL).flat();
    expect(new Set(ids).size).toBe(ids.length);
    for (const skill of Object.values(SKILLS_WORLD)) {
      if (skill.school === 'monstruo' || skill.id.startsWith('combo_')) continue;
      expect(DESTINY_POOL[skill.rarity].includes(skill.id), skill.id).toBe(true);
    }
    for (const [rarity, pool] of Object.entries(DESTINY_POOL))
      for (const id of pool) expect(SKILLS_WORLD[id]?.rarity, id).toBe(rarity);
  });

  it('Singularidad entra al sorteo y a los grimorios solo para bastón con Sombra', () => {
    const skill = SKILLS_WORLD.singularidad;
    expect(DESTINY_POOL.rara).toContain(skill.id);
    expect(destinyWeight(skill, { weapon: 'baston', sparks: { sombra: 3 } })).toBeGreaterThan(0);
    expect(destinyWeight(skill, { weapon: 'espada', sparks: { sombra: 3 } })).toBe(0);
    expect(destinyWeight(skill, { weapon: 'baston', sparks: { fuego: 3 } })).toBe(0);
    expect(ITEMS['grimorio:singularidad']?.grimoire).toEqual({ kind: 'teach', skillId: 'singularidad' });
  });
  it('para cada arma y cada reparto de chispas, casi todo lo que toca es de lo elegido', () => {
    const random = seeded(77);
    for (const weapon of WEAPON_IDS)
      for (const sparks of sparkings()) {
        let own = 0;
        const N = 300;
        for (let i = 0; i < N; i++) {
          const skill = SKILLS_WORLD[rollDestiny(random, { sparks, weapon }).skillId];
          if (skill.weapon) expect(skill.weapon, `${weapon} ${JSON.stringify(sparks)}`).toBe(weapon);
          if (skill.school in sparks || skill.school === 'cuerpo') own++;
        }
        expect(own / N, `${weapon} ${JSON.stringify(sparks)}`).toBeGreaterThan(0.6);
      }
  });

  it('2 Rayo + 1 Sigilo con daga: la Daga Electrizante es de lo más probable', () => {
    const random = seeded(11);
    const counts = new Map<string, number>();
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const id = rollDestiny(random, { sparks: { rayo: 2, sigilo: 1 }, weapon: 'daga' }).skillId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const electrizante = (counts.get('combo_daga_rayo') ?? 0) / N;
    expect(electrizante).toBeGreaterThan(0.2);
    const top = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    expect(top).toBe('combo_daga_rayo');
  });
});

describe('la Daga Electrizante electrifica lo que golpea', () => {
  const creation: Creation = { sparks: { rayo: 2, sigilo: 1 }, weapon: 'daga' };

  /** Clicks with the dagger at a monster held in place right in front, so its brain cannot walk off. */
  function stab(world: World, p: { x: number; y: number }, z: Zombie, seconds: number) {
    for (let i = 0; i < ticks(seconds); i++) {
      Object.assign(z, { x: p.x + 30, y: p.y, retarget: 99 });
      world.step(new Map([['h', { ...idleInput(), angle: 0, shot: true }]]));
    }
  }

  it('cargar la daga la electriza, y el golpe aturde y pega más', () => {
    const plano = born(creation, 'combo_daga_rayo');
    const hp0 = plano.z.hp;
    plano.world.damageZombie(plano.z, plano.p.team, 1, 0, 'h');
    const sinCarga = hp0 - plano.z.hp;
    expect(plano.z.frozenLeft).toBe(0);

    const cargado = born(creation, 'combo_daga_rayo');
    cargado.world.cast('h', 'e', { x: cargado.z.x, y: cargado.z.y });
    cargado.world.step(new Map());
    expect(cargado.p.imbue).toBe(SKILLS_WORLD.combo_daga_rayo.color);
    const hp1 = cargado.z.hp;
    cargado.world.damageZombie(cargado.z, cargado.p.team, 1, 0, 'h');
    expect(hp1 - cargado.z.hp).toBeGreaterThan(sinCarga);
    expect(cargado.z.frozenLeft).toBeGreaterThan(0);
    expect(cargado.world.state.events.some((e) => e.kind === 'imbue')).toBe(true);
  });

  it('con el clic de la daga, de verdad: el golpe electrizado cultiva el Rayo', () => {
    const { world, c, p, z } = born(creation, 'combo_daga_rayo');
    world.cast('h', 'e', { x: z.x, y: z.y });
    world.step(new Map());
    const xp = c.affinities.rayo!.xp;
    let aturdido = false;
    let chispas = false;
    for (let i = 0; i < 3 && !aturdido; i++) {
      stab(world, p, z, 0.5);
      aturdido = z.frozenLeft > 0;
      chispas ||= world.state.events.some((e) => e.kind === 'imbue' && e.color === SKILLS_WORLD.combo_daga_rayo.color);
    }
    expect(aturdido).toBe(true);
    expect(chispas).toBe(true);
    expect(c.affinities.rayo!.xp).toBeGreaterThan(xp);
  });

  it('la carga se apaga sola, y un hechizo no se electriza', () => {
    const { world, p, z } = born(creation, 'combo_daga_rayo');
    world.cast('h', 'e', { x: z.x, y: z.y });
    world.step(new Map());
    for (let i = 0; i < ticks(8.5); i++) world.step(new Map());
    expect(p.imbue).toBeUndefined();
    world.damageZombie(z, p.team, 1, 0, 'h');
    expect(z.frozenLeft).toBe(0);
  });

  it('con otra arma en la mano, el cruce no responde', () => {
    const { world, p, z } = born({ sparks: { viento: 3 }, weapon: 'daga' }, 'combo_arco_viento');
    world.cast('h', 'e', { x: z.x, y: z.y });
    world.step(new Map());
    expect(p.imbue).toBeUndefined();
    expect(world.notices.some((n) => n.kind === 'denied' && n.text.includes('un arco'))).toBe(true);
  });
});

describe('Canalizar en el arma', () => {
  it('canalizar una habilidad de Rayo con una daga enseña la Daga Electrizante', () => {
    const { world, c } = born({ sparks: { rayo: 2, sigilo: 1 }, weapon: 'daga' }, 'chispazo');
    c.skills.chispazo.level = CHANNEL_LEVEL;
    c.skillPoints = 5;
    const check = world.learn('h', 'chispazo', 'chispazo:canalizar');
    expect(check.ok).toBe(true);
    expect(c.skills.combo_daga_rayo).toBeTruthy();
    expect(world.setSlot('h', 'e', 'combo_daga_rayo')).toBe(true);
  });

  it('con un arco, la misma canalización enseña el cruce del arco', () => {
    const { world, c } = born({ sparks: { rayo: 3 }, weapon: 'arco' }, 'chispazo');
    c.skills.chispazo.level = CHANNEL_LEVEL;
    c.skillPoints = 5;
    world.learn('h', 'chispazo', 'chispazo:canalizar');
    expect(c.skills.combo_arco_rayo).toBeTruthy();
    expect(c.skills.combo_daga_rayo).toBeUndefined();
  });
});

describe('cada chispa deja una pasiva que siempre está', () => {
  const sheet = (sparks: Creation['sparks']) => born({ sparks, weapon: 'espada' }, 'parada');

  it('cada afinidad declara su pasiva, y cambia el número que dice cambiar', () => {
    for (const a of AFFINITIES) {
      const passive = AFFINITY_PASSIVES[a];
      expect(passive.name, a).toBeTruthy();
      const one = affinityBonus({ [a]: { points: 1, xp: 0, cultivation: 1 } });
      const three = affinityBonus({ [a]: { points: 3, xp: 0, cultivation: 1 } });
      const changed = (Object.keys(passive.per) as (keyof typeof one)[]).filter((k) => one[k] > 0);
      expect(changed.length, a).toBeGreaterThan(0);
      for (const k of changed) expect(three[k], `${a}.${k}`).toBeGreaterThan(one[k]);
    }
  });

  it('Tierra da más vida y Fuego pega más que quien no las eligió', () => {
    const tierra = sheet({ tierra: 3 });
    const nada = sheet({ destreza: 3 });
    expect(tierra.p.maxHp).toBeGreaterThan(nada.p.maxHp);
    const fuego = sheet({ fuego: 3 });
    expect(fuego.world.bonusesOf(fuego.c).damage).toBeGreaterThan(nada.world.bonusesOf(nada.c).damage);
  });

  it('Sigilo: el monstruo no te nota a una distancia a la que sí nota a otro', () => {
    const noticed = (sparks: Creation['sparks']) => {
      const { world, p, z } = sheet(sparks);
      const aggro = MOB_FAMILIES.jabali.aggro;
      Object.assign(z, { x: p.x + aggro * 0.8, y: p.y, target: null, retarget: 0, spawnLeft: 0 });
      for (let i = 0; i < 10; i++) world.step(new Map());
      return z.target === 'h';
    };
    expect(noticed({ fuerza: 3 })).toBe(true);
    expect(noticed({ sigilo: 3 })).toBe(false);
  });
});
