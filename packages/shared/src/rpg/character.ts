import { idleSlots, type ClassId, type Input } from '../index.js';
import { DEFAULT_ZONE, zone, type ZoneId } from './zones.js';
import { BASE_STATS, type Stats } from './progression.js';
import { AFFINITIES, SKILLS_WORLD, type Affinity, type AffinityState, type Rarity, type SkillProgress } from './skills.js';

/**
 * A character of the persistent world: what is saved, how it is born, and how its input is shaped.
 *
 * The weapon is a channel, not a path. It decides what the basic click trains and which engine
 * class resolves that click; the affinities decide which skills open. A mage with a sword swings
 * the sword — and the sword trains Might, not fire — until a node imbues the blade.
 */

export type Weapon = 'espada' | 'baston' | 'arco' | 'daga' | 'escudo';

export const WEAPONS: Record<Weapon, { name: string; classId: ClassId; channel: 'marcial' | 'arcano'; text: string }> = {
  espada: { name: 'Espada', classId: 'guardian', channel: 'marcial', text: 'Equilibrada. Abre los tres estilos de espada.' },
  baston: { name: 'Bastón', classId: 'mage', channel: 'arcano', text: '+10 % de daño mágico. Sin afinidad, es un palo.' },
  arco: { name: 'Arco', classId: 'archer', channel: 'marcial', text: 'Distancia. Castiga al que se acerca mal.' },
  daga: { name: 'Daga', classId: 'archer', channel: 'marcial', text: 'Rápida y cercana. La mejor amiga del sigilo.' },
  escudo: { name: 'Escudo y maza', classId: 'vanguard', channel: 'marcial', text: 'Lento y pesado. El camino más resistente.' },
};
export const WEAPON_IDS = Object.keys(WEAPONS) as Weapon[];

const WEAPON_OF_CLASS: Record<ClassId, Weapon> = {
  guardian: 'espada',
  vanguard: 'escudo',
  mage: 'baston',
  necromancer: 'baston',
  archer: 'arco',
};

/** The keys a skill can live in. Click always belongs to the weapon. */
export type CastSlot = 'e' | 'q' | 'space';
export const CAST_SLOTS: CastSlot[] = ['e', 'q', 'space'];
/** The fated skill sits in E from the first minute; Q and Space open as the character grows. */
export const SLOT_LEVEL: Record<CastSlot, number> = { e: 1, q: 5, space: 10 };
export const SLOT_NAMES: Record<CastSlot, string> = { e: 'E', q: 'Q', space: 'Espacio' };
export const slotOpen = (slot: CastSlot, level: number) => level >= SLOT_LEVEL[slot];

/** The sparks the Man-God lets you place at birth. */
export const SPARKS = 3;

export interface Creation {
  sparks: Partial<Record<Affinity, number>>;
  weapon: Weapon;
}

export function validCreation(value: unknown): value is Creation {
  if (!value || typeof value !== 'object') return false;
  const c = value as Creation;
  if (typeof c.weapon !== 'string' || !WEAPON_IDS.includes(c.weapon)) return false;
  if (!c.sparks || typeof c.sparks !== 'object') return false;
  let total = 0;
  for (const [key, n] of Object.entries(c.sparks)) {
    if (!AFFINITIES.includes(key as Affinity) || !Number.isInteger(n) || (n as number) < 0) return false;
    total += n as number;
  }
  return total === SPARKS;
}

export interface Destiny {
  skillId: string;
  rarity: Rarity;
}

