import { describe, it, expect } from 'vitest';
import { Duel, RULES, activePreset, defaultCustomization, idleInput } from '@bandera/shared';
import {
  CHEST_REACH,
  World,
  newCharacter,
  worldInput,
  type Character,
  type Creation,
  type Notice,
  type WorldSnapshot,
} from '@bandera/shared/world';
import { CHEST_TIERS } from '@bandera/shared/rpg/loot';
import { INVENTORY_SIZE, ITEMS } from '@bandera/shared/rpg/items';
import { SKILLS_WORLD } from '@bandera/shared/rpg/skills';
import { ZONE_IDS, zone, type ZoneId } from '@bandera/shared/rpg/zones';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const chests = (world: World) => (world.state as WorldSnapshot).chests;
const seen = (world: World, id: string, kind: Notice['kind']) => world.notices.filter((n) => n.id === id && n.kind === kind);

function person(id = 'h', creation: Creation = { sparks: { fuerza: 3 }, weapon: 'espada' }, skill = 'parada') {
  return newCharacter(id, `cuenta-${id}`, id, 'guardian', creation, { skillId: skill, rarity: SKILLS_WORLD[skill].rarity });
}

/** A character on the valley's chest, untouchable, with loot rolls pinned. */
function atChest(character = person(), zoneId: ZoneId = 'umbral') {
  const world = new World(zoneId);
  world.random = seeded(5);
  const chest = chests(world)[0];
  Object.assign(character, { x: chest.x, y: chest.y + 20 });
  const p = world.join(character);
  p.invuln = 999;
  return { world, c: character, p, chest };
}

function run(world: World, count: number, ids = [...world.characters.keys()]) {
  for (let i = 0; i < count; i++) world.step(new Map(ids.map((id) => [id, idleInput()])));
}

/** A character somewhere quiet, for the bag and gear tests. */
function holder(level = 1, creation?: Creation, skill?: string) {
  const world = new World('umbral');
  world.random = seeded(9);
  const c = person('h', creation, skill);
  c.level = level;
  const p = world.join(c);
  p.invuln = 999;
  return { world, c, p };
}

