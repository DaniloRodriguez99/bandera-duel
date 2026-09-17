import { describe, it, expect } from 'vitest';
import { RULES, idleInput, solid, type Input } from '@bandera/shared';
import { World, newCharacter, type Creation, type Notice } from '@bandera/shared/world';
import { SKILLS_WORLD, canSurf, primaryElement } from '@bandera/shared/rpg/skills';
import { rollLoot } from '@bandera/shared/rpg/loot';
import { ITEMS } from '@bandera/shared/rpg/items';
import { TILE, waterRects, worldTerrain } from '@bandera/shared/rpg/terrain';
import type { ZoneId } from '@bandera/shared/rpg/zones';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
const person = (creation: Creation, skill = 'parada') =>
  newCharacter('h', 'cuenta', 'Noor', 'guardian', creation, { skillId: skill, rarity: SKILLS_WORLD[skill].rarity });
const seen = (world: World, kind: Notice['kind']) => world.notices.filter((n) => n.kind === kind);

function run(world: World, count: number, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++) {
    world.state.zombies = [];
    world.step(new Map([['h', { ...idleInput(), ...input }]]));
  }
}

/**
 * Dry ground right beside a lake, facing it along a row with no wall in between, so walking east
 * can only be stopped by the water itself.
 */
function shore(zoneId: ZoneId) {
  const ground = worldTerrain(zoneId);
  const walls = { walls: ground.walls, bounds: ground.bounds };
  for (const lake of waterRects(zoneId).filter((w) => w.w >= TILE * 4)) {
    const y = lake.y + TILE / 2;
    for (let x = lake.x - 30; x > lake.x - 600; x -= 10) {
      if (solid(x, y, RULES.radius, ground)) continue;
      let open = true;
      for (let d = x; d <= lake.x + TILE * 3 && open; d += 10) open = !solid(d, y, RULES.radius, walls);
      if (open) return { at: { x, y }, lake };
      break;
    }
  }
  throw new Error('sin orilla');
}

describe('el ataque básico respeta la afinidad', () => {
  it('un bastón en manos de alguien de solo Rayo tira rayos, no bolas de fuego, y no explota', () => {
    const world = new World('umbral');
    const c = person({ sparks: { rayo: 3 }, weapon: 'baston' });
    const p = world.join(c);
    run(world, 1, { shot: true, angle: 0 });
    const shot = world.state.arrows.find((a) => a.owner === 'h')!;
    expect(shot.worldElement).toBe('rayo');
    expect(primaryElement(c.affinities)).toBe('rayo');
    void p;
  });

  it('con agua como afinidad principal el bastón tira hielo', () => {
    expect(primaryElement({ agua: { points: 2, xp: 0, cultivation: 1 }, fuego: { points: 1, xp: 0, cultivation: 1 } })).toBe('hielo');
  });

  it('sin ninguna afinidad arcana el bastón es un palo: golpe físico que pega la mitad', () => {
    const world = new World('umbral');
    world.join(person({ sparks: { fuerza: 3 }, weapon: 'baston' }));
    run(world, 1, { shot: true, angle: 0 });
    const shot = world.state.arrows.find((a) => a.owner === 'h')!;
    expect(shot.worldElement).toBe('fisico');
    expect(shot.damageScale).toBeCloseTo(0.5);
  });

  it('las habilidades llevan su elemento en el proyectil', () => {
    const world = new World('umbral');
    const c = person({ sparks: { rayo: 3 }, weapon: 'baston' }, 'chispazo');
    c.affinities.rayo!.xp = 700;
    const p = world.join(c);
    world.cast('h', 'e', { x: p.x + 200, y: p.y });
    run(world, 2);
    expect(world.state.arrows.find((a) => a.owner === 'h')?.worldElement).toBe('rayo');
  });
});

