import {
  CLASSES,
  DEFAULT_MAP,
  Duel,
  RULES,
  distance,
  newPlayer,
  projectileStats,
  translate,
  activePreset,
  defaultCustomization,
  type Allegiant,
  type Arrow,
  type ClassId,
  type Grave,
  type Input,
  type MapDefinition,
  type Player,
  type Rect,
  type Snapshot,
  type Team,
  type Terrain,
  type Vec,
  type Zombie,
} from './index.js';
import { DEFAULT_ZONE, ZONES, zone, type Spawner, type ZoneDefinition, type ZoneId } from './rpg/zones.js';
import { MOB_FAMILIES, formName, mobStats, xpFor } from './rpg/mobs.js';
import {
  POINTS_PER_LEVEL,
  applyXp,
  deathPenalty,
  maxHpFor,
  maxManaFor,
  manaRegenFor,
  type StatId,
} from './rpg/progression.js';
import {
  AFFINITY_NAMES,
  ARCANE,
  MARTIAL,
  MONSTER_TREES,
  RANKS,
  SILENT_CAST_RANK,
  SKILLS_WORLD,
  TOUKI_RANK,
  affinityGain,
  canLearn,
  cultivate,
  effectiveSkill,
  rankOf,
  refusalFor,
  schoolOpen,
  skillName,
  usesToLevel,
  type Affinity,
  type Element,
  type LearnCheck,
  type Passive,
  type SkillEffect,
  type SkillProgress,
  type WorldSkill,
} from './rpg/skills.js';
import {
  AFFINITY_POINT_CAP,
  COPY_CHARGE_CAP,
  INVENTORY_SIZE,
  ITEMS,
  equipmentBonus,
  statsWithEquipment,
  type EquipSlot,
  type ItemInstance,
} from './rpg/items.js';
import { CHEST_TIERS, rollLoot, type ChestTier } from './rpg/loot.js';
import {
  CAST_SLOTS,
  WEAPONS,
  SLOT_LEVEL,
  SLOT_NAMES,
  normalizeCharacter,
  slotOpen,
  worldInput,
  type CastSlot,
  type Character,
} from './rpg/character.js';

export * from './rpg/character.js';

/**
 * The persistent world.
 *
 * It extends `Duel` on purpose: combat resolution — projectiles, guards, counters, knockback,
 * the undead brain — is a thousand lines the duel already gets right and the tests already pin.
 * The world composes its own `step()` out of the protected pieces instead of copying them, and
 * simply never runs the flag, score and match-clock tail, which is what makes that machinery
 * inert here without a single `if (mode === 'world')` in the shared code.
 */

/** Seconds a player cannot use a portal again, so two facing portals never bounce anyone. */
const PORTAL_COOLDOWN = 1.5;
/** How far a refused player is pushed back towards the middle of the zone. */
const PORTAL_PUSH = 90;
/** How long an incantation roots the caster before the spell leaves their hands. */
export const INCANTATION_TIME = 0.45;
/** How long a monster's body lies where it fell, waiting to be devoured. */
const CORPSE_LIFE = 20;
/** Seconds after a draining skill during which damage dealt heals the caster. */
const DRAIN_WINDOW = 1.2;
/** A child who runs their mana dry widens their channels, at most this often. */
const WIDENING_EVERY = 30;

export interface Travel {
  id: string;
  to: ZoneId;
  arrive: Vec;
}
export interface Refusal {
  id: string;
  to: ZoneId;
  minLevel: number;
  /** False while the destination zone has not been built yet. */
  open: boolean;
}

/**
 * What the System tells one character. `callout` is a skill shouted as it is cast; the rest are
 * the windows that slide in: a skill levelled or evolved, an affinity ranked up, a refusal, a
 * stolen tree, a level gained, a node learned.
 */
export interface Notice {
  id: string;
  kind:
    | 'callout'
    | 'skill'
    | 'evolution'
    | 'rank'
    | 'denied'
    | 'steal'
    | 'level'
    | 'learn'
    | 'widen'
    | 'death'
    | 'kill'
    | 'raise'
    | 'loot'
    | 'item';
  title: string;
  text: string;
  color?: string;
  skillId?: string;
  rarity?: string;
  incantation?: string;
  slot?: CastSlot;
  cooldown?: number;
  mana?: number;
  /** A loot window: what went into the bag, and from what kind of chest. */
  items?: ItemInstance[];
  tier?: ChestTier;
}

/** A chest as everyone sees it. `opener` and `progress` belong to whoever is furthest along. */
export interface ChestView {
  id: string;
  x: number;
  y: number;
  tier: ChestTier;
  ready: boolean;
  respawnLeft: number;
  opener: string | null;
  progress: number;
}

export interface WorldSnapshot extends Snapshot {
  /** The zone this view belongs to. `mapId` stays a valid arena id so the shared types hold. */
  zoneId: ZoneId;
  chests: ChestView[];
}

/** Around a wild zone's shrine nobody hurts anybody: the place you revive is not a place to camp. */
export const SHRINE_WARD = 240;
/** A raised character keeps this share of its life (capped by its raiser's). */
export const THRALL_HP_SHARE = 0.6;
/** A parry turns a player's blow back only on someone standing close enough to have struck it. */
const PARRY_REACH = 90;

/** How close a character must stand to a chest to open it. */
export const CHEST_REACH = 44;

/** Which engine projectile carries each element, so existing renderers draw it for free. */
const BOLT_LOOK: Record<Element, { classId: ClassId; element?: Arrow['element']; wind?: boolean }> = {
  fuego: { classId: 'mage', element: 'fire' },
  hielo: { classId: 'mage', element: 'ice' },
  viento: { classId: 'archer', wind: true },
  rayo: { classId: 'archer' },
  sombra: { classId: 'necromancer' },
  luz: { classId: 'mage' },
  tierra: { classId: 'archer' },
  fisico: { classId: 'archer' },
};

export class World extends Duel {
  /** Everything persistent, keyed by character id, which is also the player entity id. */
  readonly characters = new Map<string, Character>();
  private zoneId: ZoneId = DEFAULT_ZONE;
  /** Seconds until each camp puts another monster on its feet, keyed by camp id. */
  private respawn = new Map<string, number>();
  /**
   * The world detects a portal; carrying the character to another zone is the room's job, since
   * each zone is its own World. The room drains both lists after every step.
   */
  readonly travels: Travel[] = [];
  readonly refusals: Refusal[] = [];
  private portalCd = new Map<string, number>();
  /** Characters whose private sheet changed this step; the room re-sends it to each of them. */
  readonly sheetChanged = new Set<string>();
  /** Everything the System has to tell someone; the room drains it after every step. */
  readonly notices: Notice[] = [];
  /** Where monsters fell, for skills that devour. */
  readonly corpses: { x: number; y: number; left: number }[] = [];
  private requested: { id: string; slot: CastSlot; aim: Vec }[] = [];
  /** Characters whose bag changed: the room saves them at once instead of waiting for the flush. */
  readonly saveNow = new Set<string>();
  /** Loot is rolled with this; tests pin it. */
  random: () => number = Math.random;
  private opening = new Map<string, { chestId: string; elapsed: number }>();
  /** `${player}|${chest}` already told their bag is too full, until they step away. */
  private lootWarned = new Set<string>();
  private chestCamp = new Map<string, number>();
  private incantations = new Map<string, { skillId: string; aim: Vec; left: number }>();
  private skillCd = new Map<string, number>();
  private parries = new Map<string, { left: number; reflect: number }>();
  private buffs = new Map<string, { left: number; damage: number; speed: number }>();
  private drains = new Map<string, { left: number; share: number }>();
  private widened = new Map<string, number>();

