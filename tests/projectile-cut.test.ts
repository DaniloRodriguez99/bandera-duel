import { describe, expect, it } from 'vitest';
import { CLASSES, Duel, RULES, idleInput, type Arrow, type ClassId, type Input } from '@bandera/shared';
import { World, newCharacter, type MobShot } from '@bandera/shared/world';

const input = (value: Partial<Input> = {}) => ({ ...idleInput(), ...value });
/**
 * The plain swing's cut: every swing, no charge. In an arena it is the warrior's; the knight cuts
 * through his techniques, by charge (tests/guardian.test.ts). In Lugunica every sword keeps it.
 */
function duel(classId: 'guardian' | 'vanguard' = 'vanguard') {
  const game = new Duel();
  const defender = game.add('defender', 'Defender', classId);
  const attacker = game.add('attacker', 'Attacker', 'archer');
  game.state.phase = 'playing';
  Object.assign(defender, { x: 400, y: 270, angle: Math.PI, invuln: 0 });
  Object.assign(attacker, { x: 200, y: 270, angle: 0, invuln: 0 });
  return { game, defender, attacker };
}
function arrow(classId: ClassId, id: number, value: Partial<Arrow> = {}): Arrow {
  return { id, owner: 'attacker', team: 'red', classId, x: 350, y: 270, angle: 0, life: 1, ...value };
}
function impact(game: Duel, id = 'defender') {
  const p = game.state.players.find(player => player.id === id)!;
  p.windup = RULES.tick;
  p.swingAngle = p.angle;
  p.swordCd = CLASSES[p.classId].meleeCooldown;
  game.step(new Map([[id, input()]]));
}

