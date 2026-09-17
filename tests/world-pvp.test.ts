import { describe, it, expect } from 'vitest';
import { Duel, RULES, blocked, idleInput, lineClear, type Input, type Zombie } from '@bandera/shared';
import {
  INCANTATION_TIME,
  SHRINE_WARD,
  THRALL_HP_SHARE,
  World,
  newCharacter,
  type Character,
  type Creation,
  type Notice,
} from '@bandera/shared/world';
import { SKILLS_WORLD } from '@bandera/shared/rpg/skills';
import { deathPenalty, xpToLevel } from '@bandera/shared/rpg/progression';
import type { ZoneId } from '@bandera/shared/rpg/zones';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Who {
  id: string;
  name?: string;
  skill?: string;
  creation?: Creation;
  at?: { x: number; y: number };
}

function character({ id, name = id, skill = 'parada', creation = { sparks: { fuerza: 3 }, weapon: 'espada' } }: Who) {
  return newCharacter(id, `cuenta-${id}`, name, 'guardian', creation, { skillId: skill, rarity: SKILLS_WORLD[skill].rarity });
}

/**
 * Two characters facing each other in a zone emptied of monsters, far from the shrine, so only
 * what the test does can hurt anyone.
 */
function arena(zoneId: ZoneId, a: Who, b: Who, at = { x: 1300, y: 1000 }, gap = 40) {
  const world = new World(zoneId);
  world.state.zombies = [];
  const ca = character(a);
  const cb = character(b);
  Object.assign(ca, a.at ?? at);
  Object.assign(cb, b.at ?? { x: at.x + gap, y: at.y });
  const pa = world.join(ca);
  const pb = world.join(cb);
  for (const p of [pa, pb]) p.invuln = 0;
  return { world, ca, cb, pa, pb };
}

function run(world: World, count: number, inputs: Record<string, Partial<Input>> = {}) {
  for (let i = 0; i < count; i++) {
    world.state.zombies = world.state.zombies.filter((z) => !z.owner.startsWith('wild:'));
    world.step(new Map(Object.entries(inputs).map(([id, input]) => [id, { ...idleInput(), ...input }])));
  }
}

const seen = (world: World, id: string, kind: Notice['kind']) => world.notices.filter((n) => n.id === id && n.kind === kind);

