import { describe, it, expect } from 'vitest';
import { RULES, blocked, solid, type Zombie } from '@bandera/shared';
import { worldTerrain } from '@bandera/shared/rpg/terrain';
import { World, newCharacter, type WorldSnapshot } from '@bandera/shared/world';
import { MOB_FAMILIES, mobStats } from '@bandera/shared/rpg/mobs';
import { MONSTER_TREES, SKILLS_WORLD } from '@bandera/shared/rpg/skills';
import { ZONE_IDS, zone, type MobFamilyId, type ZoneId } from '@bandera/shared/rpg/zones';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);

/** A stretch of dry, open ground long enough for a fight: no wall and no water on it or around. */
function dryGround(zoneId: ZoneId, length: number) {
  const ground = worldTerrain(zoneId);
  const clear = (x: number, y: number) => !solid(x, y, 40, ground);
  for (let y = 400; y < ground.bounds.maxY - 400; y += 40)
    for (let x = 600; x < ground.bounds.maxX - length - 200; x += 40) {
      let ok = true;
      for (let d = 0; d <= length && ok; d += 20) ok = clear(x + d, y) && clear(x + d, y - 140) && clear(x + d, y + 140);
      if (ok) return { x, y };
    }
  throw new Error(`sin terreno seco en ${zoneId}`);
}

/**
 * One character and one monster alone in a quiet corner of a zone, the monster already hunting.
 * The character is only protected from the camps around, never from the monster under test.
 */
function duel(familyId: MobFamilyId, gap: number, zoneId: ZoneId = 'umbral', level = 10) {
  const world = new World(zoneId);
  world.state.zombies = [];
  const at = dryGround(zoneId, gap + 200);
  const c = newCharacter('h', 'cuenta', 'Noor', 'guardian');
  c.level = level;
  Object.assign(c, at);
  const p = world.join(c);
  p.invuln = 0;
  const stats = mobStats(familyId, level);
  const z = (world as unknown as { newZombie(o: object, at: object, f: object, extra: object): Zombie }).newZombie(
    { id: `wild:${zoneId}:0`, team: 'red', angle: Math.PI },
    { x: at.x + gap, y: at.y },
    { x: at.x + gap, y: at.y },
    { family: familyId, faction: 'monster', level, hp: stats.hp, maxHp: stats.hp, name: MOB_FAMILIES[familyId].name },
  );
  z.target = 'h';
  world.state.zombies.push(z);
  return { world, p, z, c };
}

/** Steps with the monster kept on its target, so the walking brain cannot wander off. */
function run(world: World, count: number, each?: () => void) {
  for (let i = 0; i < count; i++) {
    for (const z of world.state.zombies) z.retarget = 99;
    world.step(new Map());
    each?.();
  }
}

describe('kits de los monstruos', () => {
  it('cada familia tiene kit coherente y su árbol robable', () => {
    for (const family of Object.values(MOB_FAMILIES)) {
      for (const skill of family.kit) {
        expect(skill.windup, `${family.id}.${skill.id}`).toBeGreaterThan(0);
        expect(skill.cooldown).toBeGreaterThan(skill.windup);
        expect(skill.min).toBeLessThan(skill.max);
      }
      const tree = MONSTER_TREES[family.id];
      expect(tree, family.id).toBeTruthy();
      for (const id of tree.skills) expect(SKILLS_WORLD[id]?.school, id).toBe('monstruo');
    }
  });

  it('cada zona tiene al menos tres familias distintas, y la Ciénaga existe con su nigromante', () => {
    for (const id of ZONE_IDS) expect(new Set(zone(id).spawners.map((s) => s.familyId)).size, id).toBeGreaterThanOrEqual(3);
    expect(zone('cienaga').spawners.some((s) => s.familyId === 'nigromante')).toBe(true);
    for (const id of ZONE_IDS)
      for (const camp of zone(id).spawners) expect(blocked(camp.at.x, camp.at.y, 20, zone(id).terrain), `${id} ${camp.familyId}`).toBe(false);
  });
});

