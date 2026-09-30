import { describe, expect, it } from 'vitest';
import {
  CLASSES,
  CLASS_IDS,
  Duel,
  RESOURCES,
  RULES,
  SKILLS,
  idleInput,
  movePlayer,
  newPlayer,
  resolveSlotInput,
  resourcePool,
  slotOf,
  type Input,
  type Player,
  type SlotInputState,
} from '@bandera/shared';
import { World, newCharacter } from '@bandera/shared/world';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick - 1e-6);
const FLURRY = SKILLS['guardian.flurry'].cost!;

/** A knight pressing, holding or letting go of the flurry's key, wherever it is bound. */
function flurry(p: Player, state: Partial<SlotInputState>): Input {
  const input = idleInput(1);
  input.slots[slotOf(p, 'guardian.flurry')!] = { pressed: false, held: false, released: false, ...state };
  return resolveSlotInput(p, input);
}
const knight = () => newPlayer('k', 'K', 'blue', 'guardian');

describe('maná en la arena', () => {
  it('cada clase trae su propio pozo; sin habilidades que lo gasten, no hay pozo', () => {
    for (const classId of CLASS_IDS) {
      const p = newPlayer(classId, classId, 'blue', classId);
      expect(p.maxMana).toBe(CLASSES[classId].mana);
      expect(p.mana).toBe(p.maxMana);
      if (!CLASSES[classId].mana) expect(resourcePool(p, 'mana')).toBeNull();
    }
    expect(CLASSES.guardian.mana).toBeGreaterThan(0);
    expect(CLASSES.vanguard.mana).toBeGreaterThan(0);
  });

  it('una habilidad cuesta al salir; cargarla cuesta además por segundo', () => {
    expect(FLURRY).toMatchObject({ resource: 'mana' });
    expect(FLURRY.perSecond).toBeGreaterThan(0);
    const tapped = knight();
    movePlayer(tapped, flurry(tapped, { pressed: true, released: true }), false);
    expect(tapped.move).toBe('guardian.flurry:0');
    expect(tapped.mana).toBe(100 - FLURRY.amount);

    const held = knight();
    movePlayer(held, flurry(held, { pressed: true, held: true }), false);
    for (let i = 1; i < ticks(1); i++) movePlayer(held, flurry(held, { held: true }), false);
    expect(held.mana).toBeCloseTo(100 - FLURRY.perSecond!, 5);
    movePlayer(held, flurry(held, { released: true }), false);
    expect(held.move).not.toBe('');
    expect(held.mana).toBeCloseTo(100 - FLURRY.perSecond! - FLURRY.amount, 5);
  });

  it('un pozo seco congela la carga, sin tocar lo que cuesta soltarla', () => {
    const p = knight();
    p.mana = FLURRY.amount + 5;
    movePlayer(p, flurry(p, { pressed: true, held: true }), false);
    for (let i = 0; i < ticks(1); i++) movePlayer(p, flurry(p, { held: true }), false);
    // Five points buy a third of a second of hold at fifteen a second, and no more.
    expect(p.chargeT).toBeGreaterThan(5 / FLURRY.perSecond! - 2 * RULES.tick);
    expect(p.chargeT).toBeLessThan(5 / FLURRY.perSecond! + RULES.tick);
    expect(p.mana).toBeGreaterThanOrEqual(FLURRY.amount - 1e-6);
    movePlayer(p, flurry(p, { released: true }), false);
    expect(p.move).not.toBe('');
    expect(p.mana).toBeCloseTo(0, 5);
  });

  it('sin lo que cuesta, la habilidad no empieza', () => {
    const p = knight();
    p.mana = FLURRY.amount - 1;
    movePlayer(p, flurry(p, { pressed: true, held: true }), false);
    movePlayer(p, flurry(p, { released: true }), false);
    expect(p.chargeSkill).toBe('');
    expect(p.move).toBe('');
    expect(p.mana).toBe(FLURRY.amount - 1);
  });

  it('vuelve sola un momento después de gastarla', () => {
    const p = knight();
    movePlayer(p, flurry(p, { pressed: true, released: true }), false);
    const spent = p.mana;
    for (let i = 0; i < ticks(RESOURCES.mana.regenDelay) - 1; i++) movePlayer(p, idleInput(1), false);
    expect(p.mana).toBe(spent);
    for (let i = 0; i < ticks(1); i++) movePlayer(p, idleInput(1), false);
    expect(p.mana).toBeGreaterThan(spent + RESOURCES.mana.regen * 0.8);
    for (let i = 0; i < ticks(10); i++) movePlayer(p, idleInput(1), false);
    expect(p.mana).toBe(p.maxMana);
  });

  it('en Lugunica el pozo es del personaje: la arena no lo rellena ni lo cambia', () => {
    const p = newPlayer('v', 'V', 'blue', 'vanguard');
    Object.assign(p, { mana: 10, maxMana: 40 });
    for (let i = 0; i < ticks(3); i++) movePlayer(p, { ...idleInput(1), world: true }, false);
    expect(p.mana).toBe(10);
    const world = new World();
    const hero = world.join(newCharacter('hero', 'account', 'Hero', 'vanguard'));
    const pool = hero.maxMana;
    hero.mana = 1;
    (world as unknown as { revive(p: Player): void }).revive(hero);
    expect(hero.maxMana).toBe(pool);
    expect(hero.mana).toBe(1);
  });

  it('morir en una arena devuelve el pozo lleno', () => {
    const duel = new Duel('courtyard', 'duel');
    const k = duel.add('k', 'K', 'guardian');
    const foe = duel.add('f', 'F', 'archer');
    duel.state.phase = 'playing';
    k.mana = 3;
    Object.assign(k, { invuln: 0 });
    duel.damage(k, foe, 0, k.hp);
    for (let i = 0; i < ticks(RULES.respawn) + 2 && k.hp <= 0; i++) duel.step(new Map());
    expect(k.hp).toBeGreaterThan(0);
    expect(k.mana).toBe(CLASSES.guardian.mana);
  });
});