  constructor(zoneId: ZoneId = DEFAULT_ZONE) {
    super(DEFAULT_MAP, 'duel');
    this.zoneId = zoneId;
    const s = this.state as WorldSnapshot;
    s.zoneId = zoneId;
    // The world never sits in a lobby, never counts down and never ends.
    s.phase = 'playing';
    s.timeLeft = Number.POSITIVE_INFINITY;
    s.maxPlayers = Number.POSITIVE_INFINITY;
    s.bases = [];
    s.flags = [];
    s.chests = [];
    this.populate();
  }

  /**
   * Camps start full. A valley nobody has touched yet is not an empty valley, and the respawn
   * timer is meant to govern what comes back after a fight, not how long the world takes to exist.
   */
  private populate() {
    const camps = this.definition.spawners;
    for (let i = 0; i < camps.length; i++) {
      const camp = camps[i];
      const campId = this.campId(i);
      for (let n = 0; n < camp.count; n++) this.spawnMob(camp, campId);
      this.respawn.set(campId, camp.respawnSeconds);
      if (camp.guards === 'chest' && camp.chest) {
        const id = `chest:${this.zoneId}:${i}`;
        this.chestCamp.set(id, i);
        (this.state as WorldSnapshot).chests.push({
          id,
          x: camp.at.x,
          y: camp.at.y,
          tier: camp.chest.tier,
          ready: true,
          respawnLeft: 0,
          opener: null,
          progress: 0,
        });
      }
    }
  }

  get definition(): ZoneDefinition {
    return zone(this.zoneId);
  }

  /**
   * A zone dressed as a map. Only the fields the inherited code still reads survive: `walls` is
   * never consulted any more (everything goes through `terrain`), and the spawn tables are empty
   * because `spawnFor` is overridden below.
   */
  override get map(): MapDefinition {
    const d = this.definition;
    return {
      id: DEFAULT_MAP,
      name: d.name,
      description: d.description,
      theme: 'forest',
      walls: d.terrain.walls,
      bushes: [],
      sideHomes: { blue: d.entry, red: d.entry },
      sideSpawns: { blue: [d.entry], red: [d.entry] },
      cornerHomes: { blue: d.entry, red: d.entry, green: d.entry, violet: d.entry },
      cornerSpawns: { blue: [d.entry], red: [d.entry], green: [d.entry], violet: [d.entry] },
      pveSpawns: [d.entry],
      pveBossSpawn: d.entry,
    };
  }

  /** The whole point of the Fase 0 seam: real bounds for a zone far larger than an arena. */
  protected override get terrain(): Rect[] | Terrain {
    return this.definition.terrain;
  }

  /** Everyone revives at the zone's shrine. */
  protected override spawnFor(_p: Player): Vec {
    return this.definition.shrine;
  }

  /** No bases, no flags, nobody to arrange. */
  protected override arrange() {}

  /**
   * `Duel.revive` rebuilds a player from scratch and copies an explicit allowlist, so anything
   * the world adds to `Player` has to be restored here or it silently resets on death.
   */
  protected override revive(p: Player, invuln = 0) {
    const character = this.characters.get(p.id);
    super.revive(p, invuln);
    if (!character) return;
    this.applyCharacter(p, character);
    // `Duel.revive` rebuilt the player with its class's health (3), which the sheet would then
    // clamp to instead of refilling: a character came back from the shrine at a third of its life.
    p.hp = p.maxHp;
  }

  /** The stolen passives a character carries, added together. */
  passivesOf(character: Character): Required<Omit<Passive, 'id' | 'name' | 'text'>> {
    const total = { regen: 0, maxHp: 0, speed: 0, damage: 0, xp: 0 };
    for (const tree of Object.values(MONSTER_TREES)) {
      if (!character.passives.includes(tree.passive.id)) continue;
      total.regen += tree.passive.regen ?? 0;
      total.maxHp += tree.passive.maxHp ?? 0;
      total.speed += tree.passive.speed ?? 0;
      total.damage += tree.passive.damage ?? 0;
      total.xp += tree.passive.xp ?? 0;
    }
    return total;
  }

  /** Stolen passives and equipped gear, added together: everything that is not a bare stat. */
  bonusesOf(character: Character) {
    const passive = this.passivesOf(character);
    const gear = equipmentBonus(character);
    return {
      regen: passive.regen + gear.regen,
      maxHp: passive.maxHp + gear.maxHp,
      // Heavy armor slows, but never to a crawl.
      speed: Math.max(-0.2, passive.speed + gear.speed),
      damage: passive.damage + gear.damage,
      xp: passive.xp + gear.xp,
    };
  }

  private maxManaOf(character: Character) {
    return maxManaFor(statsWithEquipment(character)) + character.bonusMana;
  }

  /**
   * Copies the saved sheet onto the live entity and sizes its pools. It runs on join, on every
   * level up, on every spent point and after `revive`, so the entity is never a tick behind the
   * character — a client must not receive a first snapshot with an empty mana bar.
   */
  private applyCharacter(p: Player, character: Character) {
    const bonus = this.bonusesOf(character);
    p.level = character.level;
    p.maxHp = Math.round(maxHpFor(statsWithEquipment(character)) * (1 + bonus.maxHp) * 10) / 10;
    p.hp = Math.min(p.hp > 0 ? p.hp : p.maxHp, p.maxHp);
    p.maxMana = this.maxManaOf(character);
    p.mana = Math.min(p.mana > 0 ? p.mana : p.maxMana, p.maxMana);
    // The duel mage's free two-charge shield is a class kit, not something a world character owns.
    p.magicShieldHits = 0;
  }

  /** Places one of the points a level up granted, and resizes whatever pool it feeds. */
  spendPoint(id: string, stat: StatId): boolean {
    const character = this.characters.get(id);
    if (!character || character.unspent <= 0) return false;
    character.unspent--;
    character.stats[stat]++;
    this.sheetChanged.add(id);
    const p = this.state.players.find((player) => player.id === id);
    if (p) this.applyCharacter(p, character);
    return true;
  }

  /** Joining is nothing like `Duel.add`: no team, no cap, no lobby. */
  join(character: Character): Player {
    // An older save may lack fields. Fill them on the caller's own object, so a later save writes
    // exactly what is live instead of a stale copy.
    Object.assign(character, normalizeCharacter(character));
    const p = newPlayer(
      character.id,
      character.name,
      'blue',
      character.classId,
      { x: character.x, y: character.y },
      defaultCustomization(character.classId),
    );
    this.characters.set(character.id, character);
    this.applyCharacter(p, character);
    // The bond survives the trip; the body stayed behind. Alzar brings it back without a grave.
    p.thrall = character.thrall ? { classId: character.thrall.classId, name: character.thrall.name } : null;
    // A fresh entity carries its class's health; a character walks in whole.
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    this.state.players.push(p);
    return p;
  }

  leave(id: string) {
    const s = this.state;
    const p = s.players.find((player) => player.id === id);
    const character = this.characters.get(id);
    // Remember where they stood, so re-logging in puts them back there. The dead stood nowhere:
    // closing the tab must not skip the walk back from the shrine.
    if (p && character) {
      const at = this.restingPlace(p);
      character.x = at.x;
      character.y = at.y;
      character.zoneId = this.zoneId;
    }
    s.players = s.players.filter((player) => player.id !== id);
    s.zombies = s.zombies.filter((z) => z.owner !== id);
    this.characters.delete(id);
    // Leaving mid-raise would otherwise leave the entry behind and refuse every later Alzar here.
    this.raising.delete(id);
    this.incantations.delete(id);
    this.parries.delete(id);
    this.buffs.delete(id);
    this.drains.delete(id);
    this.opening.delete(id);
    for (const key of this.lootWarned) if (key.startsWith(`${id}|`)) this.lootWarned.delete(key);
  }

