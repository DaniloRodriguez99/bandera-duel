import type { Stats } from './progression.js';
import { AFFINITIES, AFFINITY_NAMES, SKILLS_WORLD, STAT_NAMES, type Affinity, type Rarity } from './skills.js';
import type { Character, Weapon } from './character.js';

/**
 * What a character can carry: equipment with fixed bonuses, and grimoires that teach, deepen or
 * open. Items are catalog references, never rolled affixes, so a save holds a list of ids and
 * validating it stays trivial.
 *
 * Only types come from character.ts: it imports STARTER_WEAPON from here, and a value import back
 * would leave that table undefined the first time a character is born.
 */

export type EquipSlot = 'weapon' | 'armor' | 'amulet';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'amulet'];
export type ItemKind = 'arma' | 'armadura' | 'amuleto' | 'grimorio';

/** The same shape as a stolen passive, plus attributes. All additive. */
export interface ItemBonus {
  stats?: Partial<Stats>;
  /** Fraction added to max health. */
  maxHp?: number;
  damage?: number;
  speed?: number;
  /** Health per second. */
  regen?: number;
  xp?: number;
}

export type GrimoireEffect =
  | { kind: 'teach'; skillId: string }
  | { kind: 'affinity'; affinity: Affinity }
  | { kind: 'train'; levels: number }
  | { kind: 'copy' };

export interface ItemDefinition {
  id: string;
  name: string;
  kind: ItemKind;
  slot?: EquipSlot;
  rarity: Rarity;
  /** Character level needed to equip it; for loot, roughly where it drops. */
  level: number;
  icon: string;
  flavor: string;
  weapon?: Weapon;
  bonus?: ItemBonus;
  grimoire?: GrimoireEffect;
  /** Birth weapons: never dropped, always the fallback. */
  starter?: boolean;
}

/** One item in a bag or a slot. `uid` is unique for the character's whole life. */
export interface ItemInstance {
  uid: string;
  itemId: string;
}

export interface Equipment {
  /** Never empty: the hands hold at least the weapon the character was born with. */
  weapon: ItemInstance;
  armor: ItemInstance | null;
  amulet: ItemInstance | null;
}

export const INVENTORY_SIZE = 20;
export const AFFINITY_POINT_CAP = 5;
export const COPY_CHARGE_CAP = 3;

type Def = Omit<ItemDefinition, 'id'>;
const weapon = (w: Weapon, icon: string, d: Omit<Def, 'kind' | 'slot' | 'weapon' | 'icon'>): Def => ({
  ...d,
  kind: 'arma',
  slot: 'weapon',
  weapon: w,
  icon,
});
const armor = (d: Omit<Def, 'kind' | 'slot' | 'icon'>): Def => ({ ...d, kind: 'armadura', slot: 'armor', icon: 'guardian-shield' });
const amulet = (d: Omit<Def, 'kind' | 'slot' | 'icon'>): Def => ({ ...d, kind: 'amuleto', slot: 'amulet', icon: 'mage-shield' });

const WEAPON_ICON: Record<Weapon, string> = {
  espada: 'guardian-slash',
  baston: 'mage-fireball',
  arco: 'archer-arrow',
  daga: 'archer-trap',
  escudo: 'guardian-shield',
};

