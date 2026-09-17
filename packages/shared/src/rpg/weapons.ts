import type { ClassId } from '../index.js';
import type { StatId } from './progression.js';

/**
 * What each weapon is, in one place: how the engine simulates it, what kind of attack its click
 * is, which attribute it grows with, and how its bearer looks. Everything that shows or resolves a
 * weapon reads it from here, so a dagger can never again be drawn, aimed or scaled like a bow
 * because the engine happens to simulate it with the archer's body.
 */
export type WeaponId = 'espada' | 'baston' | 'arco' | 'daga' | 'escudo';
export type WeaponLook = 'espadachin' | 'mago' | 'arquero' | 'picaro' | 'escudero';
export type WeaponAttack = 'melee' | 'ranged' | 'spell';

export interface WeaponProfile {
  /** The duel class whose rules resolve its movement and plain attack. Never shown to anyone. */
  engineClass: ClassId;
  attack: WeaponAttack;
  stat: StatId;
  look: WeaponLook;
  /** A swing of its own, when the engine class's (an archer's backup knife) would not do it justice. */
  melee?: { range: number; arc: number; damage: number };
}

export const WEAPON_PROFILE: Record<WeaponId, WeaponProfile> = {
  espada: { engineClass: 'guardian', attack: 'melee', stat: 'might', look: 'espadachin' },
  baston: { engineClass: 'mage', attack: 'spell', stat: 'spirit', look: 'mago' },
  arco: { engineClass: 'archer', attack: 'ranged', stat: 'agility', look: 'arquero' },
  // Quick and close: twice the archer's knife in reach and bite, still the shortest blade there is.
  daga: { engineClass: 'archer', attack: 'melee', stat: 'agility', look: 'picaro', melee: { range: 48, arc: Math.PI * 0.7, damage: 0.9 } },
  escudo: { engineClass: 'vanguard', attack: 'melee', stat: 'might', look: 'escudero' },
};