  /** Experience for a kill, applied to the sheet and reported so the client can announce it. */
  grantXp(id: string, amount: number): { level: number; gained: number } | null {
    const character = this.characters.get(id);
    if (!character || amount <= 0) return null;
    this.sheetChanged.add(id);
    const bonus = 1 + this.bonusesOf(character).xp;
    const before = character.level;
    const result = applyXp(character.level, character.xp, Math.round(amount * bonus));
    character.level = result.level;
    character.xp = result.xp;
    character.unspent += result.unspent;
    character.skillPoints += result.gained;
    if (result.gained <= 0) return null;
    const p = this.state.players.find((player) => player.id === id);
    if (p) this.applyCharacter(p, character);
    const opened = CAST_SLOTS.filter((slot) => SLOT_LEVEL[slot] > before && SLOT_LEVEL[slot] <= result.level);
    this.notify(id, {
      kind: 'level',
      title: `Subiste a nivel ${result.level}`,
      text:
        `+${result.unspent} puntos de atributo · +${result.gained} de habilidad` +
        (opened.length ? ` · Se abrió la ranura ${opened.map((s) => SLOT_NAMES[s]).join(' y ')}` : ''),
      color: '#7fd8ff',
    });
    return { level: result.level, gained: result.gained };
  }

  private notify(id: string, notice: Omit<Notice, 'id'>) {
    this.notices.push({ id, ...notice });
  }

  // ─── Skills ───────────────────────────────────────────────────────────────────────────────────

  /** A key pressed for a skill slot. Resolved on the next step, in order. */
  cast(id: string, slot: CastSlot, aim: Vec) {
    if (!CAST_SLOTS.includes(slot)) return;
    this.requested.push({ id, slot, aim: { x: aim.x, y: aim.y } });
  }

  /** Puts a known, usable skill into a slot. */
  setSlot(id: string, slot: CastSlot, skillId: string | null): boolean {
    const character = this.characters.get(id);
    if (!character || !CAST_SLOTS.includes(slot) || !slotOpen(slot, character.level)) return false;
    if (skillId !== null) {
      const skill = SKILLS_WORLD[skillId];
      if (!skill || !character.skills[skillId] || !schoolOpen(skill, character.affinities, character.trees)) return false;
      for (const other of CAST_SLOTS) if (character.slots[other] === skillId) character.slots[other] = null;
    }
    character.slots[slot] = skillId;
    this.sheetChanged.add(id);
    return true;
  }

  /** Buys a node of a skill's tree, or says in the System's voice why not. */
  learn(id: string, skillId: string, nodeId: string): LearnCheck {
    const character = this.characters.get(id);
    const skill = SKILLS_WORLD[skillId];
    const progress = character?.skills[skillId];
    if (!character || !skill || !progress) return { ok: false, reason: 'No conocés esa habilidad.' };
    const check = canLearn(skill, progress, nodeId, character.skillPoints, character.stats);
    if (!check.ok) {
      this.notify(id, { kind: 'denied', title: skill.name, text: check.reason!, color: '#ff8a7a' });
      return check;
    }
    const node = skill.tree.find((n) => n.id === nodeId)!;
    progress.nodes.push(nodeId);
    character.skillPoints -= node.cost;
    this.notify(id, { kind: 'learn', title: `Aprendiste «${node.name}»`, text: node.text, color: skill.color, skillId });
    this.sheetChanged.add(id);
    return check;
  }

  private cooldownKey = (id: string, skillId: string) => `${id}:${skillId}`;

  /** Seconds left before a character can cast a skill again. */
  cooldownLeft(id: string, skillId: string) {
    return this.skillCd.get(this.cooldownKey(id, skillId)) ?? 0;
  }

  private damageMultiplier(id: string) {
    const character = this.characters.get(id);
    if (!character) return 1;
    const buff = this.buffs.get(id)?.damage ?? 0;
    const touki = MARTIAL.some((a) => rankOf(character.affinities[a]?.xp ?? 0) >= TOUKI_RANK) ? 0.15 : 0;
    return 1 + buff + this.bonusesOf(character).damage + touki;
  }

  /** Where a character counts as standing for saving: its body, or the shrine if it lies dead. */
  restingPlace(p: Player): Vec {
    return p.hp > 0 ? { x: p.x, y: p.y } : this.definition.shrine;
  }

  // ─── Hostility ────────────────────────────────────────────────────────────────────────────────

  /**
   * Who a combatant answers to. Every world player is on the blue team, so the team says nothing:
   * monsters are one side, and each character is its own side together with its undead, its
   * arrows and its graves.
   */
  private side(x: Allegiant): string {
    if (x.faction === 'monster' || x.owner?.startsWith('wild:')) return 'monster';
    if (x.owner !== undefined) return x.owner;
    if (x.victim !== undefined) return x.victim;
    return String(x.id);
  }

  /** Enemies by nature: monsters against everyone, and characters against each other in the wild. */
  private rivals(a: Allegiant, b: Allegiant) {
    const sa = this.side(a);
    const sb = this.side(b);
    return sa !== sb && (sa === 'monster' || sb === 'monster' || this.definition.pvp === 'wild');
  }

  private warded(x: Allegiant) {
    return x.x !== undefined && x.y !== undefined && distance(x as Vec, this.definition.shrine) <= SHRINE_WARD;
  }

  /** Sanctuaries refuse player against player; so does the ring around a wild zone's shrine. */
  protected override hostile(a: Allegiant, b: Allegiant) {
    if (!this.rivals(a, b)) return false;
    const monster = this.side(a) === 'monster' || this.side(b) === 'monster';
    return monster || (!this.warded(a) && !this.warded(b));
  }

  /** Whether `entity` is an enemy of this character by nature; the room paints those red. */
  rivalOf(characterId: string, entity: Allegiant) {
    return this.rivals({ team: 'blue', id: characterId }, entity);
  }

  /** Only the one who killed you can raise you. */
  protected override canRaise(raiser: Pick<Player, 'team' | 'id'>, g: Grave) {
    return g.killer !== undefined && g.killer === this.side(raiser);
  }

  private nearestRival(z: Zombie, reach = 520) {
    return this.state.players
      .filter((p) => p.hp > 0 && this.characters.has(p.id) && this.rivals(p, z) && distance(p, z) <= reach)
      .sort((a, b) => distance(a, z) - distance(b, z))[0];
  }

  /**
   * Who a blow on a monster belongs to. A character's own blow is `own`: its buffs and drain apply.
   * A Sombra's blow credits its owner without them. With no author (legacy direct calls) the
   * closest rival character takes it, as the first slice did.
   */
  private creditFor(z: Zombie, by?: string): { killer?: Player; own: boolean } {
    const s = this.state;
    if (by === undefined) {
      const near = this.nearestRival(z);
      return { killer: near, own: !!near };
    }
    const player = s.players.find((p) => p.id === by && this.characters.has(p.id));
    if (player) return { killer: player, own: true };
    const minion = s.zombies.find((q) => q.id === by);
    const owner = minion ? s.players.find((p) => p.id === minion.owner && this.characters.has(p.id)) : undefined;
    return { killer: owner, own: false };
  }

  /** Timers, passives, incantations finishing, and the casts asked for since the last step. */
  private stepSkills(dt: number) {
    for (const map of [this.skillCd, this.widened]) {
      for (const [key, left] of map) {
        if (left - dt <= 0) map.delete(key);
        else map.set(key, left - dt);
      }
    }
    for (const map of [this.parries, this.buffs, this.drains] as Map<string, { left: number }>[]) {
      for (const [key, value] of map) {
        value.left -= dt;
        if (value.left <= 0) map.delete(key);
      }
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      this.corpses[i].left -= dt;
      if (this.corpses[i].left <= 0) this.corpses.splice(i, 1);
    }
    for (const p of this.state.players) {
      const character = this.characters.get(p.id);
      if (!character || p.hp <= 0) continue;
      const bonus = this.bonusesOf(character);
      if (bonus.regen > 0) p.hp = Math.min(p.maxHp, p.hp + bonus.regen * dt);
      // Speed rides on the upgrade state `movePlayer` already reads, so prediction stays honest.
      p.pve.speed = (this.buffs.get(p.id)?.speed ?? 0) + bonus.speed;
    }
    for (const [id, spell] of this.incantations) {
      spell.left -= dt;
      if (spell.left > 0) continue;
      this.incantations.delete(id);
      const p = this.state.players.find((q) => q.id === id);
      const character = this.characters.get(id);
      if (p && character && p.hp > 0) this.resolve(p, character, SKILLS_WORLD[spell.skillId], spell.aim);
    }
    for (const request of this.requested.splice(0)) this.request(request.id, request.slot, request.aim);
  }

