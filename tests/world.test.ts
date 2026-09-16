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