describe('habilidades de los monstruos', () => {
  it('el duende avisa, tira la piedra, y la piedra lastima', () => {
    const { world, p, z } = duel('duende', 220);
    let avisó = false;
    run(world, 1);
    expect(z.skill?.name).toBe('Pedrada');
    run(world, ticks(0.6), () => (avisó ||= !!z.skill));
    expect(avisó).toBe(true);
    const disparos = () => (world.state as WorldSnapshot).mobShots;
    run(world, ticks(1.2));
    expect(p.hp).toBeLessThan(p.maxHp);
    expect(disparos().filter((s) => s.owner === z.id)).toHaveLength(0);
  });

  it('salir de la línea mientras apunta hace que la piedra no te encuentre', () => {
    const { world, p } = duel('duende', 220);
    run(world, 1);
    p.y += 120;
    run(world, ticks(1.2));
    expect(p.hp).toBe(p.maxHp);
  });

  it('la botella de fuego cae donde estabas: si te movés a tiempo, no te quema', () => {
    const quieto = duel('saqueador', 200);
    run(quieto.world, ticks(1.3));
    expect(quieto.p.hp).toBeLessThan(quieto.p.maxHp);

    const atento = duel('saqueador', 200);
    run(atento.world, 1);
    expect(atento.z.skill?.kind).toBe('nova');
    atento.p.y += 160;
    run(atento.world, ticks(1.3));
    expect(atento.p.hp).toBe(atento.p.maxHp);
  });

  it('el jabalí escarba y embiste: cierra la distancia de golpe y pega fuerte', () => {
    const { world, p, z } = duel('jabali', 200);
    const antes = z.x;
    run(world, ticks(0.9));
    expect(z.x).toBeLessThan(antes - 120);
    expect(p.hp).toBeLessThan(p.maxHp);
  });

  it('la telaraña deja al jugador pegado', () => {
    const { world, p } = duel('arana', 200, 'bosque');
    let pegado = false;
    run(world, ticks(1.6), () => (pegado ||= p.stunLeft > 0));
    expect(pegado).toBe(true);
  });

  it('el veneno del sapo sigue quitando vida después del golpe', () => {
    const { world, p } = duel('sapo', 200, 'cienaga', 15);
    run(world, ticks(1.4));
    const tras = p.hp;
    expect(tras).toBeLessThan(p.maxHp);
    const z = world.state.zombies[0];
    z.hp = 0; // gone: whatever still hurts is the poison
    run(world, ticks(3));
    expect(p.hp).toBeLessThan(tras);
  });

  it('el aullido potencia a la manada: el mismo mordisco pega más', () => {
    const { world, p, z } = duel('lobezno', 120);
    p.invuln = 999;
    run(world, ticks(0.8));
    p.invuln = 0;
    const antes = p.hp;
    world.damage(p, z, 0, 1);
    const conAullido = antes - p.hp;
    expect(conAullido).toBeCloseTo(1 + MOB_FAMILIES.lobezno.kit[0].buff!.damage);
  });

  it('el ent cura a su grove herido', () => {
    const { world, z } = duel('ent', 500, 'bosque');
    const herido = { ...z, id: 'z-herido', hp: 1, x: z.x + 40 };
    world.state.zombies.push(herido as Zombie);
    run(world, ticks(1.3));
    expect(world.state.zombies.find((q) => q.id === 'z-herido')!.hp).toBeGreaterThan(1);
  });

  it('el nigromante levanta esqueletos, que no son eternos, y no más de su tope', () => {
    const { world, z } = duel('nigromante', 300, 'cienaga', 19);
    for (let i = 0; i < 4; i++) {
      run(world, ticks(1.4));
      (world as unknown as { mobSkillCd: Map<string, Record<string, number>> }).mobSkillCd.get(z.id)!.levantar = 0;
    }
    const huesos = world.state.zombies.filter((q) => q.family === 'esqueleto');
    expect(huesos.length).toBeGreaterThan(0);
    expect(huesos.length).toBeLessThanOrEqual(MOB_FAMILIES.nigromante.kit[0].summon!.max);
    expect(huesos.every((q) => q.life <= MOB_FAMILIES.nigromante.kit[0].summon!.seconds)).toBe(true);
  });

  it('congelar a un monstruo le corta la habilidad que estaba cargando', () => {
    const { world, p, z } = duel('duende', 220);
    run(world, 1);
    expect(z.skill).toBeTruthy();
    z.frozenLeft = 1;
    run(world, ticks(1.2));
    expect(p.hp).toBe(p.maxHp);
  });
});