  private deny(id: string, title: string, text: string) {
    this.notify(id, { kind: 'denied', title, text, color: '#ff8a7a' });
  }

  private request(id: string, slot: CastSlot, aim: Vec) {
    const p = this.state.players.find((q) => q.id === id);
    const character = this.characters.get(id);
    if (!p || !character || p.hp <= 0 || this.incantations.has(id)) return;
    if (!slotOpen(slot, character.level))
      return this.deny(id, `Ranura ${SLOT_NAMES[slot]}`, `Se abre en el nivel ${SLOT_LEVEL[slot]}.`);
    const skillId = character.slots[slot];
    const skill = skillId ? SKILLS_WORLD[skillId] : undefined;
    const progress = skillId ? character.skills[skillId] : undefined;
    if (!skill || !progress) return this.deny(id, `Ranura ${SLOT_NAMES[slot]}`, 'No tenés nada ahí todavía.');
    if (!schoolOpen(skill, character.affinities, character.trees))
      return this.deny(id, skillName(skill, progress.level), refusalFor(skill.school));
    if (this.cooldownLeft(id, skill.id) > 0) return;
    const effective = effectiveSkill(skill, progress);
    if (p.mana + 1e-6 < effective.mana)
      return this.deny(id, effective.name, `Maná insuficiente: necesitás ${Math.ceil(effective.mana)}.`);
    const blocked = this.precheck(p, character, skill);
    if (blocked) return this.deny(id, effective.name, blocked);
    // Casting takes the hands off the chest.
    this.opening.delete(id);

    p.mana -= effective.mana;
    this.skillCd.set(this.cooldownKey(id, skill.id), effective.cooldown);
    const school = skill.school as Affinity;
    const silent = !skill.incantation || rankOf(character.affinities[school]?.xp ?? 0) >= SILENT_CAST_RANK;
    this.notify(id, {
      kind: 'callout',
      title: effective.name,
      text: skill.flavor,
      color: skill.color,
      rarity: skill.rarity,
      skillId: skill.id,
      incantation: silent ? undefined : skill.incantation,
      slot,
      cooldown: effective.cooldown,
      mana: effective.mana,
    });
    this.widen(p, character);
    this.grow(p, character, skill);
    if (silent) this.resolve(p, character, skill, aim);
    else {
      this.incantations.set(id, { skillId: skill.id, aim, left: INCANTATION_TIME });
      this.event('cast', p, p.team, Math.atan2(aim.y - p.y, aim.x - p.x), p.classId, 0);
    }
  }

  /** Skills that need something to act on refuse before spending anything. */
  private precheck(p: Player, character: Character, skill: WorldSkill): string | null {
    if (skill.effect.kind === 'raise') {
      const s = this.state;
      if (p.raiseCast > 0 || this.raising.has(p.id)) return 'Ya estás alzando a alguien.';
      if (s.zombies.some((z) => z.owner === p.id && z.kind === 'thrall' && z.hp > 0))
        return 'Tu Sombra ya camina a tu lado.';
      const grave = s.graves.some((g) => this.canRaise(p, g) && distance(p, g) <= RULES.raiseRange);
      if (!grave && !p.thrall) return 'No hay nadie que hayas matado cerca.';
      if (!grave && p.thrallCd > 0) return `Tu Sombra se está rearmando: ${Math.ceil(p.thrallCd)} s.`;
    }
    if (skill.effect.kind === 'devour' && !this.devourTarget(p, skill.effect.radius))
      return 'No hay nada que devorar cerca.';
    if (skill.effect.kind === 'steal') {
      if (character.copyCharges <= 0) return 'El ojo ya se cerró. No quedan cargas.';
      const prey = this.stealTarget(p, skill.effect.range);
      if (!prey) return 'No hay nada que robar al alcance.';
      if (character.trees.includes(prey.family!)) return 'Ya le robaste todo lo que esa criatura podía darte.';
    }
    return null;
  }

  private devourTarget(p: Player, radius: number) {
    return [...this.corpses, ...this.state.graves].find((c) => distance(p, c) <= radius);
  }

  private stealTarget(p: Player, range: number) {
    return this.state.zombies
      .filter((z) => z.family && z.hp > 0 && distance(p, z) <= range)
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
  }

  /** What a skill does once it leaves the caster's hands. */
  private resolve(p: Player, character: Character, skill: WorldSkill, aim: Vec) {
    const progress = character.skills[skill.id];
    if (!progress) return;
    const { effect } = effectiveSkill(skill, progress);
    const angle = Math.hypot(aim.x - p.x, aim.y - p.y) > 1 ? Math.atan2(aim.y - p.y, aim.x - p.x) : p.angle;
    const arcane = ARCANE.includes(skill.school as Affinity);
    const staff = arcane && character.weapon === 'baston' ? 1.1 : 1;
    this.apply(p, character, skill, effect, angle, staff);
  }

  private apply(p: Player, character: Character, skill: WorldSkill, effect: SkillEffect, angle: number, staff: number) {
    const s = this.state;
    switch (effect.kind) {
      case 'bolt': {
        const look = BOLT_LOOK[effect.element];
        const pierce = !!effect.pierce && !look.wind;
        const speed = pierce ? RULES.hatFireSpeed : projectileStats(look.classId).speed;
        const burst = (effect.explode ?? 0) > 0 && look.classId === 'mage';
        s.arrows.push({
          id: ++this.arrowId,
          owner: p.id,
          team: p.team,
          classId: look.classId,
          x: p.x,
          y: p.y,
          angle,
          life: effect.range / speed,
          damageScale: effect.damage * staff,
          ...(look.element ? { element: look.element } : {}),
          ...(effect.freeze && !look.element ? { element: 'ice' as const } : {}),
          ...(look.wind || effect.pierce ? { hits: [] } : {}),
          ...(look.wind ? { wind: true } : {}),
          ...(pierce ? { blast: true } : {}),
          ...(burst ? { charged: true, power: 1 } : {}),
        });
        if (effect.drain) this.drains.set(p.id, { left: DRAIN_WINDOW, share: effect.drain });
        this.event(look.wind ? 'wind' : 'shot', p, p.team, angle, look.classId, burst ? 1 : 0);
        return;
      }
      case 'nova': {
        for (const z of s.zombies) {
          if (!this.hostile(p, z) || z.hp <= 0 || distance(p, z) > effect.radius) continue;
          this.damageZombie(z, p.team, effect.damage * staff, Math.atan2(z.y - p.y, z.x - p.x), p.id);
          if (effect.freeze && z.hp > 0) {
            z.frozenLeft = Math.max(z.frozenLeft, effect.freeze);
            this.event('freeze', z, z.team);
          }
        }
        for (const q of s.players) {
          if (q === p || q.hp <= 0 || !this.hostile(p, q) || distance(p, q) > effect.radius) continue;
          if (this.damage(q, p, Math.atan2(q.y - p.y, q.x - p.x), effect.damage * staff) && effect.freeze)
            this.freeze(q);
        }
        this.event('explosion', p, p.team, angle, p.classId, 1);
        return;
      }
      case 'heal': {
        for (const q of s.players) {
          if (this.hostile(p, q) || q.hp <= 0 || distance(p, q) > effect.radius) continue;
          q.hp = Math.min(q.maxHp, q.hp + effect.amount * staff);
          this.event('heal', q, q.team);
        }
        return;
      }
      case 'parry': {
        this.parries.set(p.id, { left: effect.window, reflect: effect.reflect });
        this.event('counter', p, p.team, p.angle, p.classId, effect.reflect >= 2 ? 1 : 0);
        return;
      }
      case 'dash': {
        translate(p, Math.cos(angle) * effect.distance, Math.sin(angle) * effect.distance, this.terrain);
        p.invuln = Math.max(p.invuln, 0.25);
        this.event('dash', p, p.team, angle, p.classId, 1);
        return;
      }
      case 'buff': {
        this.buffs.set(p.id, { left: effect.duration, damage: effect.damage, speed: effect.speed });
        this.event('fury', p, p.team, p.angle, p.classId);
        return;
      }
      case 'devour': {
        const target = this.devourTarget(p, effect.radius);
        if (!target) return;
        const corpse = this.corpses.indexOf(target as (typeof this.corpses)[number]);
        if (corpse >= 0) this.corpses.splice(corpse, 1);
        else s.graves = s.graves.filter((g) => g !== target);
        p.hp = Math.min(p.maxHp, p.hp + effect.heal);
        this.event('raise', target, p.team);
        this.event('heal', p, p.team);
        return;
      }
      case 'steal': {
        const prey = this.stealTarget(p, effect.range);
        if (prey) this.steal(p, character, prey);
        return;
      }
      case 'raise': {
        this.raise(p, { x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26 });
        return;
      }
    }
  }

