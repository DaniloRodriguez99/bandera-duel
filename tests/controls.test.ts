import { describe, expect, it } from 'vitest';
import {
  CLASSES,
  Duel,
  RULES,
  SKILLS,
  chargingSkills,
  idleInput,
  type ClassId,
  type Input,
  type SkillSlot,
  type SlotInputState,
} from '@bandera/shared';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
type Keys = Partial<Record<SkillSlot, Partial<SlotInputState>>>;
/** One tick of input: some keys in some state, aiming at a map point. */
const input = (keys: Keys = {}, extra: Partial<Input> = {}) => {
  const next = { ...idleInput(1), aimX: 700, aimY: 270, ...extra };
  for (const [slot, state] of Object.entries(keys))
    next.slots[slot as SkillSlot] = { pressed: false, held: false, released: false, ...state };
  return next;
};
const tap = { pressed: true, released: true };
const hold = { held: true };
function arena(classId: ClassId) {
  const duel = new Duel('courtyard', 'duel');
  const p = duel.add('a', 'Jugador', classId);
  const rival = duel.add('b', 'Rival', 'guardian');
  duel.state.phase = 'playing';
  Object.assign(p, { x: 370, y: 270 });
  Object.assign(rival, { x: 820, y: 450 });
  const step = (keys: Keys = {}, extra: Partial<Input> = {}, n = 1) => {
    for (let i = 0; i < n; i++) duel.step(new Map([['a', input(keys, extra)]]));
  };
  return { duel, p, step };
}

describe('un solo lenguaje de controles', () => {
  it('Arquero: Q es la salva triple, E el cepo', () => {
    const { duel, p, step } = arena('archer');
    step({ q: tap });
    expect(duel.state.arrows.filter((a) => a.owner === 'a')).toHaveLength(3);
    expect(p.volleyCd).toBeGreaterThan(0);
    step({}, {}, ticks(0.3));
    step({ e: tap });
    expect(p.trapCd).toBeGreaterThan(0);
  });

  it('Mago: Q la saeta, E el escudo, F Singularidad y Espacio Parpadeo', () => {
    const { duel, p, step } = arena('mage');
    step({ q: tap });
    expect(duel.state.arrows.some((a) => a.skillId === 'mage.ice')).toBe(true);
    Object.assign(p, { magicShieldHits: 0, magicShieldCd: 0 });
    step({ e: tap });
    expect(p.magicShieldHits).toBe(RULES.magicShieldHits);
    step({ f: { pressed: true, held: true } });
    step({ f: hold }, {}, ticks(1));
    step({ f: { released: true } });
    expect(duel.state.blackHoles).toHaveLength(1);
    step({ mobility: tap }, {}, ticks(RULES.mageBlinkMinCharge) + 1);
    expect(duel.state.events.some((e) => e.kind === 'blink')).toBe(true);
  });

  it('Nigromante: F invoca (toque, zombie mago al mantener), E es Mando y el clic derecho Marcar', () => {
    const { duel, p, step } = arena('necromancer');
    // Space is no mobility of its own: it does nothing.
    step({ mobility: tap });
    expect(p.summonCd).toBe(0);
    step({ f: tap });
    expect(p.summonCd).toBeGreaterThan(0);
    step({}, {}, ticks(1));
    const own = () => duel.state.zombies.filter((z) => z.owner === 'a');
    expect(own()).toHaveLength(2);
    // Mando toggles automatic zombies; Marcar moves the zombie under the cursor between circles.
    step({}, { command: true });
    expect(p.zombieAuto).toBe(true);
    const zombie = own()[0];
    const role = zombie.role;
    step({}, { mark: true, aimX: zombie.x, aimY: zombie.y });
    expect(zombie.role).not.toBe(role);
    // Holding F past the tap raises the zombie mage.
    p.summonCd = 0;
    step({ f: { pressed: true, held: true } });
    step({ f: hold }, {}, ticks(0.6));
    expect(p.specialCharge).toBeGreaterThanOrEqual(RULES.overchargeTap);
    step({ f: { released: true } });
    step({}, {}, ticks(1));
    expect(own().some((z) => z.kind === 'hat')).toBe(true);
    // Held to the end, the aura fills for the raise.
    p.summonCd = 0;
    step({ f: { pressed: true, held: true } });
    step({ f: hold }, {}, ticks(RULES.raiseCharge));
    expect(p.specialCharge).toBeGreaterThanOrEqual(RULES.overchargeTime);
  });

  it('Caballero: M1 encadena cortes, M2 es la Ráfaga, Espacio el paso y R el Despertar', () => {
    const { p, step } = arena('guardian');
    step({ primary: tap });
    expect(p.move).toBe('guardian.sword:0:0');
    step({}, {}, ticks(0.5));
    step({ secondary: tap });
    expect(p.move).toBe('guardian.flurry:0');
    expect(p.flurryCd).toBeGreaterThan(0);
    step({}, {}, ticks(0.6));
    step({ mobility: tap });
    expect(p.dashCd).toBeGreaterThan(0);
    step({}, {}, ticks(0.5));
    // The ultimate asks for a full bar of Rage; Q, E and F are free.
    step({ r: tap });
    expect(p.furyLeft).toBe(0);
    p.rage = 100;
    step({ r: tap, q: tap, e: tap, f: tap });
    expect(p.furyLeft).toBeGreaterThan(0);
  });

  it('Guerrero: Q el tajo viajero, E el contraataque', () => {
    const { p, step } = arena('vanguard');
    step({ q: tap });
    expect(p.slashCd).toBeGreaterThan(0);
    step({}, {}, ticks(0.3));
    step({ e: { pressed: true, held: true } });
    expect(p.counterLeft).toBeGreaterThan(0);
  });
});

