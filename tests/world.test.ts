import { describe, it, expect } from 'vitest';
import { CLASSES, Duel, RULES, idleInput, type Input } from '@bandera/shared';
import { World, newCharacter } from '@bandera/shared/world';

const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
function setup(classId: 'guardian' | 'archer' | 'mage' = 'guardian') {
  const world = new World();
  const character = newCharacter('c1', 'cuenta1', 'Noor', classId);
  const p = world.join(character);
  return { world, character, p };
}
function run(world: World, count: number, options: Partial<Input> = {}) {
  for (let i = 0; i < count; i++) world.step(new Map([['c1', input(options)]]));
}
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);

describe('mundo', () => {
  it('camina más allá del borde de la arena porque usa los límites de su zona', () => {
    const { world, p } = setup();
    // The arena would stop anyone at RULES.width - 20; the valley is four times wider.
    run(world, ticks(6), { x: 1 });
    expect(p.x).toBeGreaterThan(RULES.width);
    expect(p.x).toBeLessThan(world.definition.terrain.bounds.maxX);
  });

  it('no arma bases ni banderas, y no tiene reloj de partida', () => {
    const { world } = setup();
    expect(world.state.flags).toHaveLength(0);
    expect(world.state.bases).toHaveLength(0);
    expect(world.state.winner).toBe(null);
    run(world, ticks(3));
    expect(world.state.winner).toBe(null);
    expect(world.state.phase).toBe('playing');
  });

  it('morir no borra el nivel, el maná ni la experiencia', () => {
    const { world, character, p } = setup();
    world.grantXp('c1', 500);
    const level = character.level;
    const maxMana = p.maxMana;
    expect(level).toBeGreaterThan(1);
    expect(maxMana).toBeGreaterThan(0);
    // Death and the respawn countdown run through the inherited player step.
    p.hp = 0;
    p.respawnLeft = 0.1;
    run(world, ticks(0.4));
    expect(p.hp).toBeGreaterThan(0);
    expect(p.level).toBe(level);
    expect(p.maxMana).toBe(maxMana);
    expect(character.level).toBe(level);
    expect(character.xp).toBeGreaterThanOrEqual(0);
  });

  it('revive en el altar de la zona', () => {
    const { world, p } = setup();
    p.hp = 0;
    p.respawnLeft = 0.1;
    run(world, ticks(0.4));
    expect(p.x).toBeCloseTo(world.definition.shrine.x);
    expect(p.y).toBeCloseTo(world.definition.shrine.y);
  });

  it('la experiencia sube de nivel, reparte puntos y agranda la vida', () => {
    const { world, character, p } = setup();
    const hp = p.maxHp;
    const subida = world.grantXp('c1', 500);
    expect(subida).not.toBe(null);
    expect(character.level).toBeGreaterThan(1);
    expect(character.unspent).toBeGreaterThan(0);
    // Placing a point is what the game actually does with them, and it resizes the pool at once.
    expect(world.spendPoint('c1', 'vigor')).toBe(true);
    expect(p.maxHp).toBeGreaterThan(hp);
    expect(character.unspent).toBeGreaterThanOrEqual(0);
    // Nothing left to place means nothing to spend.
    while (world.spendPoint('c1', 'might'));
    expect(world.spendPoint('c1', 'might')).toBe(false);
  });

  it('el maná se regenera hasta su tope y el de duelo se queda en cero', () => {
    const { world, p } = setup('mage');
    p.mana = 0;
    run(world, ticks(2));
    expect(p.mana).toBeGreaterThan(0);
    expect(p.mana).toBeLessThanOrEqual(p.maxMana);
    // The guard that keeps the duel simulation untouched: no pool, nothing to tick.
    const duel = new Duel();
    const duelista = duel.add('a', 'A', 'guardian');
    expect(duelista.maxMana).toBe(0);
    expect(duelista.maxHp).toBe(CLASSES.guardian.hp);
  });

  it('los campamentos pueblan la zona con los monstruos de su familia', () => {
    const { world } = setup();
    run(world, 2);
    const salvajes = world.state.zombies.filter((z) => z.family);
    expect(salvajes.length).toBeGreaterThan(0);
    // Wild monsters answer to no player, which is what puts the brain in automatic mode.
    expect(salvajes.every((z) => !world.state.players.some((p) => p.id === z.owner))).toBe(true);
    expect(salvajes.every((z) => z.team === 'red' && z.faction === 'monster')).toBe(true);
    // A camp fills up to its own count, no further.
    const campamento = world.definition.spawners[0];
    const suyos = world.state.zombies.filter((z) => z.owner === 'wild:umbral:0' && z.hp > 0);
    expect(suyos.length).toBeLessThanOrEqual(campamento.count);
  });

  it('un lobezno y un jabalí no pelean igual', () => {
    const { world } = setup();
    run(world, 2);
    const lobezno = world.state.zombies.find((z) => z.family === 'lobezno');
    const jabali = world.state.zombies.find((z) => z.family === 'jabali');
    expect(lobezno).toBeTruthy();
    expect(jabali).toBeTruthy();
    // The boar is the tougher one; if families were decorative these would be equal.
    expect(jabali!.maxHp).toBeGreaterThan(lobezno!.maxHp);
  });

  it('matar un monstruo da experiencia y puede subir de nivel', () => {
    const { world, character, p } = setup();
    run(world, 2);
    const presa = world.state.zombies.find((z) => z.family)!;
    const xpAntes = character.xp;
    const nivelAntes = character.level;
    // The killer is credited by proximity, so stand on top of it.
    Object.assign(p, { x: presa.x, y: presa.y });
    world.damageZombie(presa, p.team, 999);
    expect(presa.hp).toBeLessThanOrEqual(0);
    expect(character.xp > xpAntes || character.level > nivelAntes).toBe(true);
  });

  it('el campamento arranca lleno y repuebla de a uno con el tiempo', () => {
    const { world } = setup();
    const campamento = world.definition.spawners[0];
    const vivos = () => world.state.zombies.filter((z) => z.owner === 'wild:umbral:0' && z.hp > 0);
    // A valley nobody has touched is already populated.
    expect(vivos()).toHaveLength(campamento.count);
    for (const z of vivos()) z.hp = 0;
    run(world, 2);
    // Nothing comes back before its timer: the camp stays cleared for a while.
    expect(vivos()).toHaveLength(0);
    run(world, ticks(campamento.respawnSeconds + 1));
    expect(vivos()).toHaveLength(1);
    run(world, ticks(campamento.respawnSeconds * campamento.count + 2));
    expect(vivos()).toHaveLength(campamento.count);
  });

  it('la correa devuelve al campamento al que persiguió de más', () => {
    const { world } = setup();
    run(world, 2);
    const campamento = world.definition.spawners[0];
    const mob = world.state.zombies.find((z) => z.owner === 'wild:umbral:0')!;
    const lejos = { x: campamento.at.x + 1500, y: campamento.at.y };
    Object.assign(mob, lejos, { hp: 1 });
    const antes = Math.hypot(mob.x - campamento.at.x, mob.y - campamento.at.y);
    run(world, ticks(1));
    const ahora = Math.hypot(mob.x - campamento.at.x, mob.y - campamento.at.y);
    expect(ahora).toBeLessThan(antes);
    // It heals on the way home, so a player cannot whittle it down by kiting it forever.
    expect(mob.hp).toBeGreaterThan(1);
    expect(mob.target).toBe(null);
  });

  it('al salir guarda la posición y la zona para volver ahí', () => {
    const { world, character, p } = setup();
    run(world, ticks(2), { x: 1 });
    const x = p.x;
    world.leave('c1');
    expect(character.x).toBeCloseTo(x);
    expect(character.zoneId).toBe(world.definition.id);
    expect(world.state.players).toHaveLength(0);
  });
});