  /** Raising the one you killed binds them to you: the bond is saved, the body is not. */
  protected override raise(p: Player, ahead: Vec) {
    const before = [...this.state.graves];
    const started = super.raise(p, ahead);
    const character = this.characters.get(p.id);
    if (!started || !character) return started;
    const consumed = before.find((g) => !this.state.graves.includes(g));
    if (consumed?.victim) {
      character.thrall = {
        victimId: consumed.victim,
        name: consumed.name,
        classId: consumed.classId,
        level: consumed.level ?? 1,
        maxHp: consumed.maxHp ?? CLASSES[consumed.classId].hp,
      };
      this.sheetChanged.add(p.id);
    }
    return started;
  }

  /** The engine sizes a thrall for a duel; a raised character keeps a share of its real life. */
  protected override finishRaise(p: Player) {
    const count = this.state.zombies.length;
    super.finishRaise(p);
    const bond = this.characters.get(p.id)?.thrall;
    if (!bond || this.state.zombies.length === count) return;
    const z = this.state.zombies.at(-1)!;
    const hp = Math.max(1, Math.round(Math.min(bond.maxHp, p.maxHp) * THRALL_HP_SHARE * 10) / 10);
    z.hp = hp;
    z.maxHp = hp;
    z.level = bond.level;
    this.notify(p.id, {
      kind: 'raise',
      title: `${bond.name} se levanta`,
      text: 'Pelea para vos con lo que sabía en vida.',
      color: '#a070e0',
    });
  }

  /**
   * The impostor's eye on a monster: its hidden tree opens, its passive becomes yours, and a
   * monster that has grown hands its skills over further along.
   */
  private steal(p: Player, character: Character, prey: Zombie) {
    const family = prey.family!;
    const tree = MONSTER_TREES[family];
    character.copyCharges--;
    character.trees.push(family);
    character.passives.push(tree.passive.id);
    const start = 1 + Math.floor(prey.level / 5);
    for (const skillId of tree.skills) {
      const skill = SKILLS_WORLD[skillId];
      if (!character.skills[skillId]) character.skills[skillId] = { level: Math.min(start, skill.maxLevel), uses: 0, nodes: [] };
    }
    const free = CAST_SLOTS.find((slot) => slotOpen(slot, character.level) && character.slots[slot] === null);
    if (free) character.slots[free] = tree.skills[0];
    const creature = formName(family, prey.level);
    this.notify(p.id, {
      kind: 'steal',
      title: `Robaste «${tree.passive.name}»`,
      text: `Se abrió el árbol oculto del ${creature}: ${tree.skills.map((id) => SKILLS_WORLD[id].name).join(', ')}. ${tree.passive.text}`,
      color: '#ff6fb0',
      rarity: 'unica',
    });
    this.applyCharacter(p, character);
    this.event('raise', prey, p.team);
    this.sheetChanged.add(p.id);
  }

  /**
   * Every use counts, silently. At the threshold the System surprises the player: a level, or an
   * evolution that renames the skill. Casting an affinity's skill also cultivates that affinity —
   * fast while the character is a child, slowly as a youth, never again as an adult.
   */
  private grow(p: Player, character: Character, skill: WorldSkill) {
    const progress = character.skills[skill.id];
    progress.uses++;
    if (progress.level < skill.maxLevel && progress.uses >= usesToLevel(skill, progress.level))
      this.raiseSkillLevel(p.id, skill, progress);
    const school = skill.school as Affinity;
    const affinity = character.affinities[school];
    if (affinity) {
      const before = rankOf(affinity.xp);
      affinity.xp += affinityGain(affinity);
      cultivate(affinity, character.level);
      const after = rankOf(affinity.xp);
      if (after > before) {
        const arcane = ARCANE.includes(school);
        this.notify(p.id, {
          kind: 'rank',
          title: `${AFFINITY_NAMES[school]}: rango ${RANKS[after]}`,
          text:
            arcane && after === SILENT_CAST_RANK
              ? 'Ya no necesitás palabras: la magia te responde en silencio.'
              : !arcane && after === TOUKI_RANK
                ? 'Algo arde bajo tu piel. Es Touki, y nadie te lo enseñó.'
                : 'Tu afinidad se volvió más profunda.',
          color: skill.color,
        });
      }
    }
    this.sheetChanged.add(p.id);
  }

  /** A level, and the evolution it may bring, announced the same way whether use or a book earned it. */
  private raiseSkillLevel(id: string, skill: WorldSkill, progress: SkillProgress) {
    const previous = skillName(skill, progress.level);
    progress.uses = 0;
    progress.level++;
    const evolution = skill.evolutions.find((e) => e.level === progress.level);
    if (evolution)
      this.notify(id, {
        kind: 'evolution',
        title: `«${previous}» evolucionó en «${evolution.name}»`,
        text: evolution.line,
        color: skill.color,
        rarity: skill.rarity,
        skillId: skill.id,
      });
    else
      this.notify(id, {
        kind: 'skill',
        title: `${skillName(skill, progress.level)} → Nv ${progress.level}`,
        text: 'Algo en tu cuerpo aprendió sin avisarte.',
        color: skill.color,
        skillId: skill.id,
      });
  }

  /** Mushoku Tensei's childhood rule for mana: run it dry as a child and the channels widen. */
  private widen(p: Player, character: Character) {
    if (character.level > 10 || this.widened.has(p.id) || p.mana > p.maxMana * 0.1) return;
    character.bonusMana += 1;
    this.widened.set(p.id, WIDENING_EVERY);
    p.maxMana = this.maxManaOf(character);
    if (character.bonusMana === 1)
      this.notify(p.id, {
        kind: 'widen',
        title: 'Tus canales de maná se ensancharon',
        text: 'Gastarte hasta el fondo siendo chico te hace más grande. Nadie te lo va a decir dos veces.',
        color: '#9fd8ff',
      });
  }

  // ─── Damage ───────────────────────────────────────────────────────────────────────────────────