describe('habilidades simultáneas', () => {
  it('el Mago se mueve, parpadea y sigue cargando Singularidad (A + Espacio + F)', () => {
    const { duel, p, step } = arena('mage');
    step({ f: { pressed: true, held: true } }, { x: -1, y: 0 });
    step({ f: hold }, { x: -1, y: 0 }, ticks(0.4));
    const charged = p.blackHoleCharge;
    const before = { x: p.x, y: p.y };
    // Walking left, tap Space mid-charge: the blink waits out its windup, lands toward the cursor, and F
    // keeps charging.
    step({ f: hold, mobility: tap }, { x: -1, y: 0 });
    step({ f: hold }, { x: -1, y: 0 }, ticks(RULES.mageBlinkMinCharge) + 1);
    expect(duel.state.events.some((e) => e.kind === 'blink')).toBe(true);
    expect(Math.hypot(p.x - before.x, p.y - before.y)).toBeGreaterThan(60);
    expect(p.blackHoleCharge).toBeGreaterThan(charged);
    const from = { x: p.x, y: p.y };
    step({ f: { released: true } });
    expect(duel.state.blackHoles).toHaveLength(1);
    // Launched from where the blink left the mage.
    expect(Math.hypot(duel.state.blackHoles[0].x - from.x, duel.state.blackHoles[0].y - from.y)).toBeLessThan(20);
  });

  it('el Mago mantiene el clic cargado, parpadea y lo suelta al aparecer', () => {
    const { duel, p, step } = arena('mage');
    step({ primary: { pressed: true, held: true } });
    step({ primary: hold }, {}, ticks(RULES.overchargeTime));
    expect(p.shotCharge).toBe(RULES.overchargeTime);
    // Space while the click stays held: the charge survives the windup and the jump.
    step({ primary: hold, mobility: tap });
    step({ primary: hold }, {}, ticks(RULES.mageBlinkMinCharge) + 1);
    expect(duel.state.events.some((e) => e.kind === 'blink')).toBe(true);
    expect(p.shotCharge).toBe(RULES.overchargeTime);
    step({ primary: { released: true } });
    const orb = duel.state.arrows.find((a) => a.skillId === 'mage.fireball');
    expect(orb?.power).toBe(1);
  });

  it('soltar el clic cargado en pleno aterrizaje también dispara y corta la invulnerabilidad', () => {
    const { duel, p, step } = arena('mage');
    step({ primary: { pressed: true, held: true } });
    step({ primary: hold }, {}, ticks(RULES.overchargeTime));
    step({ primary: hold, mobility: tap });
    // Step until the blink lands, then release while its i-frames still run.
    for (let i = 0; i < ticks(1) && !duel.state.events.some((e) => e.kind === 'blink'); i++) step({ primary: hold });
    expect(p.dashInvulnerable).toBe(true);
    step({ primary: { released: true } });
    expect(duel.state.arrows.find((a) => a.skillId === 'mage.fireball')?.power).toBe(1);
    expect(p.dashInvulnerable).toBe(false);
    expect(p.dashLeft).toBe(0);
  });

  it('cargar F ocupa las manos para M1 pero deja libre la Q', () => {
    const { duel, p, step } = arena('mage');
    step({ f: { pressed: true, held: true } });
    step({ f: hold, primary: tap });
    expect(duel.state.arrows.some((a) => a.skillId === 'mage.fireball')).toBe(false);
    step({ f: hold, q: tap });
    expect(duel.state.arrows.some((a) => a.skillId === 'mage.ice')).toBe(true);
    expect(p.blackHoleCharge).toBeGreaterThan(0);
    expect(SKILLS['mage.blackHole'].blocks).toEqual(['primary', 'secondary']);
  });

  it('dos cargas a la vez no suman su lentitud', () => {
    const { p, step } = arena('mage');
    step({ f: { pressed: true, held: true }, mobility: { pressed: true, held: true } });
    expect(chargingSkills(p)).toEqual(['mage.blackHole', 'mage.blink']);
    const x = p.x;
    step({ f: hold, mobility: hold }, { x: 1 });
    expect(p.x - x).toBeCloseTo(CLASSES.mage.speed * RULES.chargeMoveSpeed * RULES.tick);
  });
});