describe('sword cuts', () => {
  it('uses the normal sword input and only opens the cut on its impact tick', () => {
    const { game, defender } = duel();
    game.step(new Map([['defender', input({ sword: true, angle: Math.PI })]]));
    expect(defender.windup).toBeGreaterThan(0);
    expect(game.state.events.some(e => e.kind === 'projectileCut')).toBe(false);
    while (defender.windup > RULES.tick) game.step(new Map([['defender', input({ angle: Math.PI })]]));
    const hp = defender.hp;
    game.state.arrows.push(arrow('archer', 1));
    game.step(new Map([['defender', input({ angle: Math.PI })]]));
    expect(game.state.arrows).toHaveLength(0);
    expect(game.state.events.filter(e => e.kind === 'projectileCut')).toHaveLength(1);
    expect(defender.hp).toBe(hp);
  });

  it('cuts a diagonal projectile and a fast wind arrow along their traveled segments', () => {
    const { game, defender } = duel();
    const angle = Math.atan2(-25, -50);
    defender.angle = angle;
    game.state.arrows.push(
      arrow('archer', 1, { x: 350, y: 245, angle: Math.atan2(25, 50) }),
      arrow('archer', 2, { x: 350, y: 270, wind: true, angle: 0 }),
    );
    impact(game);
    expect(game.state.events.filter(e => e.kind === 'projectileCut')).toHaveLength(2);
    expect(game.state.arrows).toHaveLength(0);
  });

  it('destroys multiple incoming enemy shots without taking damage', () => {
    const { game, defender } = duel();
    const hp = defender.hp;
    game.state.arrows.push(arrow('archer', 1), arrow('mage', 2, { ice: true, skillId: 'mage.ice', y: 273 }), arrow('vanguard', 3, { slash: true, hits: [], skillId: 'vanguard.slash', y: 267 }));
    impact(game);
    expect(game.state.arrows).toHaveLength(0);
    expect(game.state.events.filter(e => e.kind === 'projectileCut')).toHaveLength(3);
    expect(defender.hp).toBe(hp);
    expect(defender.frozenLeft).toBe(0);
  });

  it('cancels an explosive spell before its blast and leaves the shooter unharmed', () => {
    const { game, defender, attacker } = duel();
    const hp = defender.hp;
    game.state.arrows.push(arrow('mage', 4, { skillId: 'mage.fireball', power: 1, x: 348 }));
    impact(game);
    expect(game.state.arrows).toHaveLength(0);
    expect(game.state.events.some(e => e.kind === 'explosion')).toBe(false);
    expect(defender.hp).toBe(hp);
    expect(attacker.hp).toBe(CLASSES.archer.hp);
  });

  it('requires a live sword impact, the front arc, range and an incoming hostile shot', () => {
    for (const shot of [
      arrow('archer', 1, { x: 450, angle: Math.PI }), // arrives from behind
      arrow('archer', 2, { x: 280 }), // too far away this tick
      arrow('archer', 3, { x: 350, angle: Math.PI }), // moving away
      arrow('archer', 4, { x: 350, team: 'blue' }), // allied
    ]) {
      const { game, defender } = duel();
      game.state.arrows.push(shot);
      impact(game);
      expect(game.state.events.filter(e => e.kind === 'projectileCut')).toHaveLength(0);
      expect(defender.hp).toBe(CLASSES.vanguard.hp);
    }
    const { game, defender } = duel();
    game.state.arrows.push(arrow('archer', 5, { x: 377 }));
    game.step(new Map([['defender', input()]]));
    expect(defender.hp).toBeLessThan(CLASSES.vanguard.hp);
    expect(game.state.events.some(e => e.kind === 'projectileCut')).toBe(false);
  });

  it('resolves sword cut before an active warrior counter when the blade intercepts', () => {
    const { game, defender } = duel('vanguard');
    defender.counterLeft = 1;
    game.state.arrows.push(arrow('archer', 1));
    impact(game);
    expect(game.state.arrows).toHaveLength(0);
    expect(game.state.events.some(e => e.kind === 'projectileCut')).toBe(true);
    expect(game.state.events.some(e => e.kind === 'counter')).toBe(false);
  });

  it('also cuts a monster shot in the persistent world', () => {
    const world = new World();
    const p = world.join(newCharacter('hero', 'account', 'Hero', 'guardian'));
    Object.assign(p, { x: 800, y: 800, angle: Math.PI, invuln: 0 });
    const hp = p.hp;
    const shot: MobShot = { id: 1, owner: 'wild:test', x: 750, y: 800, angle: 0, speed: 300, damage: 2, life: 1, radius: 4, color: '#bada55' };
    world.state.mobShots.push(shot);
    impact(world, 'hero');
    expect(world.state.mobShots).toHaveLength(0);
    expect(world.state.events.filter(e => e.kind === 'projectileCut')).toHaveLength(1);
    expect(p.hp).toBe(hp);
  });

  it('cuts skeleton projectiles in Hordas before they damage a player', () => {
    const game = new Duel('courtyard', 'pve');
    const defender = game.add('defender', 'Defender', 'vanguard');
    game.state.phase = 'playing';
    game.state.pve = { objective: 'elimination', wave: 1, initialPartySize: 1, pendingBudget: 0, spawnedAll: true, enemiesRemaining: 1, rewardLeft: 0, chosen: [], completed: false, endless: false, bossActive: false, kills: {}, damage: {} };
    Object.assign(defender, { x: 400, y: 270, angle: Math.PI, invuln: 0 });
    game.state.mobs.push({ id: 'skeleton', kind: 'skeleton', x: 180, y: 80, hp: 10, maxHp: 10, angle: 0, speed: 0, damage: 1, attackCd: 99, specialCd: 0, windup: 0, spawnLeft: 0, frozenLeft: 0, target: null, elite: false, boss: false, bushId: null, revealLeft: 0 });
    game.state.mobProjectiles.push({ id: 1, owner: 'skeleton', x: 350, y: 270, angle: 0, speed: 280, damage: 1, life: 1, radius: 5 });
    impact(game);
    expect(game.state.mobProjectiles).toHaveLength(0);
    expect(game.state.events.filter(e => e.kind === 'projectileCut')).toHaveLength(1);
    expect(defender.hp).toBe(CLASSES.vanguard.hp);
  });

  it('in an arena the knight has no plain swing to cut with: a forced one cuts nothing', () => {
    const { game, defender } = duel('guardian');
    game.state.arrows.push(arrow('archer', 1));
    impact(game);
    for (let i = 0; i < 3; i++) game.step(new Map());
    expect(game.state.events.some(e => e.kind === 'projectileCut')).toBe(false);
    expect(defender.hp).toBeLessThan(CLASSES.guardian.hp);
  });
});