  /**
   * A raised parry turns a monster's blow back on it. Damage a character deals grows with buffs,
   * passives and Touki, and a draining skill heals the caster. A monster that kills grows.
   */
  override damage(
    target: Player,
    source: Pick<Player, 'team'>,
    angle: number,
    amount = 1,
    options: { pierce?: boolean; ignoreInvuln?: boolean; freeze?: boolean } = {},
  ): boolean {
    if (!this.hostile(source, target)) return false;
    const striker = source as Partial<Zombie>;
    const parry = this.parries.get(target.id);
    // A reflected blow cannot be parried back, or two parries would bounce it forever.
    if (parry && target.hp > 0 && !this.reflecting) {
      if (striker.family && (striker.hp ?? 0) > 0) {
        this.damageZombie(striker as Zombie, target.team, amount * parry.reflect, angle + Math.PI, target.id);
        this.event('counter', target, target.team, angle + Math.PI, target.classId, parry.reflect >= 2 ? 1 : 0);
        return false;
      }
      const attacker = this.state.players.find((q) => q.id === (source as Partial<Player>).id);
      if (attacker && attacker !== target) {
        // A Sombra's blow arrives in its owner's name; an owner standing far away is only blocked.
        if (distance(attacker, target) <= PARRY_REACH) {
          this.reflecting = true;
          try {
            this.damage(attacker, target, angle + Math.PI, amount * parry.reflect);
          } finally {
            this.reflecting = false;
          }
        }
        this.event('counter', target, target.team, angle + Math.PI, target.classId, parry.reflect >= 2 ? 1 : 0);
        return false;
      }
    }
    const caster = (source as Partial<Player>).id;
    const scaled = caster && this.characters.has(caster) ? amount * this.damageMultiplier(caster) : amount;
    const alive = target.hp > 0;
    const landed = super.damage(target, source, angle, scaled, options);
    // A blow that lands takes the hands off the chest.
    if (landed) this.opening.delete(target.id);
    if (landed && caster) this.heal(caster, scaled);
    if (landed && alive && target.hp <= 0) this.onDeath(target, source);
    return landed;
  }

  private reflecting = false;

  /**
   * A death. The grave remembers who lies there and who put them there; the wild takes a tenth of
   * the level's experience (never a level, never an item); the killer hears about it.
   */
  private onDeath(target: Player, source: Pick<Player, 'team'>) {
    const striker = source as Partial<Zombie & Player>;
    if (striker.family) this.evolveMonster(striker as Zombie);
    const killerId =
      striker.id !== undefined && !striker.family && striker.id !== target.id && this.characters.has(String(striker.id))
        ? String(striker.id)
        : undefined;
    const grave = this.state.graves.at(-1);
    if (grave && grave.name === target.name && grave.victim === undefined)
      Object.assign(grave, { victim: target.id, killer: killerId, level: target.level, maxHp: target.maxHp });
    this.incantations.delete(target.id);
    this.buffs.delete(target.id);
    this.drains.delete(target.id);
    this.parries.delete(target.id);

    const character = this.characters.get(target.id);
    if (character) {
      const lost = this.definition.pvp === 'wild' ? deathPenalty(character.level, character.xp) : 0;
      character.xp -= lost;
      if (lost > 0) this.sheetChanged.add(target.id);
      const by = killerId
        ? this.characters.get(killerId)!.name
        : striker.family
          ? formName(striker.family, striker.level ?? 1)
          : undefined;
      this.notify(target.id, {
        kind: 'death',
        title: 'Caíste',
        text:
          (by ? `${by} te mató. ` : '') +
          (lost > 0 ? `Perdiste ${lost} de experiencia; lo que llevás es tuyo.` : 'Acá no se pierde nada. Volvés al altar.'),
        color: '#ff5a6e',
      });
    }

    const killer = killerId ? this.characters.get(killerId) : undefined;
    if (!killer || !character) return;
    // Killing another player gives no experience, or two browsers could farm each other.
    const awakens = this.definition.pvp === 'wild' && (killer.affinities.sombra?.points ?? 0) > 0 && !killer.skills.alzar;
    if (awakens) {
      killer.skills.alzar = { level: 1, uses: 0, nodes: [] };
      const free = CAST_SLOTS.find((slot) => slotOpen(slot, killer.level) && killer.slots[slot] === null);
      if (free) killer.slots[free] = 'alzar';
      this.sheetChanged.add(killer.id);
      this.notify(killer.id, { kind: 'learn', title: 'Un muerto te mira', text: '«Alzar» despertó en vos.', color: '#a070e0', skillId: 'alzar' });
    }
    this.notify(killer.id, {
      kind: 'kill',
      title: `Derrotaste a ${target.name}`,
      text: killer.skills.alzar
        ? `Su cuerpo queda ${RULES.graveLife} s. Podés alzarlo.`
        : 'Su tumba queda un momento donde cayó.',
      color: '#a070e0',
    });
  }

  private heal(id: string, dealt: number) {
    const drain = this.drains.get(id);
    if (!drain) return;
    const p = this.state.players.find((q) => q.id === id);
    if (p && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + dealt * drain.share);
  }

  /** A monster that killed a player climbs a level, heals, and may change form. */
  private evolveMonster(z: Zombie) {
    const before = formName(z.family!, z.level);
    z.level = Math.min(60, z.level + 1);
    const stats = mobStats(z.family!, z.level);
    z.maxHp = stats.hp;
    z.hp = z.maxHp;
    this.event('levelup', z, z.team, undefined, undefined, z.level);
    if (formName(z.family!, z.level) !== before) this.event('raise', z, z.team);
  }

  /**
   * Experience for a kill goes to whoever struck it (`by`), not to whoever stood closest: a
   * bystander in the wild must not collect someone else's kill, buffs or drain.
   */
  override damageZombie(z: Zombie, team: Team, amount = 1, angle?: number, by?: string) {
    const alive = z.hp > 0;
    const credit = this.creditFor(z, by);
    const scaled = credit.own && credit.killer ? amount * this.damageMultiplier(credit.killer.id) : amount;
    super.damageZombie(z, team, scaled, angle, by);
    if (credit.own && credit.killer && alive) this.heal(credit.killer.id, scaled);
    if (!alive || z.hp > 0 || !z.family) return;
    this.corpses.push({ x: z.x, y: z.y, left: CORPSE_LIFE });
    const killer = credit.killer ?? (by === undefined ? this.nearestRival(z, Infinity) : undefined);
    if (!killer) return;
    const character = this.characters.get(killer.id)!;
    const won = xpFor(z.family, z.level, character.level);
    const subida = this.grantXp(killer.id, won);
    // Announced only when a level is actually gained, and on the one who gained it: emitting it on
    // every kill with power 0 painted "NV 0" over each dead monster.
    if (subida) this.event('levelup', killer, team, undefined, killer.classId, subida.level);
  }

  // ─── The loop ─────────────────────────────────────────────────────────────────────────────────

  /**
   * The world's own loop. Same order as the duel — defenses and movement first, impacts after —
   * reusing the inherited pieces, and without the flag, capture and match-clock tail.
   */
  override step(inputs: Map<string, Input>, dt = RULES.tick as number) {
    const s = this.state;
    s.tick++;
    if (s.paused) return;
    this.stepSkills(dt);
    const shaped = new Map<string, Input>();
    for (const [id, input] of inputs) {
      const character = this.characters.get(id);
      shaped.set(id, worldInput(input, character?.weapon ?? 'espada', this.incantations.has(id)));
    }
    const placements = this.stepPlayers(shaped, dt);
    // A parry is the engine's counter window, set after movement so no class kit can clear it.
    for (const p of s.players) {
      if (!this.characters.has(p.id)) continue;
      const parry = this.parries.get(p.id);
      p.counterLeft = parry?.left ?? 0;
      p.counterCharge = parry && parry.reflect >= 2 ? RULES.counterChargeTime : 0;
    }
    this.stepArrows(dt);
    this.stepZombies(dt);
    this.stepTraps(placements, dt);
    // After every blow of the tick has had its chance to interrupt; before a portal can take the
    // opener to another zone.
    this.stepChests(dt);
    this.stepPortals(dt);
    this.stepSpawners(dt);
    this.stepMana(dt);
    this.syncParticipants();
  }