describe('cofres', () => {
  it('cada campamento que custodia un cofre tiene su cofre listo en el mundo', () => {
    for (const zoneId of ZONE_IDS) {
      const world = new World(zoneId);
      const camps = zone(zoneId).spawners.flatMap((camp, i) => (camp.guards === 'chest' ? [{ camp, i }] : []));
      expect(chests(world).map((c) => c.id)).toEqual(camps.map(({ i }) => `chest:${zoneId}:${i}`));
      for (const [n, chest] of chests(world).entries()) {
        expect(chest.ready).toBe(true);
        expect({ x: chest.x, y: chest.y }).toEqual(camps[n].camp.at);
      }
    }
    expect('chests' in new Duel().state).toBe(false);
  });

  it('quedarse al lado del cofre lo abre después de su tiempo y el botín entra a la bolsa', () => {
    const { world, c, chest } = atChest();
    run(world, ticks(CHEST_TIERS.comun.openSeconds) - 2);
    expect(chest.ready).toBe(true);
    expect(chest.opener).toBe('h');
    expect(chest.progress).toBeGreaterThan(0.9);
    run(world, 3);
    expect(c.inventory.length).toBeGreaterThanOrEqual(1);
    expect(c.inventory.length).toBeLessThanOrEqual(2);
    expect(chest.ready).toBe(false);
    expect(chest.respawnLeft).toBeGreaterThan(CHEST_TIERS.comun.respawnSeconds - 1);
    const aviso = seen(world, 'h', 'loot').at(-1)!;
    expect(aviso.items).toEqual(c.inventory);
    expect(world.saveNow.has('h')).toBe(true);
    expect(world.sheetChanged.has('h')).toBe(true);
    expect(world.state.events.some((e) => e.kind === 'pickup' && e.x === chest.x && e.y === chest.y)).toBe(true);
  });

  it('un golpe corta la apertura y hay que empezar de nuevo', () => {
    const { world, c, p, chest } = atChest();
    run(world, ticks(1));
    const jabali = world.state.zombies.find((z) => z.family === 'jabali')!;
    p.invuln = 0;
    expect(world.damage(p, jabali, 0, 0.1)).toBe(true);
    run(world, 1);
    expect(chest.progress).toBeLessThan(0.05);
    p.invuln = 999;
    run(world, ticks(1));
    expect(chest.ready).toBe(true);
    expect(c.inventory).toHaveLength(0);
  });

  it('alejarse o lanzar una habilidad cancela la apertura', () => {
    const { world, p, chest } = atChest();
    run(world, ticks(0.8));
    expect(chest.progress).toBeGreaterThan(0.4);
    p.x += CHEST_REACH + 60;
    run(world, 1);
    expect(chest.opener).toBe(null);
    expect(chest.progress).toBe(0);
    p.x -= CHEST_REACH + 60;
    run(world, ticks(0.8));
    expect(chest.progress).toBeGreaterThan(0.4);
    world.cast('h', 'e', { x: p.x + 50, y: p.y });
    run(world, 1);
    expect(chest.progress).toBeLessThan(0.05);
  });

  it('dos jugadores en el mismo cofre: el primero se lo lleva y el otro no recibe nada', () => {
    const { world, c: a, chest } = atChest(person('a'));
    run(world, 10, ['a']);
    const b = person('b');
    Object.assign(b, { x: chest.x + 20, y: chest.y });
    world.join(b).invuln = 999;
    run(world, ticks(CHEST_TIERS.comun.openSeconds) + 2);
    expect(a.inventory.length).toBeGreaterThan(0);
    expect(b.inventory).toHaveLength(0);
    expect(seen(world, 'b', 'denied').at(-1)!.text).toBe('Alguien lo abrió primero.');
    expect(a.inventory.length + b.inventory.length).toBe(seen(world, 'a', 'loot')[0].items!.length);
  });

  it('con la bolsa llena el cofre no se abre y avisa una sola vez', () => {
    const { world, c, chest } = atChest();
    for (let i = 0; i < INVENTORY_SIZE - 1; i++) world.give('h', 'jubon_cuero');
    run(world, ticks(3));
    expect(chest.ready).toBe(true);
    expect(seen(world, 'h', 'denied').filter((n) => /bolsa/.test(n.text))).toHaveLength(1);
    expect(c.inventory).toHaveLength(INVENTORY_SIZE - 1);
  });

  it('el cofre vuelve con su temporizador, pero solo si el campamento está completo', () => {
    const { world, p, chest } = atChest();
    run(world, ticks(CHEST_TIERS.comun.openSeconds) + 1);
    expect(chest.ready).toBe(false);
    p.x += 400; // out of reach, so it is not opened again the moment it returns
    const camp = chest.id.replace('chest:', 'wild:');
    const guardias = world.state.zombies.filter((z) => z.owner === camp);
    world.state.zombies = world.state.zombies.filter((z) => z.owner !== camp);
    chest.respawnLeft = 0;
    run(world, 1);
    expect(chest.ready).toBe(false);
    world.state.zombies.push(...guardias.map((z) => ({ ...z, hp: z.maxHp })));
    run(world, 1);
    expect(chest.ready).toBe(true);
  });

  it('un caído no abre cofres', () => {
    const { world, p, chest } = atChest();
    p.hp = 0;
    p.respawnLeft = 99;
    run(world, ticks(3));
    expect(seen(world, 'h', 'loot')).toHaveLength(0);
    expect(chest.ready).toBe(true);
  });
});

