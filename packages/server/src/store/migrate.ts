import { validClass } from '@bandera/shared';
import { CAST_SLOTS, WEAPON_IDS, normalizeCharacter, type Character } from '@bandera/shared/world';
import { MAX_LEVEL, STAT_IDS } from '@bandera/shared/rpg/progression';
import { AFFINITIES, RARITY_NAMES } from '@bandera/shared/rpg/skills';
import { validZone } from '@bandera/shared/rpg/zones';
import { SAVE_VERSION, StoreError, type SavedCharacter } from './characters.js';

/**
 * Turns whatever a persistent driver read back into a current, valid save.
 *
 * Two jobs, in this order: climb the version ladder one step at a time, then check the character
 * hard enough to catch corruption. Anything that fails throws. A save that cannot be trusted is
 * never replaced by a fresh level-1 character: the player would lose everything and the next
 * write would make that loss permanent.
 */

type Envelope = Record<string, unknown> & { version: number };

/**
 * `UPGRADES[n]` turns a version-n envelope into a version-(n+1) one. Adding v2 means bumping
 * `SAVE_VERSION` and adding `1: (v1) => ({ ...v1, version: 2, ... })` here; nothing else changes.
 */
const UPGRADES: Record<number, (envelope: Envelope) => Envelope> = {};

const RARITIES = Object.keys(RARITY_NAMES);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const text = (value: unknown, max = 64): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

function invalid(reason: string): never {
  throw new StoreError('save-invalido', `Guardado inválido: ${reason}`);
}

/**
 * Required fields are the ones every save has had since the first version; the rest arrived with
 * skills and trees, so they may be missing (normalizeCharacter fills them) but never be wrong.
 */
function checkCharacter(raw: unknown): Character {
  if (!isObject(raw)) invalid('el personaje no es un objeto');
  const c = raw;
  if (!text(c.id)) invalid('id');
  if (!text(c.accountId)) invalid('accountId');
  if (!text(c.name)) invalid('name');
  if (!validClass(c.classId)) invalid('classId');
  if (!Number.isInteger(c.level) || (c.level as number) < 1 || (c.level as number) > MAX_LEVEL) invalid('level');
  if (!finite(c.xp) || c.xp < 0) invalid('xp');
  if (!count(c.unspent)) invalid('unspent');
  if (!validZone(c.zoneId)) invalid('zoneId');
  if (!finite(c.x) || !finite(c.y)) invalid('posición');

  if (c.stats !== undefined) {
    if (!isObject(c.stats)) invalid('stats');
    for (const stat of STAT_IDS) if (c.stats[stat] !== undefined && !finite(c.stats[stat])) invalid(`stats.${stat}`);
  }
  if (c.weapon !== undefined && !WEAPON_IDS.includes(c.weapon as never)) invalid('weapon');
  for (const field of ['skillPoints', 'copyCharges'] as const)
    if (c[field] !== undefined && !count(c[field])) invalid(field);
  if (c.bonusMana !== undefined && (!finite(c.bonusMana) || c.bonusMana < 0)) invalid('bonusMana');
  for (const field of ['trees', 'passives'] as const)
    if (c[field] !== undefined && (!Array.isArray(c[field]) || !c[field].every((v) => text(v)))) invalid(field);

  if (c.affinities !== undefined) {
    if (!isObject(c.affinities)) invalid('affinities');
    for (const [key, a] of Object.entries(c.affinities)) {
      if (!AFFINITIES.includes(key as never) || !isObject(a)) invalid(`affinities.${key}`);
      if (!finite(a.points) || !finite(a.xp) || !finite(a.cultivation)) invalid(`affinities.${key}`);
    }
  }
  if (c.skills !== undefined) {
    if (!isObject(c.skills)) invalid('skills');
    for (const [key, s] of Object.entries(c.skills)) {
      if (!isObject(s) || !count(s.level) || !count(s.uses)) invalid(`skills.${key}`);
      if (!Array.isArray(s.nodes) || !s.nodes.every((n) => text(n))) invalid(`skills.${key}.nodes`);
    }
  }
  if (c.slots !== undefined) {
    if (!isObject(c.slots)) invalid('slots');
    for (const slot of CAST_SLOTS) {
      const v = c.slots[slot];
      if (v !== undefined && v !== null && !text(v)) invalid(`slots.${slot}`);
    }
  }
  if (c.destiny !== undefined) {
    if (!isObject(c.destiny) || !text(c.destiny.skillId) || !RARITIES.includes(c.destiny.rarity as string))
      invalid('destiny');
  }
  return c as unknown as Character;
}

export function migrate(raw: unknown): SavedCharacter {
  if (!isObject(raw)) invalid('no es un objeto');
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) invalid('version');
  if ((raw.version as number) > SAVE_VERSION)
    throw new StoreError(
      'save-futuro',
      `Guardado de la versión ${raw.version}, este servidor entiende hasta la ${SAVE_VERSION}`,
    );
  let envelope = raw as Envelope;
  while (envelope.version < SAVE_VERSION) {
    const upgrade = UPGRADES[envelope.version];
    if (!upgrade) invalid(`no hay migración desde la versión ${envelope.version}`);
    const next = upgrade(envelope);
    // A step that forgets to bump the version would loop forever; fail instead.
    if (next.version !== envelope.version + 1) invalid(`la migración ${envelope.version} no avanzó`);
    envelope = next;
  }
  const updatedAt = envelope.updatedAt ?? 0;
  if (!finite(updatedAt) || updatedAt < 0) invalid('updatedAt');
  return {
    version: SAVE_VERSION,
    character: normalizeCharacter(checkCharacter(envelope.character)),
    updatedAt,
  };
}