  /**
   * Borders between zones. Stepping into a portal either asks the room for the trip or, below the
   * zone's level (or towards a zone not built yet), pushes the player back in and says why.
   */
  private stepPortals(dt: number) {
    for (const [id, left] of this.portalCd) {
      if (left - dt <= 0) this.portalCd.delete(id);
      else this.portalCd.set(id, left - dt);
    }
    for (const p of this.state.players) {
      if (p.hp <= 0 || this.portalCd.has(p.id)) continue;
      const character = this.characters.get(p.id);
      if (!character) continue;
      for (const portal of this.definition.portals) {
        const a = portal.area;
        if (p.x < a.x || p.x > a.x + a.w || p.y < a.y || p.y > a.y + a.h) continue;
        this.portalCd.set(p.id, PORTAL_COOLDOWN);
        const open = !!ZONES[portal.to];
        if (open && character.level >= portal.minLevel) {
          this.travels.push({ id: p.id, to: portal.to, arrive: portal.arrive });
        } else {
          this.refusals.push({ id: p.id, to: portal.to, minLevel: portal.minLevel, open });
          const b = this.definition.terrain.bounds;
          const dx = (b.minX + b.maxX) / 2 - (a.x + a.w / 2);
          const dy = (b.minY + b.maxY) / 2 - (a.y + a.h / 2);
          const length = Math.hypot(dx, dy) || 1;
          translate(p, (dx / length) * PORTAL_PUSH, (dy / length) * PORTAL_PUSH, this.terrain);
        }
        break;
      }
    }
  }

  /**
   * Guarded camps, Warcraft-style: each one keeps its own monsters alive, refills them on a timer
   * and pulls back whoever chased too far, so nobody can drag a camp across the valley.
   */
  private stepSpawners(dt: number) {
    const s = this.state;
    const camps = this.definition.spawners;
    for (let i = 0; i < camps.length; i++) {
      const camp = camps[i];
      const campId = this.campId(i);
      const mine = s.zombies.filter((z) => z.owner === campId && z.hp > 0);
      const stats = mobStats(camp.familyId, camp.level);
      for (const z of mine) {
        // Beyond its leash a monster forgets the chase, walks home and heals on the way.
        if (distance(z, camp.at) <= stats.leash) continue;
        z.target = null;
        z.hp = Math.min(z.maxHp, z.hp + z.maxHp * 0.25 * dt);
        this.walkZombie(z, camp.at, dt);
      }
      if (mine.length >= camp.count) continue;
      const left = (this.respawn.get(campId) ?? 0) - dt;
      if (left > 0) {
        this.respawn.set(campId, left);
        continue;
      }
      this.respawn.set(campId, camp.respawnSeconds);
      this.spawnMob(camp, campId);
    }
  }

  /** The camp id lives in `owner`: no player answers to it, so the brain treats the mob as wild. */
  private campId(index: number) {
    return `wild:${this.zoneId}:${index}`;
  }

  private spawnMob(camp: Spawner, campId: string) {
    const stats = mobStats(camp.familyId, camp.level);
    const angle = (this.state.zombies.length * 2.4) % (Math.PI * 2);
    const at = {
      x: camp.at.x + Math.cos(angle) * camp.radius * 0.7,
      y: camp.at.y + Math.sin(angle) * camp.radius * 0.7,
    };
    const z = this.newZombie({ id: campId, team: 'red', angle }, at, camp.at, {
      family: camp.familyId,
      faction: 'monster',
      level: camp.level,
      hp: stats.hp,
      maxHp: stats.hp,
      name: MOB_FAMILIES[camp.familyId].name,
    });
    this.state.zombies.push(z);
  }

  // ─── Chests ───────────────────────────────────────────────────────────────────────────────────

  /**
   * Standing next to a ready chest, untouched, opens it. No key and no message: the client can
   * never name a chest or what is inside. First to finish takes everything. An emptied chest
   * returns after its timer, and only once its camp stands whole again.
   */
  private stepChests(dt: number) {
    const s = this.state as WorldSnapshot;
    const camps = this.definition.spawners;
    for (const chest of s.chests) {
      if (chest.ready) continue;
      chest.respawnLeft = Math.max(0, chest.respawnLeft - dt);
      const index = this.chestCamp.get(chest.id)!;
      const guards = s.zombies.filter((z) => z.owner === this.campId(index) && z.hp > 0).length;
      if (chest.respawnLeft <= 0 && guards >= camps[index].count) {
        chest.ready = true;
        this.event('pickup', chest, 'red', undefined, undefined, -1);
      }
    }
    for (const p of s.players) {
      const character = this.characters.get(p.id);
      if (!character || p.hp <= 0) {
        this.opening.delete(p.id);
        continue;
      }
      const chest = s.chests
        .filter((c) => c.ready && distance(p, c) <= CHEST_REACH)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      const warned = chest ? `${p.id}|${chest.id}` : '';
      for (const key of this.lootWarned) if (key.startsWith(`${p.id}|`) && key !== warned) this.lootWarned.delete(key);
      const current = this.opening.get(p.id);
      if (!chest || (current && current.chestId !== chest.id)) this.opening.delete(p.id);
      if (!chest) continue;
      const rules = CHEST_TIERS[chest.tier];
      if (INVENTORY_SIZE - character.inventory.length < rules.maxDrops) {
        if (!this.lootWarned.has(warned)) {
          this.lootWarned.add(warned);
          this.deny(p.id, rules.name, `Tu bolsa no tiene lugar: hacé espacio para ${rules.maxDrops} objetos.`);
        }
        continue;
      }
      const entry = this.opening.get(p.id) ?? { chestId: chest.id, elapsed: 0 };
      entry.elapsed += dt;
      this.opening.set(p.id, entry);
      if (entry.elapsed + 1e-9 >= rules.openSeconds) this.loot(p, character, chest);
    }
    for (const chest of s.chests) {
      let lead: { id: string; elapsed: number } | null = null;
      for (const [id, entry] of this.opening)
        if (entry.chestId === chest.id && (!lead || entry.elapsed > lead.elapsed)) lead = { id, elapsed: entry.elapsed };
      chest.opener = lead?.id ?? null;
      chest.progress = lead ? Math.min(1, lead.elapsed / CHEST_TIERS[chest.tier].openSeconds) : 0;
    }
  }

  private loot(p: Player, character: Character, chest: ChestView) {
    const rules = CHEST_TIERS[chest.tier];
    const camp = this.definition.spawners[this.chestCamp.get(chest.id)!];
    const drops = rollLoot({ tier: chest.tier, campLevel: camp.level, character, random: this.random });
    const items = drops.flatMap((itemId) => this.give(p.id, itemId) ?? []);
    chest.ready = false;
    chest.respawnLeft = rules.respawnSeconds;
    for (const [id, entry] of this.opening) {
      if (entry.chestId !== chest.id) continue;
      this.opening.delete(id);
      if (id !== p.id) this.deny(id, rules.name, 'Alguien lo abrió primero.');
    }
    const order = ['comun', 'rara', 'epica', 'legendaria', 'unica'];
    const best = items
      .map((i) => ITEMS[i.itemId].rarity)
      .sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
    this.notify(p.id, {
      kind: 'loot',
      title: `¡${rules.name} abierto!`,
      text: `Conseguiste: ${items.map((i) => ITEMS[i.itemId].name).join(', ')}.`,
      rarity: best,
      tier: chest.tier,
      items,
      color: chest.tier === 'legendario' ? '#ffc84d' : chest.tier === 'raro' ? '#56b8ff' : '#c9a36b',
    });
    this.event('pickup', chest, p.team, undefined, undefined, 1);
  }