describe('hostilidad en el mundo', () => {
  it('el lugar de prueba está libre de paredes', () => {
    // Otherwise a wall could swallow an arrow and a "nobody got hurt" test would pass for nothing.
    for (const zoneId of ['bosque', 'umbral'] as const) {
      const { terrain } = new World(zoneId).definition;
      for (const y of [1000, 1400]) {
        expect(blocked(1300, y, RULES.radius, terrain)).toBe(false);
        expect(lineClear({ x: 1300, y }, { x: 1650, y }, terrain)).toBe(true);
      }
    }
  });

  it('en el santuario la espada de un jugador atraviesa a otro sin lastimarlo', () => {
    const { world, pa, pb } = arena('umbral', { id: 'a' }, { id: 'b' });
    run(world, ticks(1), { a: { sword: true, angle: 0 } });
    expect(pb.hp).toBe(pb.maxHp);
    expect(world.damage(pb, pa, 0, 1)).toBe(false);
  });

  it('en zona salvaje dos jugadores se lastiman con el arma', () => {
    const { world, pb } = arena('bosque', { id: 'a' }, { id: 'b' });
    run(world, ticks(1), { a: { sword: true, angle: 0 } });
    expect(pb.hp).toBeLessThan(pb.maxHp);
  });

  it('la flecha de un jugador pega a otro en zona salvaje y lo atraviesa en el santuario', () => {
    const arquero = { sparks: { destreza: 3 }, weapon: 'arco' } as Creation;
    const salvaje = arena('bosque', { id: 'a', creation: arquero }, { id: 'b' }, undefined, 160);
    expect(salvaje.pb.x).toBe(1460);
    run(salvaje.world, 1, { a: { shot: true, angle: 0 } });
    run(salvaje.world, ticks(1));
    expect(salvaje.pb.hp).toBeLessThan(salvaje.pb.maxHp);

    const santuario = arena('umbral', { id: 'a', creation: arquero }, { id: 'b' }, { x: 1400, y: 1400 }, 160);
    run(santuario.world, 1, { a: { shot: true, angle: 0 } });
    expect(santuario.world.state.arrows.some((a) => a.owner === 'a')).toBe(true);
    run(santuario.world, ticks(0.3));
    expect(santuario.pb.hp).toBe(santuario.pb.maxHp);
    // Still flying: it went through instead of stopping on the other character.
    const flecha = santuario.world.state.arrows.find((a) => a.owner === 'a');
    expect(flecha?.x ?? Infinity).toBeGreaterThan(santuario.pb.x);
  });

  it('junto al altar nadie lastima a nadie, ni desde adentro ni hacia adentro', () => {
    const { world, pa, pb } = arena('bosque', { id: 'a' }, { id: 'b' });
    const shrine = world.definition.shrine;
    const dentro = { x: shrine.x + 60, y: shrine.y };
    const fuera = { x: shrine.x + SHRINE_WARD + 60, y: shrine.y };
    Object.assign(pb, dentro);
    Object.assign(pa, fuera);
    expect(world.damage(pb, pa, 0, 1)).toBe(false);
    Object.assign(pa, dentro);
    Object.assign(pb, fuera);
    expect(world.damage(pb, pa, 0, 1)).toBe(false);
    expect(pb.hp).toBe(pb.maxHp);
    Object.assign(pa, { x: fuera.x + 40, y: fuera.y });
    expect(world.damage(pb, pa, 0, 1)).toBe(true);
  });

  it('Trueno golpea a los jugadores enemigos cercanos solo en zona salvaje', () => {
    for (const [zoneId, hurts] of [['bosque', true], ['umbral', false]] as const) {
      const { world, ca, pb } = arena(zoneId, { id: 'a', skill: 'trueno' }, { id: 'b' }, { x: 1400, y: 1400 });
      ca.affinities.rayo!.xp = 700; // silent: it lands on the cast step
      world.cast('a', 'e', { x: pb.x, y: pb.y });
      run(world, 2);
      expect(pb.hp < pb.maxHp).toBe(hurts);
    }
  });

  it('Cura Menor en zona salvaje cura solo a quien la canta; en el santuario, a todos cerca', () => {
    for (const [zoneId, healsOther] of [['bosque', false], ['umbral', true]] as const) {
      const { world, pa, pb } = arena(zoneId, { id: 'a', skill: 'cura_menor' }, { id: 'b' }, { x: 1400, y: 1400 });
      pa.hp = 2;
      pb.hp = 2;
      world.cast('a', 'e', { x: pa.x, y: pa.y });
      run(world, ticks(INCANTATION_TIME) + 2);
      expect(pa.hp).toBeGreaterThan(2);
      expect(pb.hp > 2).toBe(healsOther);
    }
  });

  it('los monstruos atacan a cualquiera y no se pelean entre ellos', () => {
    for (const zoneId of ['umbral', 'bosque'] as const) {
      const world = new World(zoneId);
      const p = world.join(character({ id: 'a' }));
      const [z1, z2] = world.state.zombies;
      const hostile = (x: object, y: object) => (world as unknown as { hostile(a: object, b: object): boolean }).hostile(x, y);
      expect(hostile(z1, p)).toBe(true);
      expect(hostile(p, z1)).toBe(true);
      expect(hostile(z1, z2)).toBe(false);
      // Monsters ignore the shrine's peace.
      Object.assign(p, world.definition.shrine);
      expect(hostile(z1, p)).toBe(true);
    }
  });

  it('la Sombra de un jugador ataca a otros en zona salvaje y nunca a su dueño', () => {
    for (const [zoneId, hurts] of [['bosque', true], ['umbral', false]] as const) {
      const { world, pa, pb } = arena(zoneId, { id: 'a' }, { id: 'b' }, { x: 1400, y: 1400 }, 120);
      pb.invuln = 0;
      // Hunting on its own; guarding, it would only strike inside a small ring around its owner.
      pa.zombieAuto = true;
      const sombra = (world as unknown as { newZombie(o: object, at: object, owner: object, extra: object): Zombie }).newZombie(
        pa,
        { x: pb.x - 30, y: pb.y },
        pa,
        { kind: 'thrall', hp: 6, maxHp: 6, life: 9999, classId: 'guardian', name: 'Sombra', role: 'auto', rise: 0, bushId: null, revealLeft: 0 },
      );
      world.state.zombies.push(sombra);
      let hpA = pa.hp;
      for (let i = 0; i < ticks(3); i++) {
        world.state.zombies = world.state.zombies.filter((z) => !z.owner.startsWith('wild:'));
        world.step(new Map());
        hpA = Math.min(hpA, pa.hp);
        pb.invuln = 0;
      }
      expect(hpA).toBe(pa.maxHp);
      expect(pb.hp < pb.maxHp).toBe(hurts);
    }
  });
});