/** What is saved between sessions. The simulation only ever reads a handful of these. */
export interface Character {
  id: string;
  accountId: string;
  name: string;
  /** The engine class that resolves the weapon's basic attack; derived from the weapon. */
  classId: ClassId;
  level: number;
  xp: number;
  /** Attribute points still to place. */
  unspent: number;
  stats: Stats;
  /** Where the character stood when it last left, and where it revives. */
  zoneId: ZoneId;
  x: number;
  y: number;
  weapon: Weapon;
  affinities: Partial<Record<Affinity, AffinityState>>;
  skills: Record<string, SkillProgress>;
  slots: Record<CastSlot, string | null>;
  /** Points for skill trees, one per level. */
  skillPoints: number;
  /** Charges of the impostor's eye. Almost always zero or one. */
  copyCharges: number;
  /** Monster families whose hidden tree this character has stolen. */
  trees: string[];
  /** Passive ids stolen along with those trees. */
  passives: string[];
  destiny: Destiny;
  /** Maximum mana widened in childhood by running the pool dry. */
  bonusMana: number;
}

export function newCharacter(
  id: string,
  accountId: string,
  name: string,
  classId: ClassId,
  creation?: Creation,
  destiny: Destiny = { skillId: 'parada', rarity: 'comun' },
): Character {
  const entry = zone(DEFAULT_ZONE).entry;
  const weapon = creation?.weapon ?? WEAPON_OF_CLASS[classId];
  const affinities: Partial<Record<Affinity, AffinityState>> = {};
  for (const [key, n] of Object.entries(creation?.sparks ?? {}))
    if (n) affinities[key as Affinity] = { points: n, xp: 0, cultivation: 1 };
  const skill = SKILLS_WORLD[destiny.skillId] ?? SKILLS_WORLD.parada;
  const school = skill.school as Affinity;
  // Fate can hand over the skill of a door the character never opened. It opens that door a crack.
  if (AFFINITIES.includes(school) && !affinities[school]) affinities[school] = { points: 1, xp: 0, cultivation: 1 };
  return {
    id,
    accountId,
    name,
    classId: WEAPONS[weapon].classId,
    level: 1,
    xp: 0,
    unspent: 0,
    stats: { ...BASE_STATS },
    zoneId: DEFAULT_ZONE,
    x: entry.x,
    y: entry.y,
    weapon,
    affinities,
    skills: { [skill.id]: { level: 1, uses: 0, nodes: [] } },
    slots: { e: skill.id, q: null, space: null },
    skillPoints: 0,
    copyCharges: skill.effect.kind === 'steal' ? 1 : 0,
    trees: [],
    passives: [],
    destiny: { skillId: skill.id, rarity: destiny.rarity },
    bonusMana: 0,
  };
}

/** Fills whatever an older save lacks, so a character from before skills existed still loads. */
export function normalizeCharacter(raw: Character): Character {
  const base = newCharacter(raw.id, raw.accountId, raw.name, raw.classId);
  return {
    ...base,
    ...raw,
    stats: { ...base.stats, ...raw.stats },
    slots: { ...base.slots, ...(raw.slots ?? {}) },
    skills: raw.skills ?? base.skills,
    affinities: raw.affinities ?? base.affinities,
    trees: raw.trees ?? [],
    passives: raw.passives ?? [],
    bonusMana: raw.bonusMana ?? 0,
  };
}

/**
 * The duel's class kits do not exist in the world: E, Q and Space belong to skills, not to Fury or
 * a shield bash. Movement, aim and the weapon's click pass through; every class ability is off.
 * A rooted character (mid incantation) cannot walk or swing. Shared by the server and the client's
 * prediction, so both sides agree on what a key press did.
 */
export function worldInput(input: Input, weapon: Weapon, rooted = false): Input {
  const dagger = weapon === 'daga';
  return {
    ...input,
    x: rooted ? 0 : input.x,
    y: rooted ? 0 : input.y,
    sword: !rooted && (input.sword || (dagger && input.shot)),
    shot: !rooted && !dagger && input.shot,
    charge: !rooted && input.charge,
    dash: false,
    guard: false,
    summon: false,
    ice: false,
    trap: false,
    volley: false,
    special: false,
    shieldBash: false,
    fury: false,
    slash: false,
    counter: false,
    command: false,
    mark: false,
    slots: idleSlots(),
  };
}
