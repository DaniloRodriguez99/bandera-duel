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
}

export const WEAPON_PROFILE: Record<WeaponId, WeaponProfile> = {
  espada: { engineClass: 'guardian', attack: 'melee', stat: 'might', look: 'espadachin' },
  baston: { engineClass: 'mage', attack: 'spell', stat: 'spirit', look: 'mago' },
  arco: { engineClass: 'archer', attack: 'ranged', stat: 'agility', look: 'arquero' },
  daga: { engineClass: 'archer', attack: 'melee', stat: 'agility', look: 'picaro' },
  escudo: { engineClass: 'vanguard', attack: 'melee', stat: 'might', look: 'escudero' },
};