describe('grimorios', () => {
  it('un grimorio enseña una habilidad nueva, se consume, y no se puede usar dos veces', () => {
    const { world, c } = holder(1, { sparks: { viento: 3 }, weapon: 'arco' });
    const libro = world.give('h', 'grimorio:rafaga')!;
    expect(world.useItem('h', libro.uid)).toBe(true);
    expect(c.skills.rafaga).toEqual({ level: 1, uses: 0, nodes: [] });
    expect(c.inventory.some((i) => i.uid === libro.uid)).toBe(false);
    expect(world.useItem('h', libro.uid)).toBe(false);
    expect(c.skills.rafaga.level).toBe(1);
  });

  it('un tomo abre una afinidad cerrada y el hechizo que se negaba ahora sale', () => {
    const { world, c, p } = holder(1);
    c.slots.e = null;
    const chispa = world.give('h', 'grimorio:chispa')!;
    expect(world.useItem('h', chispa.uid)).toBe(true);
    expect(c.skills.chispa).toBeTruthy();
    expect(c.slots.e).toBe(null);
    expect(world.setSlot('h', 'e', 'chispa')).toBe(false);
    const tomo = world.give('h', 'tomo:fuego')!;
    expect(world.useItem('h', tomo.uid)).toBe(true);
    expect(c.affinities.fuego).toEqual({ points: 1, xp: 0, cultivation: 1 });
    expect(world.setSlot('h', 'e', 'chispa')).toBe(true);
    world.cast('h', 'e', { x: p.x + 100, y: p.y });
    run(world, 1);
    expect(seen(world, 'h', 'callout').at(-1)!.title).toBe('Chispa');
  });

  it('el tomo no pasa del tope y el grimorio de algo ya aprendido lo sube un nivel', () => {
    const { world, c } = holder(1);
    c.affinities.fuerza!.points = 5;
    const tomo = world.give('h', 'tomo:fuerza')!;
    expect(world.useItem('h', tomo.uid)).toBe(false);
    expect(c.inventory.some((i) => i.uid === tomo.uid)).toBe(true);

    c.skills.parada.level = 3;
    const libro = world.give('h', 'grimorio:parada')!;
    expect(world.useItem('h', libro.uid)).toBe(true);
    expect(c.skills.parada.level).toBe(4);
    expect(seen(world, 'h', 'evolution').at(-1)!.title).toMatch(/Parada Fluida/);

    c.skills.parada.level = SKILLS_WORLD.parada.maxLevel;
    const otro = world.give('h', 'grimorio:parada')!;
    expect(world.useItem('h', otro.uid)).toBe(false);
    expect(c.inventory.some((i) => i.uid === otro.uid)).toBe(true);
  });

  it('el manual de práctica sube la habilidad elegida y rechaza una que no conocés', () => {
    const { world, c } = holder(1);
    const manual = world.give('h', 'manual_practica')!;
    expect(world.useItem('h', manual.uid, 'parada')).toBe(true);
    expect(c.skills.parada.level).toBe(2);
    const otro = world.give('h', 'manual_practica')!;
    expect(world.useItem('h', otro.uid, 'trueno')).toBe(false);
    expect(c.inventory.some((i) => i.uid === otro.uid)).toBe(true);
    expect(seen(world, 'h', 'denied').at(-1)!.text).toMatch(/conozcas/);
  });
});