describe('los atributos cuentan', () => {
  it('Magia sube el daño de los hechizos, Fuerza el de la espada', () => {
    const world = new World('umbral');
    const c = person({ sparks: { fuego: 3 }, weapon: 'espada' });
    world.join(c);
    expect(world.attributeScale(c, 'fuego')).toBe(1);
    c.stats.spirit += 5;
    c.stats.might += 2;
    expect(world.attributeScale(c, 'fuego')).toBeCloseTo(1.3);
    expect(world.attributeScale(c)).toBeCloseTo(1.12);
    expect(world.attributeScale(c, 'destreza')).toBe(1);
  });

  it('Agilidad acorta las recargas', () => {
    const lento = new World('umbral');
    const a = person({ sparks: { fuerza: 3 }, weapon: 'espada' });
    const pa = lento.join(a);
    lento.cast('h', 'e', { x: pa.x + 50, y: pa.y });
    run(lento, 1);
    const rapido = new World('umbral');
    const b = person({ sparks: { fuerza: 3 }, weapon: 'espada' });
    b.stats.agility += 10;
    const pb = rapido.join(b);
    rapido.cast('h', 'e', { x: pb.x + 50, y: pb.y });
    run(rapido, 1);
    expect(rapido.cooldownLeft('h', 'parada')).toBeLessThan(lento.cooldownLeft('h', 'parada'));
  });

  it('Percepción da golpes críticos', () => {
    const world = new World('bosque');
    world.random = () => 0;
    const c = person({ sparks: { fuerza: 3 }, weapon: 'espada' });
    c.stats.perception += 5;
    const atacante = world.join(c);
    const victima = world.join(newCharacter('v', 'otra', 'Victima', 'guardian'));
    Object.assign(atacante, { x: 2000, y: 2000 });
    Object.assign(victima, { x: 2040, y: 2000, invuln: 0 });
    const antes = victima.hp;
    world.damage(victima, atacante, 0, 1);
    expect(antes - victima.hp).toBeCloseTo(1.5);
  });
});

describe('el agua', () => {
  it('no se camina: quien no surfea se frena en la orilla', () => {
    const { at, lake } = shore('umbral');
    const world = new World('umbral');
    const c = person({ sparks: { fuerza: 3 }, weapon: 'espada' });
    Object.assign(c, at);
    const p = world.join(c);
    run(world, ticks(3), { x: 1 });
    expect(p.x).toBeLessThan(lake.x);
  });

  it('con Agua o Viento en rango Intermedio se surfea por encima', () => {
    const { at, lake } = shore('umbral');
    const world = new World('umbral');
    const c = person({ sparks: { viento: 3 }, weapon: 'arco' });
    c.affinities.viento!.xp = 60;
    expect(canSurf(c.affinities)).toBe(true);
    Object.assign(c, at);
    const p = world.join(c);
    run(world, ticks(3), { x: 1 });
    expect(p.x).toBeGreaterThan(lake.x + TILE);
  });

  it('las flechas sí cruzan el agua', () => {
    const { at, lake } = shore('umbral');
    const world = new World('umbral');
    const c = person({ sparks: { destreza: 3 }, weapon: 'arco' });
    Object.assign(c, at);
    world.join(c);
    run(world, 1, { shot: true, angle: 0 });
    run(world, ticks(0.25));
    const flecha = world.state.arrows.find((a) => a.owner === 'h');
    expect(flecha && flecha.x).toBeGreaterThan(lake.x);
  });

  it('llegar a Intermedio en Agua lo anuncia', () => {
    const world = new World('umbral');
    const c = person({ sparks: { agua: 3 }, weapon: 'baston' }, 'cura_menor');
    c.affinities.agua!.xp = 59.5;
    const p = world.join(c);
    world.cast('h', 'e', { x: p.x, y: p.y });
    run(world, 1);
    expect(seen(world, 'rank').at(-1)!.text).toMatch(/agua/i);
  });

  it('un guardado parado dentro de un lago aparece en tierra firme', () => {
    const lake = waterRects('umbral').find((w) => w.w >= TILE * 3)!;
    const world = new World('umbral');
    const c = person({ sparks: { fuerza: 3 }, weapon: 'espada' });
    Object.assign(c, { x: lake.x + TILE * 1.5, y: lake.y + TILE / 2 });
    const p = world.join(c);
    expect(solid(p.x, p.y, RULES.radius, worldTerrain('umbral'))).toBe(false);
  });
});

describe('el botín respeta la afinidad', () => {
  it('a alguien de solo Rayo nunca le cae un grimorio de una escuela cerrada', () => {
    let seed = 99;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const c = person({ sparks: { rayo: 3 }, weapon: 'baston' }, 'chispazo');
    for (let i = 0; i < 3000; i++)
      for (const id of rollLoot({ tier: 'raro', campLevel: 12, character: c, random })) {
        const effect = ITEMS[id].grimoire;
        if (effect?.kind !== 'teach') continue;
        expect(['rayo', 'cuerpo']).toContain(SKILLS_WORLD[effect.skillId].school);
      }
  });

  it('Chispa (fuego) y Centella (rayo) ya no se confunden por nombre', () => {
    expect(SKILLS_WORLD.chispa.name).toBe('Chispa');
    expect(SKILLS_WORLD.chispazo.name).toBe('Centella');
  });
});
