import { describe, it, expect } from 'vitest';
import { Duel, CLASSES, RULES, idleInput, type GameEvent, type Input } from '@bandera/shared';
const input = (options: Partial<Input> = {}): Input => ({ ...idleInput(), ...options });
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
/** A necromancer with a freshly summoned zombie mage and three idle rivals out of the way. */
function setup() {
  const d = new Duel('courtyard', 'ffa4');
  const n = d.add('n', 'N', 'necromancer'),
    a = d.add('a', 'A', 'guardian'),
    b = d.add('b', 'B', 'vanguard'),
    c = d.add('c', 'C', 'archer');
  d.state.phase = 'playing';
  Object.assign(n, { x: 120, y: 270, angle: 0, zombieAuto: true });
  Object.assign(a, { x: 880, y: 100 });
  Object.assign(b, { x: 880, y: 500 });
  Object.assign(c, { x: 600, y: 500 });
  const events: GameEvent[] = [];
  let lastEvent = 0;
  const run = (count: number, necro: Partial<Input> = {}) => {
    for (let i = 0; i < count; i++) {
      d.step(new Map([['n', input(necro)]]));
      for (const e of d.state.events)
        if (e.id > lastEvent) {
          events.push(e);
          lastEvent = e.id;
        }
    }
  };
  run(ticks(0.6), { special: true });
  run(1, { summon: true });
  const hat = d.state.zombies.find((z) => z.kind === 'hat')!;
  return { d, a, b, c, hat, run, events };
}
describe('zombie mago', () => {
  it('alterna hielo y fuego con 0,5 s de casteo y 1 s entre hechizos, lanzando ráfagas de viento entre medio', () => {
    const { d, a, hat, run, events } = setup();
    Object.assign(a, { x: hat.x + 90, y: hat.y, hp: 99, invuln: 0 });
    const casts: { tick: number; power: number }[] = [];
    const spells: { tick: number; spell: 'ice' | 'fire' }[] = [];
    const seen = new Set<number>();
    let gusts = 0;
    for (let tick = 0; tick < ticks(6); tick++) {
      const before = events.length;
      run(1);
      for (const e of events.slice(before)) {
        if (e.kind === 'cast') casts.push({ tick, power: e.power ?? 0 });
        if (e.kind === 'icecone') spells.push({ tick, spell: 'ice' });
      }
      for (const arrow of d.state.arrows)
        if (!seen.has(arrow.id)) {
          seen.add(arrow.id);
          if (arrow.blast) spells.push({ tick, spell: 'fire' });
          if (arrow.gust) gusts++;
        }
    }
    expect(spells.slice(0, 3).map((s) => s.spell)).toEqual(['ice', 'fire', 'ice']);
    for (let k = 0; k < 3; k++) {
      // The cast event announces the spell (the mandala color) and the spell lands 0.5 s later.
      expect(casts[k].power).toBe(spells[k].spell === 'fire' ? 1 : 0);
      expect(spells[k].tick - casts[k].tick).toBeGreaterThanOrEqual(ticks(RULES.hatCastTime) - 1);
      expect(spells[k].tick - casts[k].tick).toBeLessThanOrEqual(ticks(RULES.hatCastTime) + 1);
    }
    expect(casts[1].tick - spells[0].tick).toBeGreaterThanOrEqual(ticks(RULES.hatCastCooldown) - 1);
    expect(gusts).toBeGreaterThan(0);
  });
  it('el hielo es un cono que daña y congela a todos adentro, sin tocar a quien está detrás', () => {
    const { d, a, b, c, hat, run } = setup();
    const at = (reach: number, degrees: number) => ({
      x: hat.x + Math.cos((degrees * Math.PI) / 180) * reach,
      y: hat.y + Math.sin((degrees * Math.PI) / 180) * reach,
    });
    Object.assign(a, { ...at(60, 0), invuln: 0 });
    Object.assign(b, { ...at(110, 20), invuln: 0 });
    Object.assign(c, { x: hat.x - 90, y: hat.y, invuln: 0 });
    let cone = false;
    for (let i = 0; i < ticks(2) && !cone; i++) {
      run(1);
      cone = d.state.events.some((e) => e.kind === 'icecone');
    }
    expect(cone).toBe(true);
    expect(a.frozenLeft).toBeGreaterThan(0);
    expect(b.frozenLeft).toBeGreaterThan(0);
    expect(a.hp).toBeCloseTo(CLASSES.guardian.hp - RULES.spellDamage);
    expect(b.hp).toBeCloseTo(CLASSES.vanguard.hp - RULES.spellDamage);
    expect(c.frozenLeft).toBe(0);
    expect(c.hp).toBe(CLASSES.archer.hp);
  });
  it('el fuego es una bola en área que atraviesa y quema una vez a cada uno en su camino', () => {
    const { d, a, b, hat, run } = setup();
    hat.spell = 'fire';
    Object.assign(a, { x: hat.x + 70, y: hat.y, hp: 99, invuln: 0 });
    Object.assign(b, { x: hat.x + 140, y: hat.y + 10, hp: 99, invuln: 0 });
    let blast = d.state.arrows.find((arrow) => arrow.blast);
    for (let i = 0; i < ticks(2) && !blast; i++) {
      run(1);
      blast = d.state.arrows.find((arrow) => arrow.blast);
    }
    expect(blast).toBeDefined();
    run(ticks(RULES.hatFireLife));
    expect(blast!.hits).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(new Set(blast!.hits).size).toBe(blast!.hits!.length);
  });
});
