import { describe, expect, it } from 'vitest';
import {
  CLASSES,
  CUT_FLOOR,
  INTERACTIONS,
  SKILLS,
  affordable,
  arrowProfile,
  chargeProgress,
  chargeTier,
  cutOutcome,
  gainResource,
  newPlayer,
  parryOutcome,
  payCost,
  resourcePool,
  skillCost,
  type ChargeSpec,
} from '@bandera/shared';

describe('corte de habilidades', () => {
  it('escala con la potencia: nada, una parte, o el corte completo', () => {
    const target = { ...INTERACTIONS.heavyShot, cutResistance: 1 };
    expect(cutOutcome(0, target)).toEqual({ result: 'none', share: 0 });
    expect(cutOutcome(CUT_FLOOR - 0.05, target).result).toBe('none');
    expect(cutOutcome(0.25, target)).toEqual({ result: 'weaken', share: 0.25 });
    expect(cutOutcome(0.5, target)).toEqual({ result: 'weaken', share: 0.5 });
    expect(cutOutcome(0.75, target)).toEqual({ result: 'weaken', share: 0.75 });
    expect(cutOutcome(1, target)).toEqual({ result: 'destroy', share: 1 });
    expect(cutOutcome(Infinity, target).result).toBe('destroy');
  });

  it('cada ataque trae su resistencia: lo liviano se corta antes', () => {
    expect(cutOutcome(0.75, INTERACTIONS.lightShot).result).toBe('destroy');
    expect(cutOutcome(0.75, INTERACTIONS.heavyShot).result).toBe('weaken');
    // An overcharged slash takes more than a full cut.
    const colossal = { ...INTERACTIONS.wave, cutResistance: 2 };
    expect(cutOutcome(1, colossal)).toEqual({ result: 'weaken', share: 0.5 });
    expect(cutOutcome(1.5, colossal)).toEqual({ result: 'weaken', share: 0.75 });
  });

  it('lo que no se puede cortar no se corta, y lo indestructible solo se debilita', () => {
    expect(cutOutcome(Infinity, INTERACTIONS.area).result).toBe('none');
    expect(cutOutcome(5, INTERACTIONS.melee).result).toBe('none');
    expect(cutOutcome(2, { ...INTERACTIONS.heavyShot, canBeDestroyed: false })).toEqual({ result: 'weaken', share: 1 });
  });

  it('las flechas comunes son livianas; las cargadas, de viento o en área, pesadas', () => {
    expect(arrowProfile({})).toBe(INTERACTIONS.lightShot);
    expect(arrowProfile({ power: 0.2 })).toBe(INTERACTIONS.lightShot);
    expect(arrowProfile({ power: 1 })).toBe(INTERACTIONS.heavyShot);
    expect(arrowProfile({ wind: true })).toBe(INTERACTIONS.heavyShot);
    expect(arrowProfile({ charged: true })).toBe(INTERACTIONS.heavyShot);
    expect(arrowProfile({ blast: true })).toBe(INTERACTIONS.heavyShot);
  });
});

describe('parry de habilidades', () => {
  it('devuelve lo que se puede devolver, frena lo que no y falla ante lo imparable', () => {
    expect(parryOutcome(1, INTERACTIONS.lightShot)).toBe('redirect');
    expect(parryOutcome(1, INTERACTIONS.wave)).toBe('redirect');
    expect(parryOutcome(1, INTERACTIONS.melee)).toBe('block');
    expect(parryOutcome(1, INTERACTIONS.area)).toBe('none');
    expect(parryOutcome(1, { ...INTERACTIONS.wave, parryResistance: 2 })).toBe('none');
  });
});

describe('estados de carga', () => {
  const spec: ChargeSpec = {
    tiers: [
      { id: 'low', at: 0, label: 'Toque' },
      { id: 'mid', at: 0.5, label: 'Media' },
      { id: 'max', at: 1.2, label: 'Máxima' },
    ],
    cap: 3,
    breakOnDamage: { cooldown: 0.5 },
    cancelOnMobility: true,
  };
  it('el estado es el último escalón alcanzado', () => {
    expect(chargeTier(spec, 0).tier.id).toBe('low');
    expect(chargeTier(spec, 0.49).tier.id).toBe('low');
    expect(chargeTier(spec, 0.5)).toMatchObject({ index: 1, tier: { id: 'mid' } });
    expect(chargeTier(spec, 1.2).tier.id).toBe('max');
    expect(chargeTier(spec, 9).tier.id).toBe('max');
  });
  it('la carga puede seguir creciendo después del último escalón', () => {
    expect(chargeProgress(spec, 1.2)).toBeCloseTo(0.4);
    expect(chargeProgress(spec, 3)).toBe(1);
    expect(chargeProgress(spec, 30)).toBe(1);
  });
});

describe('recursos', () => {
  const knight = () => newPlayer('k', 'K', 'blue', 'guardian');

  it('el maná es del juego, no de la interfaz: se gana hasta su tope', () => {
    const p = knight();
    expect(resourcePool(p, 'mana')).toEqual({ value: CLASSES.guardian.mana, max: CLASSES.guardian.mana });
    p.mana = 10;
    gainResource(p, 'mana', 40);
    expect(p.mana).toBe(50);
    gainResource(p, 'mana', 900);
    expect(p.mana).toBe(CLASSES.guardian.mana);
    // A pool no class brings yet is nobody's: it neither blocks nor pays.
    expect(resourcePool(p, 'stamina')).toBeNull();
  });

  it('una clase sin maná no tiene ese recurso, y nada queda sin poder pagarse', () => {
    const p = newPlayer('a', 'A', 'blue', 'archer');
    expect(resourcePool(p, 'mana')).toBeNull();
    const ids = Object.keys(SKILLS) as (keyof typeof SKILLS)[];
    expect(ids.filter((id) => !affordable(p, id))).toEqual([]);
    // The knight's awakening waits on its cooldown, not on a bar.
    expect(skillCost('guardian.fury')).toBeUndefined();
    gainResource(p, 'mana', 10);
    expect(p.mana).toBe(0);
  });

  it('una habilidad con costo solo sale si alcanza, y gasta lo que dice', () => {
    const p = knight();
    const fury = SKILLS['guardian.fury'];
    const original = { cost: fury.cost, mana: fury.mana };
    try {
      // A minimum above what it spends: it asks for 60 to start and takes 25.
      fury.cost = { resource: 'mana', amount: 25, min: 60 };
      expect(skillCost('guardian.fury')).toMatchObject({ resource: 'mana', amount: 25 });
      p.mana = 59;
      expect(affordable(p, 'guardian.fury')).toBe(false);
      p.mana = 60;
      expect(affordable(p, 'guardian.fury')).toBe(true);
      payCost(p, 'guardian.fury');
      expect(p.mana).toBe(35);
      // The short form: a bare mana cost, paid from a character that has a pool.
      fury.cost = undefined;
      fury.mana = 30;
      Object.assign(p, { mana: 20, maxMana: 50 });
      expect(skillCost('guardian.fury')).toEqual({ resource: 'mana', amount: 30 });
      expect(affordable(p, 'guardian.fury')).toBe(false);
      p.mana = 45;
      expect(affordable(p, 'guardian.fury')).toBe(true);
      payCost(p, 'guardian.fury');
      expect(p.mana).toBe(15);
    } finally {
      Object.assign(fury, original);
    }
  });
});