describe('equipo', () => {
  it('equipar armadura de Vigor sube la vida máxima; sacarla la baja sin curar a nadie', () => {
    const { world, c, p } = holder(7);
    const base = p.maxHp;
    p.hp = base - 2;
    const cota = world.give('h', 'cota_malla')!;
    expect(world.equip('h', cota.uid)).toBe(true);
    expect(p.maxHp).toBeGreaterThan(base);
    expect(p.hp).toBe(base - 2);
    expect(c.equipment.armor).toEqual(cota);
    expect(world.unequip('h', 'armor')).toBe(true);
    expect(p.maxHp).toBe(base);
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
    expect(c.inventory).toContainEqual(cota);
  });

  it('cambiar de arma cambia el arma, la clase del motor y lo que entrena el click', () => {
    const { world, c, p } = holder(4);
    const arco = world.give('h', 'arco_cazador')!;
    expect(world.equip('h', arco.uid)).toBe(true);
    expect(c.weapon).toBe('arco');
    expect(c.classId).toBe('archer');
    expect(p.classId).toBe('archer');
    expect(p.loadout).toEqual(activePreset(defaultCustomization('archer')).loadout);
    expect(p.attackLock).toBeGreaterThanOrEqual(0.6);
    expect(c.inventory.map((i) => i.itemId)).toContain('espada_madera');
    expect(worldInput({ ...idleInput(), shot: true }, c.weapon).shot).toBe(true);
    expect(world.unequip('h', 'weapon')).toBe(false);
  });

  it('no se equipa lo que pide más nivel y el uid inventado no hace nada', () => {
    const { world, c } = holder(1);
    const coraza = world.give('h', 'coraza_colmillo')!;
    expect(world.equip('h', coraza.uid)).toBe(false);
    expect(seen(world, 'h', 'denied').at(-1)!.text).toMatch(/nivel 12/);
    const avisos = world.notices.length;
    expect(world.equip('h', 'i999')).toBe(false);
    expect(world.notices.length).toBe(avisos);
    expect(c.equipment.armor).toBe(null);
  });

  it('el equipo no se pierde al morir y sus bonos siguen puestos al revivir', () => {
    const { world, c, p } = holder(14);
    world.equip('h', world.give('h', 'jubon_cuero')!.uid);
    world.equip('h', world.give('h', 'eco_alma')!.uid);
    const puesto = structuredClone(c.equipment);
    const vida = p.maxHp;
    p.hp = 0;
    p.respawnLeft = 0.1;
    run(world, ticks(0.4));
    expect(p.hp).toBeGreaterThan(0);
    expect(c.equipment).toEqual(puesto);
    expect(p.maxHp).toBe(vida);
    expect(p.hp).toBe(p.maxHp);
  });

  it('los bonos de velocidad y daño del equipo llegan a la simulación', () => {
    const { world, p } = holder(7);
    world.equip('h', world.give('h', 'daga_colmillo')!.uid);
    run(world, 1);
    expect(p.pve.speed).toBeCloseTo(0.03);
    const multiplier = (world as unknown as { damageMultiplier(id: string): number }).damageMultiplier('h');
    // The fang's 8 %, plus the 6 % three sparks of Fuerza always give.
    expect(multiplier).toBeCloseTo(1.14);
  });

  it('equipar, sacar, usar y tirar nunca duplican: los uid son únicos y nada aparece de la nada', () => {
    const { world, c } = holder(14, { sparks: { fuego: 2, viento: 1 }, weapon: 'baston' });
    const random = seeded(42);
    const ids = Object.keys(ITEMS);
    let given = 0;
    let gone = 0;
    for (let n = 0; n < 300; n++) {
      const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
      const bag = c.inventory;
      const op = Math.floor(random() * 5);
      if (op === 0 && world.give('h', pick(ids))) given++;
      if (op === 1 && bag.length) world.equip('h', pick(bag).uid);
      if (op === 2) world.unequip('h', pick(['armor', 'amulet', 'weapon'] as const));
      if (op === 3 && bag.length && world.useItem('h', pick(bag).uid, pick(Object.keys(c.skills)))) gone++;
      if (op === 4 && bag.length && random() < 0.3 && world.discard('h', pick(bag).uid)) gone++;
      const e = c.equipment;
      const all = [...c.inventory, e.weapon, e.armor, e.amulet].filter(Boolean) as { uid: string }[];
      expect(new Set(all.map((i) => i.uid)).size).toBe(all.length);
      expect(c.inventory.length).toBeLessThanOrEqual(INVENTORY_SIZE);
      // Everything given is somewhere, plus the birth weapon, minus what was read or thrown away.
      expect(all.length).toBe(1 + given - gone);
    }
  });
});

describe('ficha', () => {
  it('equipar la armadura se refleja en la ficha que se guarda', () => {
    const { world, c } = holder(7);
    world.saveNow.clear();
    world.equip('h', world.give('h', 'cota_malla')!.uid);
    expect(world.saveNow.has('h')).toBe(true);
    expect((c as Character).equipment.armor?.itemId).toBe('cota_malla');
  });
});