  // ─── Bag and gear ─────────────────────────────────────────────────────────────────────────────

  private bagChanged(id: string) {
    this.sheetChanged.add(id);
    this.saveNow.add(id);
  }

  /** The one door items come in through. Null when the bag is full or the item does not exist. */
  give(id: string, itemId: string): ItemInstance | null {
    const character = this.characters.get(id);
    if (!character || !ITEMS[itemId] || character.inventory.length >= INVENTORY_SIZE) return null;
    const instance = { uid: `i${character.itemSerial++}`, itemId };
    character.inventory.push(instance);
    this.bagChanged(id);
    return instance;
  }

  /** Puts on what is in the bag; what was worn takes its place in the bag, so nothing overflows. */
  equip(id: string, uid: string): boolean {
    const character = this.characters.get(id);
    const p = this.state.players.find((q) => q.id === id);
    const index = character?.inventory.findIndex((i) => i.uid === uid) ?? -1;
    // A uid the character does not own is a forged message: nothing to explain.
    if (!character || !p || index < 0) return false;
    const instance = character.inventory[index];
    const item = ITEMS[instance.itemId];
    const refuse = (text: string) => (this.deny(id, item?.name ?? 'Objeto', text), false);
    if (!item?.slot) return refuse('Eso no se equipa.');
    if (character.level < item.level) return refuse(`Necesitás nivel ${item.level} para «${item.name}».`);
    if (p.hp <= 0) return refuse('Los caídos no se cambian de equipo.');
    if (this.incantations.has(id)) return refuse('No en medio de un conjuro.');
    const previous = character.equipment[item.slot];
    if (previous) character.inventory[index] = previous;
    else character.inventory.splice(index, 1);
    (character.equipment as Record<EquipSlot, ItemInstance | null>)[item.slot] = instance;
    if (item.slot === 'weapon' && item.weapon) {
      character.weapon = item.weapon;
      character.classId = WEAPONS[item.weapon].classId;
      // A new weapon is a new engine class: its kit and skin, never the old one's shield or charges.
      const kit = defaultCustomization(character.classId);
      p.classId = character.classId;
      p.skinId = kit.selectedSkin;
      p.loadout = { ...activePreset(kit).loadout };
      p.windup = 0;
      p.shotCharge = 0;
      p.specialCharge = 0;
      p.swingPower = 0;
      p.guarding = false;
      p.attackLock = Math.max(p.attackLock, 0.6);
    }
    this.opening.delete(id);
    this.applyCharacter(p, character);
    this.bagChanged(id);
    return true;
  }

  unequip(id: string, slot: EquipSlot): boolean {
    const character = this.characters.get(id);
    const p = this.state.players.find((q) => q.id === id);
    if (!character || !p) return false;
    if (slot === 'weapon') return (this.deny(id, 'Arma', 'Las manos no quedan vacías: cambiá el arma por otra.'), false);
    const instance = character.equipment[slot];
    if (!instance) return false;
    if (character.inventory.length >= INVENTORY_SIZE)
      return (this.deny(id, ITEMS[instance.itemId]?.name ?? 'Objeto', `Tu bolsa está llena (${INVENTORY_SIZE}/${INVENTORY_SIZE}).`), false);
    character.equipment[slot] = null;
    character.inventory.push(instance);
    this.applyCharacter(p, character);
    this.bagChanged(id);
    return true;
  }

  /** Gone for good. Only what is in the bag; what is worn has to come off first. */
  discard(id: string, uid: string): boolean {
    const character = this.characters.get(id);
    const index = character?.inventory.findIndex((i) => i.uid === uid) ?? -1;
    if (!character || index < 0) return false;
    character.inventory.splice(index, 1);
    this.bagChanged(id);
    return true;
  }

  /**
   * Reads a grimoire. Every check runs before anything changes, so a refusal never eats the book;
   * a success removes it and applies it in the same call.
   */
  useItem(id: string, uid: string, skillId?: string): boolean {
    const character = this.characters.get(id);
    const p = this.state.players.find((q) => q.id === id);
    const index = character?.inventory.findIndex((i) => i.uid === uid) ?? -1;
    if (!character || !p || index < 0) return false;
    const item = ITEMS[character.inventory[index].itemId];
    const effect = item?.grimoire;
    const refuse = (text: string) => (this.deny(id, item?.name ?? 'Objeto', text), false);
    if (!effect) return refuse(item?.slot ? 'Eso no se lee: se equipa.' : 'No sabés qué hacer con esto.');
    if (p.hp <= 0) return refuse('Los caídos no leen.');
    const consume = () => {
      character.inventory.splice(index, 1);
      this.bagChanged(id);
    };
    const tell = (title: string, text: string, color = '#9fd8ff') => this.notify(id, { kind: 'item', title, text, color });

    switch (effect.kind) {
      case 'teach': {
        const skill = SKILLS_WORLD[effect.skillId];
        if (!skill) return refuse('Las páginas están en blanco.');
        const known = character.skills[skill.id];
        if (known) {
          if (known.level >= skill.maxLevel) return refuse(`«${skillName(skill, known.level)}» ya está en su nivel máximo.`);
          consume();
          this.raiseSkillLevel(id, skill, known);
          return true;
        }
        consume();
        character.skills[skill.id] = { level: 1, uses: 0, nodes: [] };
        const open = schoolOpen(skill, character.affinities, character.trees);
        const free = CAST_SLOTS.find((slot) => slotOpen(slot, character.level) && character.slots[slot] === null);
        if (open && free) character.slots[free] = skill.id;
        tell(
          `Aprendiste «${skill.name}»`,
          open ? skill.flavor : 'La conocés, pero tu cuerpo todavía no reconoce su flujo. Abrí esa afinidad para usarla.',
          skill.color,
        );
        return true;
      }
      case 'affinity': {
        const state = character.affinities[effect.affinity];
        const name = AFFINITY_NAMES[effect.affinity];
        if (state && state.points >= AFFINITY_POINT_CAP) return refuse(`${name} ya llegó a su tope de ${AFFINITY_POINT_CAP} puntos.`);
        consume();
        if (state) state.points++;
        else character.affinities[effect.affinity] = { points: 1, xp: 0, cultivation: 1 };
        tell(state ? `${name} se profundiza` : `Se abrió ${name}`, state ? `Ahora tenés ${state.points} puntos.` : 'Una puerta que no sabías que existía.');
        return true;
      }
      case 'train': {
        const skill = skillId ? SKILLS_WORLD[skillId] : undefined;
        const progress = skill ? character.skills[skill.id] : undefined;
        if (!skill || !progress || progress.level >= skill.maxLevel)
          return refuse('Elegí una habilidad que conozcas y que todavía pueda crecer.');
        consume();
        this.raiseSkillLevel(id, skill, progress);
        return true;
      }
      case 'copy': {
        if (character.copyCharges >= COPY_CHARGE_CAP) return refuse(`El ojo no aguanta más de ${COPY_CHARGE_CAP} cargas.`);
        consume();
        character.copyCharges++;
        tell('El ojo se abre otra vez', `Cargas del Ojo del Impostor: ${character.copyCharges}.`, '#ff6fb0');
        return true;
      }
    }
  }

  /** Mana ticks back for anyone who has a pool at all. */
  private stepMana(dt: number) {
    for (const p of this.state.players) {
      const character = this.characters.get(p.id);
      if (!character || p.hp <= 0) continue;
      const max = this.maxManaOf(character);
      p.mana = Math.min(max, (p.mana ?? max) + manaRegenFor(statsWithEquipment(character)) * dt);
      p.maxMana = max;
    }
  }
}

/** Points still to place, for the client's level-up panel. */
export const unspentPoints = (character: Character) => character.unspent;
export { POINTS_PER_LEVEL, CLASSES };