describe('controles de prueba del maná', () => {
  it('solo existen donde se habilitan', () => {
    const duel = new Duel();
    duel.add('k', 'K', 'guardian');
    expect(duel.state.devTools).toBeUndefined();
    expect(duel.setManaLimit(false)).toBe(false);
    expect(duel.refillMana('k')).toBe(false);
    duel.enableDevTools();
    expect(duel.state.devTools).toEqual({ manaLimit: true });
  });

  it('sin límite los pozos quedan llenos, aunque se gaste y se cargue', () => {
    const duel = new Duel('courtyard', 'duel');
    duel.enableDevTools();
    const k = duel.add('k', 'K', 'guardian');
    duel.add('f', 'F', 'archer');
    duel.state.phase = 'playing';
    duel.setManaLimit(false);
    const step = (state: Partial<SlotInputState>) => duel.step(new Map([['k', flurry(k, state)]]));
    step({ pressed: true, held: true });
    for (let i = 0; i < ticks(1); i++) {
      step({ held: true });
      expect(k.mana).toBe(k.maxMana);
    }
    step({ released: true });
    expect(k.move).not.toBe('');
    expect(k.mana).toBe(k.maxMana);
    // The cooldown still counts: only the price is waived.
    expect(k.flurryCd).toBeGreaterThan(0);
  });

  it('recargar llena el pozo de quien lo pide, con el límite puesto', () => {
    const duel = new Duel('courtyard', 'duel');
    duel.enableDevTools();
    const k = duel.add('k', 'K', 'guardian');
    const v = duel.add('v', 'V', 'vanguard');
    k.mana = 5;
    v.mana = 7;
    expect(duel.refillMana('k')).toBe(true);
    expect(k.mana).toBe(k.maxMana);
    expect(v.mana).toBe(7);
    expect(duel.state.devTools?.manaLimit).toBe(true);
  });
});