describe('morir', () => {
  it('morir en zona salvaje cuesta el 10 % del nivel sin bajar de nivel, y avisa cuánto', () => {
    const { world, cb, pa, pb } = arena('bosque', { id: 'a' }, { id: 'b' });
    cb.level = 10;
    cb.xp = 500;
    world.damage(pb, pa, 0, 999);
    const lost = Math.round(xpToLevel(10) * 0.1);
    expect(cb.xp).toBe(500 - lost);
    expect(cb.level).toBe(10);
    expect(seen(world, 'b', 'death').at(-1)!.text).toContain(String(lost));
    expect(world.sheetChanged.has('b')).toBe(true);
  });

  it('con poca experiencia en el nivel, morir la deja en cero y nunca baja de nivel', () => {
    const { world, cb, pa, pb } = arena('bosque', { id: 'a' }, { id: 'b' });
    cb.level = 10;
    cb.xp = 20;
    world.damage(pb, pa, 0, 999);
    expect(cb.xp).toBe(0);
    expect(cb.level).toBe(10);
    expect(deathPenalty(60, 999)).toBe(0);
  });

  it('morir en el santuario no cuesta experiencia', () => {
    const world = new World('umbral');
    const c = character({ id: 'a' });
    c.xp = 30;
    const p = world.join(c);
    p.invuln = 0;
    const lobezno = world.state.zombies.find((z) => z.family === 'lobezno')!;
    world.damage(p, lobezno, 0, 999);
    expect(p.hp).toBe(0);
    expect(c.xp).toBe(30);
    const aviso = seen(world, 'a', 'death').at(-1)!;
    expect(aviso.text).not.toMatch(/Perdiste/);
    expect(aviso.text).toMatch(/Lobezno/);
  });

  it('matar a un jugador no da experiencia pero se lo anuncia al que mató, y la tumba recuerda quién', () => {
    const { world, ca, pa, pb } = arena('bosque', { id: 'a' }, { id: 'b', name: 'Paul' });
    const xp = ca.xp;
    world.damage(pb, pa, 0, 999);
    expect(ca.xp).toBe(xp);
    expect(seen(world, 'a', 'kill').at(-1)!.title).toBe('Derrotaste a Paul');
    expect(world.state.graves.at(-1)).toMatchObject({ victim: 'b', killer: 'a', level: pb.level, maxHp: pb.maxHp });
  });

  it('salir muerto guarda el altar como posición', () => {
    const { world, cb, pb } = arena('bosque', { id: 'a' }, { id: 'b' });
    Object.assign(pb, { x: 2000, y: 1500, hp: 0 });
    world.leave('b');
    expect({ x: cb.x, y: cb.y }).toEqual(world.definition.shrine);
  });

  it('la Parada devuelve el golpe de un jugador cercano y dos paradas no rebotan para siempre', () => {
    const { world, ca, cb, pa, pb } = arena('bosque', { id: 'a' }, { id: 'b' });
    for (const [c, id] of [[ca, 'a'], [cb, 'b']] as [Character, string][]) {
      c.affinities.fuerza!.xp = 0;
      world.cast(id, 'e', { x: 0, y: 0 });
    }
    run(world, 1);
    expect(world.damage(pb, pa, 0, 1)).toBe(false);
    expect(pb.hp).toBe(pb.maxHp);
    expect(pa.hp).toBeLessThan(pa.maxHp);
  });
});

