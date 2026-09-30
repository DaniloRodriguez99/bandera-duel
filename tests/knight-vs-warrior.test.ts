import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_CUT,
  CLASSES,
  Duel,
  RULES,
  WARRIOR_PARRY,
  WARRIOR_PARRY_CHARGE,
  curve,
  idleInput,
  warriorWave,
  type Input,
  type SkillSlot,
  type SlotInputState,
} from '@bandera/shared';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick - 1e-6);
type Keys = Partial<Record<SkillSlot, Partial<SlotInputState>>>;
const TAP = { pressed: true, released: true };
const DOWN = { pressed: true, held: true };
const HOLD = { held: true };
const input = (keys: Keys = {}, angle = 0): Input => {
  const next = { ...idleInput(1), angle };
  for (const [slot, state] of Object.entries(keys))
    next.slots[slot as SkillSlot] = { pressed: false, held: false, released: false, ...state };
  return next;
};

/** The knight to the west looking east, the warrior to the east looking west, across the open lane. */
function duel(gap = 300) {
  const game = new Duel('courtyard', 'ffa3');
  const knight = game.add('knight', 'Caballero', 'guardian');
  const warrior = game.add('warrior', 'Guerrero', 'vanguard');
  game.add('other', 'Otro', 'archer');
  game.state.phase = 'playing';
  Object.assign(knight, { x: 330, y: 270, angle: 0, invuln: 0, hp: 20, maxHp: 20 });
  Object.assign(warrior, { x: 330 + gap, y: 270, angle: Math.PI, invuln: 0, hp: 20, maxHp: 20 });
  const step = (knightKeys: Keys = {}, warriorKeys: Keys = {}, count = 1) => {
    for (let i = 0; i < count; i++)
      game.step(new Map([[knight.id, input(knightKeys, 0)], [warrior.id, input(warriorKeys, Math.PI)]]));
  };
  const events = (kind: string) => game.state.events.filter((event) => event.kind === kind);
  return { game, knight, warrior, step, events };
}

describe('Caballero contra Guerrero', () => {
  it('la guardia sostenida le devuelve el Corte Celestial al Caballero; a tiempo, solo lo frena', () => {
    const meet = (hold: number) => {
      const { game, knight, warrior, step } = duel();
      step({}, { e: DOWN });
      step({}, { e: HOLD }, ticks(hold));
      game.spawnWave(knight, { x: knight.x + RULES.waveLead, y: knight.y }, 0, CELESTIAL_CUT);
      for (let i = 0; i < 30; i++) step({}, { e: HOLD });
      return { knight, warrior, back: game.state.waves.some((w) => w.owner === warrior.id) };
    };
    // Held long enough to turn it: it goes back at the knight.
    const held = meet(1.4);
    expect(curve(WARRIOR_PARRY.power, 1.4)).toBeGreaterThanOrEqual(CELESTIAL_CUT.resist);
    expect(held.warrior.hp).toBe(20);
    expect(held.back || held.knight.hp < 20).toBe(true);
    // A quick guard cannot send it back, but it still takes it.
    const quick = meet(0);
    expect(quick.back).toBe(false);
    expect(quick.warrior.hp).toBe(20);
  });

  it('el Paso Relámpago contra la guardia del Guerrero: frenado, y el Caballero tambalea', () => {
    const { knight, warrior, step, events } = duel(120);
    step({}, { e: DOWN });
    step({ mobility: TAP }, { e: HOLD });
    let staggered = 0;
    for (let i = 0; i < 10; i++) {
      step({}, { e: HOLD });
      staggered = Math.max(staggered, knight.stunLeft);
    }
    expect(warrior.hp).toBe(20);
    expect(staggered).toBeGreaterThan(0);
    expect(events('counter').length).toBeGreaterThan(0);
  });

  it('el Corte Celestial parte una Creciente completa, pero la ola colosal solo la debilita', () => {
    const clash = (seconds: number) => {
      const { game, knight, warrior, step } = duel(600);
      game.spawnWave(warrior, { x: warrior.x - RULES.waveLead, y: warrior.y }, Math.PI, warriorWave(seconds));
      game.spawnWave(knight, { x: knight.x + RULES.waveLead, y: knight.y }, 0, CELESTIAL_CUT);
      for (let i = 0; i < 45; i++) step();
      return 20 - knight.hp;
    };
    expect(clash(3)).toBe(0);
    expect(clash(7)).toBeGreaterThan(0);
  });

  it('la Creciente completa del Guerrero parte el Corte Celestial', () => {
    const { game, knight, warrior, step } = duel(600);
    game.spawnWave(knight, { x: knight.x + RULES.waveLead, y: knight.y }, 0, CELESTIAL_CUT);
    game.spawnWave(warrior, { x: warrior.x - RULES.waveLead, y: warrior.y }, Math.PI, warriorWave(3));
    for (let i = 0; i < 45; i++) step();
    expect(warrior.hp).toBe(20);
  });

  it('un toque del parry no deja al Guerrero bloquear para siempre: la guardia cae y espera su recarga', () => {
    const { warrior, step } = duel();
    step({}, { e: TAP });
    step({}, {}, ticks(WARRIOR_PARRY.window) + 1);
    expect(warrior.counterLeft).toBe(0);
    for (let i = 0; i < 10; i++) step({}, { e: TAP });
    expect(warrior.counterLeft).toBe(0);
    expect(warrior.counterCd).toBeGreaterThan(0);
    expect(CLASSES.vanguard.mana).toBeGreaterThan(WARRIOR_PARRY_CHARGE.cap * 12);
  });
});