const EQUIPMENT: Record<string, Def> = {
  espada_madera: weapon('espada', WEAPON_ICON.espada, { name: 'Espada de Madera', rarity: 'comun', level: 1, starter: true, flavor: 'Con la que aprendiste a no soltarla.' }),
  baston_aprendiz: weapon('baston', WEAPON_ICON.baston, { name: 'Bastón de Aprendiz', rarity: 'comun', level: 1, starter: true, flavor: 'Tiene marcas de dientes. No preguntes.' }),
  arco_corto: weapon('arco', WEAPON_ICON.arco, { name: 'Arco Corto', rarity: 'comun', level: 1, starter: true, flavor: 'Tensa poco, pero tensa.' }),
  daga_oxidada: weapon('daga', WEAPON_ICON.daga, { name: 'Daga Oxidada', rarity: 'comun', level: 1, starter: true, flavor: 'El óxido también corta.' }),
  escudo_tosco: weapon('escudo', WEAPON_ICON.escudo, { name: 'Escudo Tosco y Maza', rarity: 'comun', level: 1, starter: true, flavor: 'Pesado, feo, y todavía de pie.' }),

  espada_acero: weapon('espada', WEAPON_ICON.espada, { name: 'Espada de Acero', rarity: 'comun', level: 4, bonus: { damage: 0.05 }, flavor: 'Acero de verdad. Se nota en el brazo.' }),
  baston_roble: weapon('baston', WEAPON_ICON.baston, { name: 'Bastón de Roble', rarity: 'comun', level: 4, bonus: { stats: { spirit: 2 } }, flavor: 'El roble recuerda cada tormenta.' }),
  arco_cazador: weapon('arco', WEAPON_ICON.arco, { name: 'Arco de Cazador', rarity: 'comun', level: 4, bonus: { damage: 0.04, stats: { agility: 1 } }, flavor: 'Huele a bosque y a paciencia.' }),
  daga_colmillo: weapon('daga', WEAPON_ICON.daga, { name: 'Daga de Colmillo', rarity: 'rara', level: 7, bonus: { damage: 0.08, speed: 0.03 }, flavor: 'Tallada del colmillo de algo que ya no muerde.' }),
  maza_hierro: weapon('escudo', WEAPON_ICON.escudo, { name: 'Escudo y Maza de Hierro', rarity: 'rara', level: 7, bonus: { stats: { vigor: 2 }, maxHp: 0.05 }, flavor: 'Para los que prefieren no esquivar.' }),
  baston_ceniza: weapon('baston', WEAPON_ICON.baston, { name: 'Bastón de Ceniza', rarity: 'epica', level: 12, bonus: { stats: { spirit: 3 }, damage: 0.08 }, flavor: 'Todavía está tibio.' }),
  hoja_saqueador: weapon('espada', WEAPON_ICON.espada, { name: 'Hoja del Saqueador', rarity: 'epica', level: 13, bonus: { damage: 0.12 }, flavor: 'Cambió de dueño muchas veces. Ninguno murió de viejo.' }),
  arco_vael: weapon('arco', WEAPON_ICON.arco, { name: 'Arco del Viento de Vael', rarity: 'legendaria', level: 14, bonus: { damage: 0.15, speed: 0.05 }, flavor: 'La cuerda silba antes de que la sueltes.' }),

  jubon_cuero: armor({ name: 'Jubón de Cuero', rarity: 'comun', level: 2, bonus: { stats: { vigor: 1 } }, flavor: 'Mejor que nada. Apenas.' }),
  cota_malla: armor({ name: 'Cota de Malla', rarity: 'rara', level: 7, bonus: { stats: { vigor: 3 }, speed: -0.03 }, flavor: 'Suena a cada paso. Los lobos también la oyen.' }),
  tunica_hechicero: armor({ name: 'Túnica del Hechicero', rarity: 'rara', level: 7, bonus: { stats: { spirit: 2 }, regen: 0.05 }, flavor: 'Bordada con runas que nadie terminó de leer.' }),
  coraza_colmillo: armor({ name: 'Coraza de Colmillos', rarity: 'epica', level: 12, bonus: { stats: { vigor: 4 }, maxHp: 0.08, speed: -0.04 }, flavor: 'Cada colmillo, un cazador que no volvió.' }),
  manto_niebla: armor({ name: 'Manto de Niebla', rarity: 'legendaria', level: 14, bonus: { stats: { vigor: 2, spirit: 2 }, regen: 0.15 }, flavor: 'Nadie recuerda haberte visto con él puesto.' }),

  amuleto_hueso: amulet({ name: 'Amuleto de Hueso', rarity: 'comun', level: 1, bonus: { regen: 0.05 }, flavor: 'De qué hueso, mejor no saberlo.' }),
  talisman_jade: amulet({ name: 'Talismán de Jade', rarity: 'rara', level: 6, bonus: { xp: 0.08 }, flavor: 'Aprende con vos.' }),
  ojo_arana: amulet({ name: 'Ojo de Araña', rarity: 'rara', level: 7, bonus: { damage: 0.05 }, flavor: 'Todavía mira.' }),
  corazon_brasa: amulet({ name: 'Corazón de Brasa', rarity: 'epica', level: 12, bonus: { stats: { spirit: 2 }, damage: 0.06 }, flavor: 'Late cuando hay pelea cerca.' }),
  eco_alma: amulet({ name: 'Eco del Alma', rarity: 'legendaria', level: 14, bonus: { xp: 0.15, maxHp: 0.06 }, flavor: 'Alguien vivió esto antes que vos, y te deja la mitad.' }),
};

const GRIMOIRE_LEVEL: Record<Rarity, number> = { comun: 1, rara: 1, epica: 8, legendaria: 12, unica: 12 };
const TOME_ICON = 'mage-fireball';