describe('experiencia de quien golpea', () => {
  it('la experiencia de un monstruo es del que dio el último golpe, no del que estaba más cerca', () => {
    const world = new World('bosque');
    const lobo = world.state.zombies.find((z) => z.family === 'lobezno')!;
    const lejos = character({ id: 'a' });
    const cerca = character({ id: 'b' });
    Object.assign(lejos, { x: lobo.x + 400, y: lobo.y });
    Object.assign(cerca, { x: lobo.x + 10, y: lobo.y });
    world.join(lejos);
    world.join(cerca);
    world.damageZombie(lobo, 'blue', 999, undefined, 'a');
    expect(lejos.xp).toBeGreaterThan(0);
    expect(cerca.xp).toBe(0);
  });

  it('lo que mata una Sombra se le acredita a su dueño', () => {
    const world = new World('bosque');
    const lobo = world.state.zombies.find((z) => z.family === 'lobezno')!;
    const dueño = character({ id: 'a' });
    const cerca = character({ id: 'b' });
    Object.assign(dueño, { x: lobo.x + 400, y: lobo.y });
    Object.assign(cerca, { x: lobo.x + 10, y: lobo.y });
    const pa = world.join(dueño);
    world.join(cerca);
    const sombra = (world as unknown as { newZombie(o: object, at: object, owner: object, extra: object): Zombie }).newZombie(
      pa,
      { x: lobo.x - 20, y: lobo.y },
      pa,
      { kind: 'thrall', hp: 6, maxHp: 6, life: 9999, classId: 'guardian', name: 'Sombra', role: 'auto', rise: 0, bushId: null, revealLeft: 0 },
    );
    world.state.zombies.push(sombra);
    world.damageZombie(lobo, 'blue', 999, 0, sombra.id);
    expect(dueño.xp).toBeGreaterThan(0);
    expect(cerca.xp).toBe(0);
  });
});

