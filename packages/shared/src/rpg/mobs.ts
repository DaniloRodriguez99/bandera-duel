import type { MobFamilyId } from './zones.js';

/**
 * World monsters. They reuse the `Zombie` record and its brain (targeting, flanking, pathing),
 * so a family only has to say what its numbers are and how they grow.
 *
 * Stats are never stored derived on the entity: a family plus a level is enough to compute them,
 * the same way `swordZombieStats(level)` already works for the necromancer's sword zombie.
 */
/**
 * What a monster can do besides biting. Every skill is telegraphed: the monster stops, a sign
 * grows where it will land, and only then it happens, so a careful player can always step out.
 */
export interface MobSkill {
  id: string;
  name: string;
  kind: 'bolt' | 'nova' | 'charge' | 'howl' | 'heal' | 'summon';
  cooldown: number;
  /** Seconds of warning before it lands. */
  windup: number;
  /** Used only when its target stands between these distances. */
  min: number;
  max: number;
  /** Multiplier on the monster's own damage. */
  damage?: number;
  radius?: number;
  speed?: number;
  /** A nova can land on the target instead of around the monster. */
  at?: 'self' | 'target';
  freeze?: number;
  poison?: { dps: number; seconds: number };
  buff?: { damage: number; seconds: number };
  /** Fraction of max health restored to allies around. */
  heal?: number;
  summon?: { familyId: MobFamilyId; count: number; max: number; seconds: number };
  color: string;
}

export interface MobFamily {
  id: MobFamilyId;
  name: string;
  /** Level 1 values; `mobStats` grows them from here. */
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  /** Reach of its attack and the pause between attacks. */
  range: number;
  cooldown: number;
  windup: number;
  /** How far it notices a player. */
  aggro: number;
  /** How far it will chase from its camp before walking back and healing. */
  leash: number;
  /** Experience granted at level 1. */
  xp: number;
  /** A pack fans out around its target instead of queueing at it. */
  packs: boolean;
  /** What it casts, besides its plain attack. */
  kit: MobSkill[];
  /** Holy light and the undead's own rules apply to it. */
  undead?: boolean;
  /** One line for the map and the stolen-tree window. */
  lore: string;
}