function grimoires(): Record<string, Def> {
  const out: Record<string, Def> = {};
  for (const skill of Object.values(SKILLS_WORLD)) {
    if (skill.school === 'monstruo' || skill.effect.kind === 'steal') continue;
    out[`grimorio:${skill.id}`] = {
      name: `Grimorio: ${skill.name}`,
      kind: 'grimorio',
      rarity: skill.rarity,
      level: GRIMOIRE_LEVEL[skill.rarity],
      icon: skill.icon,
      flavor: skill.flavor,
      grimoire: { kind: 'teach', skillId: skill.id },
    };
  }
  for (const affinity of AFFINITIES)
    out[`tomo:${affinity}`] = {
      name: `Tomo de ${AFFINITY_NAMES[affinity]}`,
      kind: 'grimorio',
      rarity: 'rara',
      level: 1,
      icon: TOME_ICON,
      flavor: 'Leerlo no te enseña nada. Te abre una puerta.',
      grimoire: { kind: 'affinity', affinity },
    };
  out.manual_practica = {
    name: 'Manual de Práctica',
    kind: 'grimorio',
    rarity: 'rara',
    level: 1,
    icon: 'vanguard-counter',
    flavor: 'Mil repeticiones, resumidas en una noche sin dormir.',
    grimoire: { kind: 'train', levels: 1 },
  };
  out.fragmento_reflejo = {
    name: 'Fragmento de Reflejo',
    kind: 'grimorio',
    rarity: 'unica',
    level: 1,
    icon: 'necromancer-resurrection',
    flavor: 'Un pedazo de espejo que no refleja lo que tenés adelante, sino lo que te falta.',
    grimoire: { kind: 'copy' },
  };
  return out;
}

export const ITEMS: Record<string, ItemDefinition> = Object.fromEntries(
  Object.entries({ ...EQUIPMENT, ...grimoires() }).map(([id, def]) => [id, { id, ...def }]),
);

export const STARTER_WEAPON: Record<Weapon, string> = {
  espada: 'espada_madera',
  baston: 'baston_aprendiz',
  arco: 'arco_corto',
  daga: 'daga_oxidada',
  escudo: 'escudo_tosco',
};

export const itemName = (instance: ItemInstance | null | undefined) =>
  instance ? (ITEMS[instance.itemId]?.name ?? 'Objeto desconocido') : '';

/** Everything the equipped items add, summed. Unknown ids (a removed item) add nothing. */
export function equipmentBonus(character: Pick<Character, 'equipment'>): Required<Omit<ItemBonus, 'stats'>> & { stats: Stats } {
  const total = { maxHp: 0, damage: 0, speed: 0, regen: 0, xp: 0, stats: { might: 0, agility: 0, perception: 0, spirit: 0, vigor: 0 } };
  const e = character.equipment;
  for (const instance of [e?.weapon, e?.armor, e?.amulet]) {
    const bonus = instance ? ITEMS[instance.itemId]?.bonus : undefined;
    if (!bonus) continue;
    total.maxHp += bonus.maxHp ?? 0;
    total.damage += bonus.damage ?? 0;
    total.speed += bonus.speed ?? 0;
    total.regen += bonus.regen ?? 0;
    total.xp += bonus.xp ?? 0;
    for (const [stat, n] of Object.entries(bonus.stats ?? {}) as [keyof Stats, number][]) total.stats[stat] += n;
  }
  return total;
}

/** Attributes with the gear on. Tree nodes keep checking the bare ones, so gear never unlearns. */
export function statsWithEquipment(character: Pick<Character, 'stats' | 'equipment'>): Stats {
  const extra = equipmentBonus(character).stats;
  const out = { ...character.stats };
  for (const stat of Object.keys(out) as (keyof Stats)[]) out[stat] += extra[stat];
  return out;
}

/** Bonus lines in the System's words: "+3 Vigor", "+8 % daño". */
export function describeBonus(bonus: ItemBonus | undefined): string[] {
  if (!bonus) return [];
  const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.round(Math.abs(n) * 100)} %`;
  const lines: string[] = [];
  for (const [stat, n] of Object.entries(bonus.stats ?? {}) as [keyof Stats, number][])
    lines.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} ${STAT_NAMES[stat]}`);
  if (bonus.maxHp) lines.push(`${pct(bonus.maxHp)} vida`);
  if (bonus.damage) lines.push(`${pct(bonus.damage)} daño`);
  if (bonus.speed) lines.push(`${pct(bonus.speed)} velocidad`);
  if (bonus.regen) lines.push(`+${bonus.regen} vida por segundo`);
  if (bonus.xp) lines.push(`${pct(bonus.xp)} experiencia`);
  return lines;
}

/** What a grimoire does, said plainly. */
export function describeGrimoire(effect: GrimoireEffect | undefined): string {
  if (!effect) return '';
  switch (effect.kind) {
    case 'teach':
      return `Enseña «${SKILLS_WORLD[effect.skillId]?.name ?? effect.skillId}». Si ya la sabés, la sube un nivel.`;
    case 'affinity':
      return `+1 punto de ${AFFINITY_NAMES[effect.affinity]}. Abre la afinidad si estaba cerrada.`;
    case 'train':
      return 'Sube un nivel la habilidad que elijas.';
    case 'copy':
      return '+1 carga del Ojo del Impostor.';
  }
}