describe('Alzar', () => {
  const alzarDespues = INCANTATION_TIME + RULES.raiseCast + RULES.thrallRise + 0.3;

  it('Alzar levanta al jugador que mataste con su clase, su nombre y parte de su vida', () => {
    const arquero = { sparks: { destreza: 3 }, weapon: 'arco' } as Creation;
    const { world, ca, pa, pb } = arena('bosque', { id: 'a', skill: 'alzar' }, { id: 'b', name: 'Paul', creation: arquero });
    const vida = pb.maxHp;
    world.damage(pb, pa, 0, 999);
    const mana = pa.mana;
    world.cast('a', 'e', { x: pb.x, y: pb.y });
    run(world, ticks(alzarDespues));
    const sombra = world.state.zombies.find((z) => z.owner === 'a' && z.kind === 'thrall')!;
    expect(sombra).toMatchObject({ classId: 'archer', name: 'Paul' });
    expect(sombra.maxHp).toBe(round1(Math.min(vida, pa.maxHp) * THRALL_HP_SHARE));
    expect(ca.thrall?.victimId).toBe('b');
    expect(world.state.graves.some((g) => g.victim === 'b')).toBe(false);
    expect(pa.mana).toBeLessThan(mana);
    expect(seen(world, 'a', 'raise').at(-1)!.title).toBe('Paul se levanta');
  });

  it('no se puede alzar la tumba de alguien que mató otro', () => {
    const { world, pa, pb } = arena('bosque', { id: 'a', skill: 'alzar' }, { id: 'b' });
    world.damage(pb, pa, 0, 999);
    world.state.graves.at(-1)!.killer = 'c';
    const mana = pa.mana;
    world.cast('a', 'e', { x: pb.x, y: pb.y });
    run(world, 2);
    expect(seen(world, 'a', 'denied').at(-1)!.text).toMatch(/matado/);
    expect(pa.mana).toBeGreaterThanOrEqual(mana);
    expect(world.state.zombies.some((z) => z.owner === 'a')).toBe(false);
  });

  it('la Sombra no sobrevive al viaje, pero el vínculo queda y se vuelve a alzar sin tumba', () => {
    const { world, ca, pa, pb } = arena('bosque', { id: 'a', skill: 'alzar' }, { id: 'b' });
    world.damage(pb, pa, 0, 999);
    world.cast('a', 'e', { x: pb.x, y: pb.y });
    run(world, ticks(alzarDespues));
    expect(world.state.zombies.some((z) => z.owner === 'a')).toBe(true);
    world.leave('a');
    expect(world.state.zombies.some((z) => z.owner === 'a')).toBe(false);

    const otra = new World('bosque');
    otra.state.zombies = [];
    const p = otra.join(ca);
    expect(ca.thrall?.victimId).toBe('b');
    expect(p.thrall).toMatchObject({ classId: 'guardian', name: 'b' });
    otra.cast('a', 'e', { x: p.x + 40, y: p.y });
    run(otra, ticks(alzarDespues));
    expect(otra.state.zombies.some((z) => z.owner === 'a' && z.kind === 'thrall')).toBe(true);
  });

  it('salir a mitad del canto de Alzar no deja al personaje trabado para siempre', () => {
    const { world, ca, pa, pb } = arena('bosque', { id: 'a', skill: 'alzar' }, { id: 'b' });
    ca.affinities.sombra!.xp = 700; // silent: the raise starts on the cast step
    world.damage(pb, pa, 0, 999);
    world.cast('a', 'e', { x: pb.x, y: pb.y });
    run(world, 1);
    expect(pa.raiseCast).toBeGreaterThan(0);
    world.leave('a');
    const p = world.join(ca);
    run(world, ticks(SKILLS_WORLD.alzar.cooldown + 0.2));
    world.cast('a', 'e', { x: p.x + 40, y: p.y });
    run(world, ticks(RULES.raiseCast + RULES.thrallRise + 0.3));
    expect(world.state.zombies.some((z) => z.owner === 'a' && z.kind === 'thrall')).toBe(true);
  });

  it('matar a un jugador en zona salvaje despierta Alzar en quien tiene afinidad de Sombra', () => {
    const sombra = { sparks: { sombra: 1, fuerza: 2 }, weapon: 'espada' } as Creation;
    const { world, ca, pa, pb } = arena('bosque', { id: 'a', creation: sombra }, { id: 'b' });
    ca.slots.e = null;
    world.damage(pb, pa, 0, 999);
    expect(ca.skills.alzar).toBeTruthy();
    expect(ca.slots.e).toBe('alzar');
    expect(seen(world, 'a', 'learn').at(-1)!.text).toMatch(/Alzar/);
  });
});

describe('el duelo', () => {
  it('sigue decidiendo por equipo', () => {
    const duel = new Duel('courtyard', 'teams');
    duel.add('b1', 'Azul 1', 'guardian');
    duel.add('b2', 'Azul 2', 'guardian');
    duel.add('r1', 'Rojo', 'guardian');
    const [b1, b2, r1] = ['b1', 'b2', 'r1'].map((id) => duel.state.players.find((p) => p.id === id)!);
    b1.team = 'blue';
    b2.team = 'blue';
    r1.team = 'red';
    for (const p of [b1, b2, r1]) p.invuln = 0;
    expect(duel.damage(b2, b1, 0, 1)).toBe(false);
    expect(duel.damage(r1, b1, 0, 1)).toBe(true);
  });
});