export const MOB_FAMILIES: Record<MobFamilyId, MobFamily> = {
  lobezno: {
    id: 'lobezno', name: 'Lobezno', hp: 2, damage: 0.5, speed: 150, radius: 12, range: 24, cooldown: 1, windup: 0.25,
    aggro: 260, leash: 620, xp: 8, packs: true,
    lore: 'Nunca caza solo. Cuando uno aúlla, vienen todos.',
    kit: [{ id: 'aullido', name: 'Aullido', kind: 'howl', cooldown: 12, windup: 0.6, min: 0, max: 260, radius: 260, buff: { damage: 0.4, seconds: 5 }, color: '#c9d6e0' }],
  },
  jabali: {
    id: 'jabali', name: 'Jabalí', hp: 4, damage: 1, speed: 105, radius: 15, range: 30, cooldown: 1.6, windup: 0.45,
    aggro: 200, leash: 520, xp: 14, packs: false,
    lore: 'Escarba el suelo dos veces antes de embestir. Esas dos veces son tu aviso.',
    kit: [{ id: 'embestida', name: 'Embestida', kind: 'charge', cooldown: 6, windup: 0.7, min: 90, max: 260, damage: 1.8, speed: 520, color: '#c9a36b' }],
  },
  duende: {
    id: 'duende', name: 'Duende Ladrón', hp: 1.8, damage: 0.45, speed: 160, radius: 10, range: 22, cooldown: 1, windup: 0.2,
    aggro: 280, leash: 560, xp: 10, packs: true,
    lore: 'Te tira piedras desde lejos y se ríe. Si te acercás, corre.',
    kit: [{ id: 'pedrada', name: 'Pedrada', kind: 'bolt', cooldown: 2.2, windup: 0.4, min: 60, max: 320, damage: 1, speed: 340, color: '#b8a672' }],
  },
  arana: {
    id: 'arana', name: 'Araña', hp: 1.6, damage: 0.6, speed: 170, radius: 11, range: 22, cooldown: 0.8, windup: 0.2,
    aggro: 240, leash: 540, xp: 11, packs: true,
    lore: 'La tela primero, los colmillos después.',
    kit: [{ id: 'telarana', name: 'Telaraña', kind: 'bolt', cooldown: 7, windup: 0.5, min: 40, max: 300, damage: 0.3, speed: 300, freeze: 1.2, color: '#e8eef2' }],
  },
  saqueador: {
    id: 'saqueador', name: 'Saqueador', hp: 5, damage: 1.1, speed: 125, radius: 13, range: 30, cooldown: 1.3, windup: 0.35,
    aggro: 230, leash: 600, xp: 20, packs: false,
    lore: 'Vivía de las granjas. Ahora vive de los que vienen a vengarlas.',
    kit: [{ id: 'botella_fuego', name: 'Botella de Fuego', kind: 'nova', at: 'target', cooldown: 8, windup: 1, min: 80, max: 340, damage: 1.6, radius: 80, color: '#ff7a2f' }],
  },
  ent: {
    id: 'ent', name: 'Ent Joven', hp: 9, damage: 1.2, speed: 70, radius: 18, range: 36, cooldown: 2.2, windup: 0.6,
    aggro: 180, leash: 420, xp: 26, packs: false,
    lore: 'Lento como un árbol, y como un árbol, no se va a mover por vos.',
    kit: [
      { id: 'raices', name: 'Raíces', kind: 'nova', at: 'self', cooldown: 9, windup: 0.9, min: 0, max: 130, damage: 0.8, radius: 130, freeze: 1.4, color: '#6fbf5a' },
      { id: 'savia', name: 'Savia', kind: 'heal', cooldown: 12, windup: 1, min: 0, max: 600, radius: 240, heal: 0.25, color: '#9fe07a' },
    ],
  },
  ghoul: {
    id: 'ghoul', name: 'Ghoul', hp: 3.5, damage: 0.9, speed: 115, radius: 12, range: 26, cooldown: 1.1, windup: 0.3,
    aggro: 250, leash: 560, xp: 18, packs: true, undead: true,
    lore: 'Come lo que encuentra. A veces, lo que encuentra todavía camina.',
    kit: [{ id: 'mordida_podrida', name: 'Mordida Podrida', kind: 'nova', at: 'target', cooldown: 7, windup: 0.45, min: 0, max: 60, damage: 0.8, radius: 40, poison: { dps: 0.35, seconds: 5 }, color: '#9fbf5a' }],
  },
  espiritu_ceniza: {
    id: 'espiritu_ceniza', name: 'Espíritu de Ceniza', hp: 2.6, damage: 1, speed: 135, radius: 12, range: 24, cooldown: 1.2, windup: 0.3,
    aggro: 300, leash: 600, xp: 22, packs: false,
    lore: 'Lo que ardió en las granjas no se apagó: aprendió a moverse.',
    kit: [
      { id: 'brasa', name: 'Brasa', kind: 'bolt', cooldown: 2.4, windup: 0.5, min: 50, max: 380, damage: 1.2, speed: 360, color: '#ff8a3a' },
      { id: 'estallido', name: 'Estallido', kind: 'nova', at: 'self', cooldown: 10, windup: 1.1, min: 0, max: 110, damage: 2, radius: 110, color: '#ffb45a' },
    ],
  },
  sapo: {
    id: 'sapo', name: 'Sapo Pálido', hp: 4, damage: 0.9, speed: 95, radius: 14, range: 28, cooldown: 1.4, windup: 0.4,
    aggro: 240, leash: 520, xp: 24, packs: true,
    lore: 'Su escupitajo no mata. Lo que mata es lo que te hace después.',
    kit: [{ id: 'escupitajo', name: 'Escupitajo Venenoso', kind: 'bolt', cooldown: 4, windup: 0.5, min: 50, max: 300, damage: 0.5, speed: 280, poison: { dps: 0.5, seconds: 5 }, color: '#b6e05a' }],
  },
  esqueleto: {
    id: 'esqueleto', name: 'Esqueleto', hp: 3, damage: 1, speed: 120, radius: 12, range: 28, cooldown: 1.1, windup: 0.3,
    aggro: 260, leash: 580, xp: 12, packs: true, undead: true,
    lore: 'No recuerda por qué pelea. Pelea igual.',
    kit: [],
  },
  nigromante: {
    id: 'nigromante', name: 'Nigromante del Pantano', hp: 6, damage: 1.2, speed: 100, radius: 13, range: 26, cooldown: 1.6, windup: 0.4,
    aggro: 320, leash: 620, xp: 40, packs: false, undead: false,
    lore: 'El pantano le devuelve lo que se tragó. Y él lo pone de pie.',
    kit: [
      { id: 'levantar', name: 'Levantar Huesos', kind: 'summon', cooldown: 14, windup: 1.2, min: 0, max: 420, summon: { familyId: 'esqueleto', count: 2, max: 4, seconds: 30 }, color: '#a070e0' },
      { id: 'dardo_sombrio', name: 'Dardo Sombrío', kind: 'bolt', cooldown: 2.8, windup: 0.6, min: 60, max: 420, damage: 1.3, speed: 320, color: '#a070e0' },
    ],
  },
};

/**
 * Monsters are not static: they grow a level with every player they kill, and past thresholds
 * they change form. A monster that has killed is more dangerous, and its stolen tree runs further.
 */
export const MOB_FORMS: Record<MobFamilyId, [string, string, string]> = {
  lobezno: ['Lobezno', 'Lobo', 'Huargo'],
  jabali: ['Jabalí', 'Jabalí Viejo', 'Colmillo de Hierro'],
  duende: ['Duende Ladrón', 'Duende Bandido', 'Rey de los Duendes'],
  arana: ['Araña', 'Tejedora', 'Reina Tejedora'],
  saqueador: ['Saqueador', 'Bandido', 'Señor de la Ceniza'],
  ent: ['Ent Joven', 'Ent', 'Ent Anciano'],
  ghoul: ['Ghoul', 'Ghoul Voraz', 'Ghast'],
  espiritu_ceniza: ['Espíritu de Ceniza', 'Espíritu Ardiente', 'Alma del Incendio'],
  sapo: ['Sapo Pálido', 'Sapo Hinchado', 'Madre Sapo'],
  esqueleto: ['Esqueleto', 'Guerrero Esqueleto', 'Caballero de Hueso'],
  nigromante: ['Nigromante del Pantano', 'Señor de los Huesos', 'Rey Hundido'],
};
export const formName = (familyId: MobFamilyId, level: number) =>
  MOB_FORMS[familyId][level >= 20 ? 2 : level >= 10 ? 1 : 0];

/** Growth per level. Gentle enough that two levels of difference is a fight, not a wall. */
const HP_PER_LEVEL = 0.38;
const DAMAGE_PER_LEVEL = 0.22;
const SPEED_PER_LEVEL = 0.03;
const SPEED_CAP = 0.3;
const XP_PER_LEVEL = 0.55;

/** Everything a mob of this family and level is worth, derived on demand. */
export function mobStats(familyId: MobFamilyId, level: number) {
  const family = MOB_FAMILIES[familyId];
  const up = Math.max(0, level - 1);
  return {
    family,
    hp: Math.round(family.hp * (1 + HP_PER_LEVEL * up) * 10) / 10,
    damage: Math.round(family.damage * (1 + DAMAGE_PER_LEVEL * up) * 100) / 100,
    speed: family.speed * (1 + Math.min(SPEED_CAP, SPEED_PER_LEVEL * up)),
    radius: family.radius,
    range: family.range,
    cooldown: family.cooldown,
    windup: family.windup,
    aggro: family.aggro,
    leash: family.leash,
  };
}

/** Experience a kill grants, before any penalty for out-levelling the prey. */
export function mobXp(familyId: MobFamilyId, level: number) {
  return Math.round(MOB_FAMILIES[familyId].xp * (1 + XP_PER_LEVEL * Math.max(0, level - 1)));
}

/**
 * Killing something far below you stops paying. Five levels above the mob and it is worthless,
 * so grinding the starter valley cannot carry a character through the whole world.
 */
export function xpFor(familyId: MobFamilyId, mobLevel: number, killerLevel: number) {
  const gap = killerLevel - mobLevel;
  if (gap >= 5) return 0;
  const scale = gap <= 0 ? 1 : 1 - gap * 0.2;
  return Math.max(1, Math.round(mobXp(familyId, mobLevel) * scale));
}
