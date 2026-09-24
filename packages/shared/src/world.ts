import {
  CLASSES,
  DEFAULT_MAP,
  Duel,
  RULES,
  distance,
  idleInput,
  newPlayer,
  projectileStats,
  translate,
  terrainOf,
  blinkTarget,
  solid,
  lineClear,
  blocked,
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
import {
  DEFAULT_ZONE,
  ZONES,
  zone,
  type Spawner,
  type ZoneDefinition,
  type ZoneId,
} from './rpg/zones.js';
import { MOB_FAMILIES, formName, mobStats, xpFor, type MobSkill } from './rpg/mobs.js';
import { worldTerrain } from './rpg/terrain.js';
import { WEAPON_PROFILE } from './rpg/weapons.js';
import { AFFINITY_COLORS } from './rpg/colors.js';
import {
  BASE_STATS,
  POINTS_PER_LEVEL,
  applyXp,
  deathPenalty,
  maxHpFor,
  maxManaFor,
  manaRegenFor,
  type StatId,
} from './rpg/progression.js';
import {
  AFFINITIES,
  AFFINITY_NAMES,
  ARCANE,
  MARTIAL,
  MONSTER_TREES,
  RANKS,
  SILENT_CAST_RANK,
  SKILLS_WORLD,
  SURF_RANK,
  channelledCombo,
  affinityBonus,
  TOUKI_RANK,
  canSurf,
  primaryElement,
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
  type SkillSchool,
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
/**
 * While the world is being tested the impostor's eye never runs out: it opens as many times as
 * anyone wants and spends no charge. Set it back to true to return to the one charge of the design.
 */
export const COPY_CHARGES_LIMITED = false;
/** How long the impostor's eye stays open waiting for its owner to choose. */
const STEAL_WINDOW = 20;
/** A child who runs their mana dry widens their channels, at most this often. */
const WIDENING_EVERY = 30;
/** Seconds a fiery or bleeding imbued blow keeps hurting. */
const BURN_TIME = 3;
/** An imbued weapon cultivates its affinity at most once in this many seconds of blows. */
const IMBUE_GROW_EVERY = 0.6;
/** Families that light and consecrated weapons hurt twice. */
const UNDEAD = new Set(
  Object.values(MOB_FAMILIES)
    .filter((f) => f.undead)
    .map((f) => f.id as string),
);
/** How the System names the weapon a combo lives in. */
const WEAPON_ARTICLE: Record<Character['weapon'], string> = {
  espada: 'una espada',
  baston: 'un bastón',
  arco: 'un arco',
  daga: 'una daga',
  escudo: 'un escudo y maza',
};
type Imbue = Extract<SkillEffect, { kind: 'imbue' }>;

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
/** One thing the impostor's eye could take from what it is looking at. */
export interface StealOption {
  id: string;
  kind: 'skill' | 'passive';
  name: string;
  text: string;
  icon: string;
  color: string;
  rarity?: string;
  /** The level the copy would start at, for a skill. */
  level?: number;
}

/** What the eye found: who it is looking at and everything it could take from them. */
export interface StealOffer {
  target: string;
  /** A monster gives its hidden tree; a character, what they know. */
  kind: 'monstruo' | 'personaje';
  options: StealOption[];
  /** How long the offer stands before the eye closes without taking anything. */
  seconds: number;
  /** False while the eye is being tested without charges. */
  costsCharge: boolean;
}

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
    | 'item'
    | 'social';
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
  /** What monsters throw: stones, webs, embers, spit. */
  mobShots: MobShot[];
  /** Active open-world duels visible in this zone. */
  duels: DuelView[];
}

export type SocialInviteKind = 'party' | 'trade' | 'duel';
export interface SocialInvite {
  id: string;
  kind: SocialInviteKind;
  from: { id: string; name: string };
  expiresAt: number;
}
export interface PartyMember {
  id: string;
  name: string;
  joinedAt: number;
  online?: boolean;
  zoneId?: ZoneId;
}
export interface Party {
  id: string;
  leaderId: string;
  members: PartyMember[];
}
export interface TradeView {
  id: string;
  partner: { id: string; name: string };
  own: ItemInstance[];
  theirs: ItemInstance[];
  accepted: boolean;
  partnerAccepted: boolean;
}
export interface DuelView {
  id: string;
  players: [string, string];
  names: [string, string];
  x: number;
  y: number;
  radius: number;
  phase: 'countdown' | 'fighting';
  countdown: number;
}

export interface MobShot extends Vec {
  id: number;
  owner: string;
  angle: number;
  speed: number;
  damage: number;
  life: number;
  radius: number;
  color: string;
  freeze?: number;
  poison?: { dps: number; seconds: number };
}

/** Around a wild zone's shrine nobody hurts anybody: the place you revive is not a place to camp. */
export const SHRINE_WARD = 240;
/** A raised character keeps this share of its life (capped by its raiser's). */
export const THRALL_HP_SHARE = 0.6;
/** A parry turns a player's blow back only on someone standing close enough to have struck it. */
const PARRY_REACH = 90;

/** Each attribute point above the starting value adds this much to what it scales. */
export const ATTRIBUTE_STEP = 0.06;
/** Chance of a critical blow per point of Perception above the starting value. */
export const CRIT_STEP = 0.03;
export const CRIT_MULTIPLIER = 1.5;

/** How close a character must stand to a chest to open it. */
export const CHEST_REACH = 44;

/** Which engine projectile carries each element, so existing renderers draw it for free. */
const BOLT_LOOK: Record<Element, { classId: ClassId; element?: Arrow['element']; wind?: boolean }> =
  {
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
  /** Steal offers waiting to be shown; the room sends each to its own character. */
  readonly stealOffers: { id: string; offer: StealOffer }[] = [];
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
  private mobSkillCd = new Map<string, Record<string, number>>();
  private mobCasting = new Map<string, { skill: MobSkill; left: number; aim: Vec; at: Vec }>();
  private mobBuffs = new Map<string, { left: number; damage: number }>();
  private poisons = new Map<string, { left: number; dps: number; tick: number; source: string }>();
  private mobShotId = 0;
  private incantations = new Map<string, { skillId: string; aim: Vec; left: number }>();
  private skillCd = new Map<string, number>();
  private parries = new Map<string, { left: number; reflect: number }>();
  private buffs = new Map<string, { left: number; damage: number; speed: number }>();
  private drains = new Map<string, { left: number; share: number }>();
  /** Weapons carrying an affinity for a while, by character. */
  private imbues = new Map<
    string,
    { left: number; skill: WorldSkill; effect: Imbue; grown: number }
  >();
  /** Burns left by fiery or bleeding blows, by target (character or monster). */
  private burns = new Map<string, { left: number; dps: number; tick: number; by: string }>();
  /** True while an imbue's own side effects resolve, so a burn or a push is never imbued again. */
  private pouring = false;
  private widened = new Map<string, number>();
  /** The eye is open on a target, waiting for its owner to pick what to take. */
  private stealing = new Map<
    string,
    { targetId: string; range: number; options: StealOption[]; left: number }
  >();
  /** Supplied by the room because parties span zones and survive this World instance. */
  partyRecipients: (killerId: string) => string[] = (id) => [id];
  private activeDuels = new Map<
    string,
    {
      view: DuelView;
      saved: Map<string, { x: number; y: number; hp: number; mana: number }>;
    }
  >();

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
    s.mobShots = [];
    s.duels = [];
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
  /** Walls, bounds and water: water stops bodies but not arrows, which only check walls. */
  protected override get terrain(): Rect[] | Terrain {
    return worldTerrain(this.zoneId);
  }

  /** Someone who rides water or wind crosses lakes; everyone else walks around them. */
  protected override terrainFor(p: Player): Rect[] | Terrain {
    const character = this.characters.get(p.id);
    return character && canSurf(character.affinities)
      ? worldTerrain(this.zoneId, true)
      : this.terrain;
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
    const spark = affinityBonus(character.affinities);
    return {
      regen: passive.regen + gear.regen + spark.regen,
      maxHp: passive.maxHp + gear.maxHp + spark.maxHp,
      // Heavy armor slows, but never to a crawl.
      speed: Math.max(-0.2, passive.speed + gear.speed + spark.speed),
      damage: passive.damage + gear.damage + spark.damage,
      xp: passive.xp + gear.xp,
      crit: spark.crit,
      lifesteal: spark.lifesteal,
      manaRegen: spark.manaRegen,
      cooldown: spark.cooldown,
      stealth: spark.stealth,
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
    p.look = WEAPON_PROFILE[character.weapon].look;
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
    p.thrall = character.thrall
      ? { classId: character.thrall.classId, name: character.thrall.name }
      : null;
    // A fresh entity carries its class's health; a character walks in whole.
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    // A save from before lakes blocked the way can stand in water it can no longer leave.
    if (solid(p.x, p.y, RULES.radius, this.terrainFor(p))) {
      p.x = this.definition.entry.x;
      p.y = this.definition.entry.y;
    }
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
    this.imbues.delete(id);
    this.stealing.delete(id);
    this.burns.delete(id);
    this.opening.delete(id);
    this.poisons.delete(id);
    for (const key of this.lootWarned) if (key.startsWith(`${id}|`)) this.lootWarned.delete(key);
  }

  /** Experience for a kill, applied to the sheet and reported so the client can announce it. */
  grantXp(id: string, amount: number): { level: number; gained: number } | null {
    const character = this.characters.get(id);
    if (!character || amount <= 0) return null;
    this.sheetChanged.add(id);
    const bonus = 1 + this.bonusesOf(character).xp;
    const before = character.level;
    // Party shares can be fractional. Do not round each recipient independently: doing so would
    // create or destroy XP when a reward does not divide into whole numbers.
    const adjusted = amount * bonus;
    const result = applyXp(character.level, character.xp, adjusted);
    character.level = result.level;
    character.xp = result.xp;
    character.unspent += result.unspent;
    character.skillPoints += result.gained;
    if (result.gained <= 0) return null;
    const p = this.state.players.find((player) => player.id === id);
    if (p) this.applyCharacter(p, character);
    const opened = CAST_SLOTS.filter(
      (slot) => SLOT_LEVEL[slot] > before && SLOT_LEVEL[slot] <= result.level,
    );
    this.notify(id, {
      kind: 'level',
      title: `Subiste a nivel ${result.level}`,
      text:
        `+${result.unspent} puntos de atributo · +${result.gained} de habilidad` +
        (opened.length
          ? ` · Se abrió la ranura ${opened.map((s) => SLOT_NAMES[s]).join(' y ')}`
          : ''),
      color: '#7fd8ff',
    });
    return { level: result.level, gained: result.gained };
  }

  private notify(id: string, notice: Omit<Notice, 'id'>) {
    this.notices.push({ id, ...notice });
  }

  duelOf(id: string) {
    return [...this.activeDuels.values()].find((d) => d.view.players.includes(id));
  }

  startDuel(aId: string, bId: string): boolean {
    const a = this.state.players.find((p) => p.id === aId && p.hp > 0);
    const b = this.state.players.find((p) => p.id === bId && p.hp > 0);
    if (!a || !b || a === b || this.duelOf(aId) || this.duelOf(bId)) return false;
    const id = `d:${this.zoneId}:${this.state.tick}:${aId}:${bId}`;
    const view: DuelView = {
      id,
      players: [aId, bId],
      names: [a.name, b.name],
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      radius: 360,
      phase: 'countdown',
      countdown: 3,
    };
    const saved = new Map([
      [aId, { x: a.x, y: a.y, hp: a.hp, mana: a.mana }],
      [bId, { x: b.x, y: b.y, hp: b.hp, mana: b.mana }],
    ]);
    for (const p of [a, b]) {
      p.hp = p.maxHp;
      p.mana = p.maxMana;
      p.invuln = 3;
      p.windup = p.shotCharge = p.specialCharge = 0;
    }
    this.clearDuelEffects([aId, bId]);
    this.activeDuels.set(id, { view, saved });
    (this.state as WorldSnapshot).duels = [...this.activeDuels.values()].map((d) => d.view);
    return true;
  }

  abandonDuel(id: string) {
    const duel = this.duelOf(id);
    if (!duel) return false;
    const winner = duel.view.players.find((p) => p !== id)!;
    this.finishDuel(duel, winner, 'abandono');
    return true;
  }

  private clearDuelEffects(ids: string[]) {
    const set = new Set(ids);
    this.state.arrows = this.state.arrows.filter((a) => !set.has(String(a.owner)));
    this.state.traps = this.state.traps.filter((t) => !set.has(String(t.owner)));
    for (const id of ids) {
      this.incantations.delete(id);
      this.buffs.delete(id);
      this.drains.delete(id);
      this.parries.delete(id);
      this.imbues.delete(id);
      this.burns.delete(id);
      this.poisons.delete(id);
    }
  }

  private finishDuel(
    duel: {
      view: DuelView;
      saved: Map<string, { x: number; y: number; hp: number; mana: number }>;
    },
    winnerId: string,
    reason: string,
  ) {
    const winner = this.characters.get(winnerId)?.name ?? 'Alguien';
    for (const id of duel.view.players) {
      const p = this.state.players.find((q) => q.id === id);
      const saved = duel.saved.get(id);
      if (p && saved)
        Object.assign(p, {
          ...saved,
          respawnLeft: 0,
          invuln: 0,
          windup: 0,
          shotCharge: 0,
          specialCharge: 0,
        });
      this.notify(id, {
        kind: 'social',
        title: `${winner} ganó el duelo`,
        text:
          reason === 'abandono'
            ? 'El rival abandonó el combate.'
            : 'El combate terminó sin pérdidas.',
        color: '#ffd36a',
      });
    }
    for (const [id, character] of this.characters) {
      if (duel.view.players.includes(id)) continue;
      const p = this.state.players.find((q) => q.id === id);
      if (p && distance(p, duel.view) <= 800)
        this.notify(id, {
          kind: 'social',
          title: `${winner} ganó el duelo`,
          text: `${duel.view.names.join(' contra ')}.`,
          color: '#ffd36a',
        });
    }
    this.clearDuelEffects(duel.view.players);
    this.state.graves = this.state.graves.filter(
      (g) => !duel.view.players.includes(g.victim ?? ''),
    );
    this.activeDuels.delete(duel.view.id);
    (this.state as WorldSnapshot).duels = [...this.activeDuels.values()].map((d) => d.view);
  }

  private stepDuels(dt: number) {
    for (const duel of this.activeDuels.values()) {
      if (duel.view.phase === 'countdown') {
        duel.view.countdown = Math.max(0, duel.view.countdown - dt);
        if (duel.view.countdown <= 0) {
          duel.view.phase = 'fighting';
          for (const id of duel.view.players) {
            const p = this.state.players.find((q) => q.id === id);
            if (p) p.invuln = 0;
          }
        }
      }
      for (const id of duel.view.players) {
        const p = this.state.players.find((q) => q.id === id);
        if (!p) continue;
        const dx = p.x - duel.view.x,
          dy = p.y - duel.view.y;
        const length = Math.hypot(dx, dy);
        if (length > duel.view.radius - RULES.radius) {
          const scale = (duel.view.radius - RULES.radius) / length;
          p.x = duel.view.x + dx * scale;
          p.y = duel.view.y + dy * scale;
        }
      }
    }
    (this.state as WorldSnapshot).duels = [...this.activeDuels.values()].map((d) => ({
      ...d.view,
    }));
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
      if (
        !skill ||
        !character.skills[skillId] ||
        !schoolOpen(skill, character.affinities, character.trees)
      )
        return false;
      for (const other of CAST_SLOTS)
        if (character.slots[other] === skillId) character.slots[other] = null;
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
    if (!character || !skill || !progress)
      return { ok: false, reason: 'No conocés esa habilidad.' };
    const check = canLearn(skill, progress, nodeId, character.skillPoints, character.stats);
    if (!check.ok) {
      this.notify(id, { kind: 'denied', title: skill.name, text: check.reason!, color: '#ff8a7a' });
      return check;
    }
    const node = skill.tree.find((n) => n.id === nodeId)!;
    progress.nodes.push(nodeId);
    character.skillPoints -= node.cost;
    this.notify(id, {
      kind: 'learn',
      title: `Aprendiste «${node.name}»`,
      text: node.text,
      color: skill.color,
      skillId,
    });
    if (node.grants.channel) this.channel(id, character, skill.school as Affinity);
    this.sheetChanged.add(id);
    return check;
  }

  /** Pours an affinity into the weapon in hand: the character learns that crossing's combo. */
  private channel(id: string, character: Character, affinity: Affinity) {
    const combo = channelledCombo(character.weapon, affinity);
    if (!combo || character.skills[combo.id]) return;
    character.skills[combo.id] = { level: 1, uses: 0, nodes: [] };
    this.notify(id, {
      kind: 'learn',
      title: `Tu ${WEAPONS[character.weapon].name.toLowerCase()} aprendió «${combo.name}»`,
      text: combo.flavor,
      color: combo.color,
      rarity: combo.rarity,
      skillId: combo.id,
    });
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
    const touki = MARTIAL.some((a) => rankOf(character.affinities[a]?.xp ?? 0) >= TOUKI_RANK)
      ? 0.15
      : 0;
    return (
      (1 + buff + this.bonusesOf(character).damage + touki) *
      this.attributeScale(character, this.castingSchool)
    );
  }

  /** Stealth: monsters notice a quiet character closer — until it touches them. */
  protected override noticeScale(id: string) {
    const character = this.characters.get(id);
    return character ? 1 - affinityBonus(character.affinities).stealth : 1;
  }

  /** A weapon with a swing of its own swings it; otherwise the engine class's. */
  protected override meleeStats(p: Player) {
    const character = this.characters.get(p.id);
    const melee = character ? WEAPON_PROFILE[character.weapon].melee : undefined;
    const base = super.meleeStats(p);
    return melee
      ? { ...base, meleeRange: melee.range, meleeArc: melee.arc, meleeDamage: melee.damage }
      : base;
  }

  /** The school of the skill resolving right now; undefined means the blow is the weapon's. */
  private castingSchool: SkillSchool | undefined;

  /**
   * What an attribute adds: Might for swords, shields and strength skills, Agility for bows,
   * daggers and dexterity or stealth skills, Magic for staves and every arcane spell.
   */
  attributeScale(character: Character, school?: SkillSchool) {
    const stats = statsWithEquipment(character);
    const stat: StatId =
      school === undefined
        ? WEAPON_PROFILE[character.weapon].stat
        : ARCANE.includes(school as Affinity)
          ? 'spirit'
          : school === 'destreza' || school === 'sigilo'
            ? 'agility'
            : 'might';
    return Math.max(0.5, 1 + ATTRIBUTE_STEP * (stats[stat] - BASE_STATS[stat]));
  }

  private critChance(character: Character) {
    return (
      Math.max(0, CRIT_STEP * (statsWithEquipment(character).perception - BASE_STATS.perception)) +
      affinityBonus(character.affinities).crit
    );
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
    return (
      x.x !== undefined &&
      x.y !== undefined &&
      distance(x as Vec, this.definition.shrine) <= SHRINE_WARD
    );
  }

  /** Sanctuaries refuse player against player; so does the ring around a wild zone's shrine. */
  protected override hostile(a: Allegiant, b: Allegiant) {
    const aid = String((a as { id?: unknown }).id ?? '');
    const bid = String((b as { id?: unknown }).id ?? '');
    const ad = aid ? this.duelOf(aid) : undefined;
    const bd = bid ? this.duelOf(bid) : undefined;
    if (ad || bd)
      return (
        !!ad &&
        ad === bd &&
        ad.view.phase === 'fighting' &&
        ad.view.players.includes(aid) &&
        ad.view.players.includes(bid)
      );
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
      .filter(
        (p) =>
          p.hp > 0 && this.characters.has(p.id) && this.rivals(p, z) && distance(p, z) <= reach,
      )
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
    const owner = minion
      ? s.players.find((p) => p.id === minion.owner && this.characters.has(p.id))
      : undefined;
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
    for (const imbue of this.imbues.values()) imbue.grown -= dt;
    for (const [id, imbue] of this.imbues) {
      if (imbue.left - dt > 0) continue;
      const p = this.state.players.find((q) => q.id === id);
      if (p) delete p.imbue;
    }
    this.stepBurns(dt);
    for (const [id, open] of this.stealing) {
      open.left -= dt;
      if (open.left > 0) continue;
      this.stealing.delete(id);
      this.deny(id, 'Ojo del Impostor', 'Tardaste y el ojo se cerró. La carga sigue siendo tuya.');
    }
    for (const map of [this.parries, this.buffs, this.drains, this.imbues] as Map<
      string,
      { left: number }
    >[]) {
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
      const agility = statsWithEquipment(character).agility - BASE_STATS.agility;
      p.pve.speed =
        (this.buffs.get(p.id)?.speed ?? 0) + bonus.speed + Math.max(-0.1, 0.015 * agility);
    }
    for (const [id, spell] of this.incantations) {
      spell.left -= dt;
      const caster = this.state.players.find((q) => q.id === id);
      if (caster?.blackHoleTelegraph) caster.blackHoleTelegraph.left=Math.max(0,spell.left);
      if (spell.left > 0) continue;
      this.incantations.delete(id);
      const p = this.state.players.find((q) => q.id === id);
      if (p) delete p.blackHoleTelegraph;
      const character = this.characters.get(id);
      if (p && character && p.hp > 0)
        this.resolve(p, character, SKILLS_WORLD[spell.skillId], spell.aim);
    }
    for (const request of this.requested.splice(0))
      this.request(request.id, request.slot, request.aim);
  }

  private deny(id: string, title: string, text: string) {
    this.notify(id, { kind: 'denied', title, text, color: '#ff8a7a' });
  }

  private request(id: string, slot: CastSlot, aim: Vec) {
    const p = this.state.players.find((q) => q.id === id);
    const character = this.characters.get(id);
    if (!p || !character || p.hp <= 0 || this.incantations.has(id)) return;
    if (!slotOpen(slot, character.level))
      return this.deny(
        id,
        `Ranura ${SLOT_NAMES[slot]}`,
        `Se abre en el nivel ${SLOT_LEVEL[slot]}.`,
      );
    const skillId = character.slots[slot];
    const skill = skillId ? SKILLS_WORLD[skillId] : undefined;
    const progress = skillId ? character.skills[skillId] : undefined;
    if (!skill || !progress)
      return this.deny(id, `Ranura ${SLOT_NAMES[slot]}`, 'No tenés nada ahí todavía.');
    if (!schoolOpen(skill, character.affinities, character.trees))
      return this.deny(id, skillName(skill, progress.level), refusalFor(skill.school));
    if (this.cooldownLeft(id, skill.id) > 0) return;
    const effective = effectiveSkill(skill, progress);
    if (p.mana + 1e-6 < effective.mana)
      return this.deny(
        id,
        effective.name,
        `Maná insuficiente: necesitás ${Math.ceil(effective.mana)}.`,
      );
    const blocked = this.precheck(p, character, skill, aim);
    if (blocked) return this.deny(id, effective.name, blocked);
    // Casting takes the hands off the chest.
    this.opening.delete(id);

    p.mana -= effective.mana;
    // Agility shortens every recharge, never below half.
    const quick = Math.max(
      0.5,
      1 -
        0.02 * (statsWithEquipment(character).agility - BASE_STATS.agility) -
        affinityBonus(character.affinities).cooldown,
    );
    this.skillCd.set(this.cooldownKey(id, skill.id), effective.cooldown * quick);
    const school = skill.school as Affinity;
    const silent =
      !skill.incantation || rankOf(character.affinities[school]?.xp ?? 0) >= SILENT_CAST_RANK;
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
      if(skill.effect.kind==='blackhole'){
        const gap=distance(p,aim),reach=Math.min(360,skill.effect.range),fraction=gap>reach?reach/gap:1;
        const bounds=terrainOf(this.terrain).bounds;
        p.blackHoleTelegraph={
          x:Math.max(bounds.minX,Math.min(bounds.maxX,p.x+(aim.x-p.x)*fraction)),
          y:Math.max(bounds.minY,Math.min(bounds.maxY,p.y+(aim.y-p.y)*fraction)),
          left:INCANTATION_TIME,total:INCANTATION_TIME,
        };
      }
      this.event('cast', p, p.team, Math.atan2(aim.y - p.y, aim.x - p.x), p.classId, 0);
    }
  }

  /** Skills that need something to act on refuse before spending anything. */
  private precheck(p: Player, character: Character, skill: WorldSkill, aim: Vec): string | null {
    if (skill.weapon && skill.weapon !== character.weapon)
      return `Esa habilidad vive en ${WEAPON_ARTICLE[skill.weapon]}. Con esto en la mano no responde.`;
    if (skill.effect.kind === 'raise') {
      const s = this.state;
      if (p.raiseCast > 0 || this.raising.has(p.id)) return 'Ya estás alzando a alguien.';
      if (s.zombies.some((z) => z.owner === p.id && z.kind === 'thrall' && z.hp > 0))
        return 'Tu Sombra ya camina a tu lado.';
      const grave = s.graves.some((g) => this.canRaise(p, g) && distance(p, g) <= RULES.raiseRange);
      if (!grave && !p.thrall) return 'No hay nadie que hayas matado cerca.';
      if (!grave && p.thrallCd > 0)
        return `Tu Sombra se está rearmando: ${Math.ceil(p.thrallCd)} s.`;
    }
    if (skill.effect.kind === 'devour' && !this.devourTarget(p, skill.effect.radius))
      return 'No hay nada que devorar cerca.';
    if (skill.effect.kind === 'steal') {
      if (COPY_CHARGES_LIMITED && character.copyCharges <= 0)
        return 'El ojo ya se cerró. No quedan cargas.';
      if (this.stealing.has(p.id)) return 'El ojo ya está abierto: elegí qué llevarte.';
      const prey = this.stealTarget(p, skill.effect.range, aim);
      if (!prey) return 'Apuntá a algo que esté al alcance.';
      if (!this.stealOptions(character, prey).options.length)
        return 'No le queda nada que vos no tengas.';
    }
    return null;
  }

  private devourTarget(p: Player, radius: number) {
    return [...this.corpses, ...this.state.graves].find((c) => distance(p, c) <= radius);
  }

  /**
   * What the eye is looking at: whatever lies closest to where the player aimed, within reach — a
   * monster, or in the wild another character. Aiming, not the nearest body, so a player can pick
   * the one creature in a pack whose tree they want.
   */
  private stealTarget(p: Player, range: number, aim?: Vec): Zombie | Player | undefined {
    const at = aim ?? p;
    const monsters = this.state.zombies.filter(
      (z) => z.family && z.hp > 0 && distance(p, z) <= range,
    );
    const rivals = this.state.players.filter(
      (q) =>
        q !== p &&
        q.hp > 0 &&
        this.characters.has(q.id) &&
        this.rivals(p, q) &&
        distance(p, q) <= range,
    );
    return [...monsters, ...rivals].sort((a, b) => distance(at, a) - distance(at, b))[0];
  }

  /** Everything a target could hand over that the thief does not already have. */
  private stealOptions(character: Character, target: Zombie | Player): StealOffer {
    const options: StealOption[] = [];
    const monster = (target as Zombie).family;
    if (monster) {
      const tree = MONSTER_TREES[monster];
      const level = 1 + Math.floor(target.level / 5);
      for (const skillId of tree.skills) {
        const skill = SKILLS_WORLD[skillId];
        if (character.skills[skillId]) continue;
        options.push({
          id: `skill:${skillId}`,
          kind: 'skill',
          name: skill.name,
          text: skill.flavor,
          icon: skill.icon,
          color: skill.color,
          rarity: skill.rarity,
          level: Math.min(level, skill.maxLevel),
        });
      }
      if (!character.passives.includes(tree.passive.id))
        options.push({
          id: `passive:${tree.passive.id}`,
          kind: 'passive',
          name: tree.passive.name,
          text: tree.passive.text,
          icon: 'el-sombra',
          color: '#ff6fb0',
          rarity: 'unica',
        });
      return {
        target: formName(monster, target.level),
        kind: 'monstruo',
        options,
        seconds: STEAL_WINDOW,
        costsCharge: COPY_CHARGES_LIMITED,
      };
    }
    const prey = this.characters.get(target.id)!;
    for (const [skillId, progress] of Object.entries(prey.skills)) {
      const skill = SKILLS_WORLD[skillId];
      // The eye cannot copy itself, and never hands over what the thief already knows.
      if (!skill || skill.effect.kind === 'steal' || character.skills[skillId]) continue;
      options.push({
        id: `skill:${skillId}`,
        kind: 'skill',
        name: skillName(skill, progress.level),
        text: skill.flavor,
        icon: skill.icon,
        color: skill.color,
        rarity: skill.rarity,
        // Copied from a living owner it arrives two levels duller, never below one.
        level: Math.max(1, progress.level - 2),
      });
    }
    for (const id of prey.passives) {
      if (character.passives.includes(id)) continue;
      const passive = Object.values(MONSTER_TREES).find((tree) => tree.passive.id === id)?.passive;
      if (passive)
        options.push({
          id: `passive:${id}`,
          kind: 'passive',
          name: passive.name,
          text: passive.text,
          icon: 'el-sombra',
          color: '#ff6fb0',
          rarity: 'unica',
        });
    }
    return {
      target: prey.name,
      kind: 'personaje',
      options,
      seconds: STEAL_WINDOW,
      costsCharge: COPY_CHARGES_LIMITED,
    };
  }

  /**
   * The choice the eye asked for. Checked again here, not only when it opened: the charge is spent
   * on what is actually taken, and a target that walked away or died takes its tree with it.
   */
  chooseSteal(id: string, optionId: string): boolean {
    const open = this.stealing.get(id);
    const p = this.state.players.find((q) => q.id === id);
    const character = this.characters.get(id);
    if (!open || !p || !character) return false;
    const option = open.options.find((o) => o.id === optionId);
    if (!option) return false;
    const target = [...this.state.zombies, ...this.state.players].find(
      (e) => e.id === open.targetId,
    );
    if (!target || target.hp <= 0 || distance(p, target) > open.range) {
      this.stealing.delete(id);
      this.deny(
        id,
        'Ojo del Impostor',
        'Se te fue de las manos. El ojo se cerró sin llevarse nada.',
      );
      return false;
    }
    if (COPY_CHARGES_LIMITED && character.copyCharges <= 0) {
      this.stealing.delete(id);
      return false;
    }
    this.stealing.delete(id);
    if (COPY_CHARGES_LIMITED) character.copyCharges--;
    const monster = (target as Zombie).family;
    const [kind, what] = [
      option.id.slice(0, option.id.indexOf(':')),
      option.id.slice(option.id.indexOf(':') + 1),
    ];
    if (kind === 'passive') character.passives.push(what);
    else {
      const skill = SKILLS_WORLD[what];
      // A monster's skill only answers to someone who carries its family's tree.
      if (skill.school === 'monstruo' && monster && !character.trees.includes(monster))
        character.trees.push(monster);
      // Copying from a door you never opened opens it a crack, exactly like a tome would.
      const school = skill.school as Affinity;
      if (AFFINITIES.includes(school) && !character.affinities[school])
        character.affinities[school] = { points: 1, xp: 0, cultivation: 1 };
      character.skills[what] = { level: option.level ?? 1, uses: 0, nodes: [] };
      const free = CAST_SLOTS.find(
        (slot) => slotOpen(slot, character.level) && character.slots[slot] === null,
      );
      if (free) character.slots[free] = what;
    }
    this.notify(id, {
      kind: 'steal',
      title: `Robaste «${option.name}»`,
      text:
        option.kind === 'passive'
          ? option.text
          : `Ahora es tuya, aunque nadie te la haya enseñado. ${option.text}`,
      color: '#ff6fb0',
      rarity: 'unica',
    });
    this.applyCharacter(p, character);
    this.event('raise', target, p.team);
    this.sheetChanged.add(id);
    this.saveNow.add(id);
    return true;
  }

  /** What a skill does once it leaves the caster's hands. */
  private resolve(p: Player, character: Character, skill: WorldSkill, aim: Vec) {
    const progress = character.skills[skill.id];
    if (!progress) return;
    const { effect } = effectiveSkill(skill, progress);
    const angle =
      Math.hypot(aim.x - p.x, aim.y - p.y) > 1 ? Math.atan2(aim.y - p.y, aim.x - p.x) : p.angle;
    const arcane = ARCANE.includes(skill.school as Affinity);
    const staff = arcane && character.weapon === 'baston' ? 1.1 : 1;
    this.castingSchool = skill.school;
    try {
      this.apply(p, character, skill, effect, angle, staff, aim);
    } finally {
      this.castingSchool = undefined;
    }
  }

  private apply(
    p: Player,
    character: Character,
    skill: WorldSkill,
    effect: SkillEffect,
    angle: number,
    staff: number,
    aim: Vec,
  ) {
    const s = this.state;
    switch (effect.kind) {
      case 'blackhole': {
        const distanceToAim = distance(p, aim);
        const reach = Math.min(360, effect.range);
        const fraction = distanceToAim > reach ? reach / distanceToAim : 1;
        const bounds = terrainOf(this.terrain).bounds;
        const x = Math.max(bounds.minX, Math.min(bounds.maxX, p.x + (aim.x - p.x) * fraction));
        const y = Math.max(bounds.minY, Math.min(bounds.maxY, p.y + (aim.y - p.y) * fraction));
        this.spawnBlackHole(p, x, y, {
          radius: effect.radius, burstRadius: effect.burstRadius, pull: effect.pull,
          damage: effect.damage * staff * this.attributeScale(character, skill.school),
          total: effect.duration,
        });
        return;
      }
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
          // The arrow lands later, counted as a weapon blow; the skill's own attribute travels in it.
          damageScale:
            (effect.damage * staff * this.attributeScale(character, skill.school)) /
            this.attributeScale(character),
          worldElement: effect.element,
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
          this.damageZombie(
            z,
            p.team,
            effect.damage * staff,
            Math.atan2(z.y - p.y, z.x - p.x),
            p.id,
          );
          if (effect.freeze && z.hp > 0) {
            z.frozenLeft = Math.max(z.frozenLeft, effect.freeze);
            this.event('freeze', z, z.team);
          }
        }
        for (const q of s.players) {
          if (q === p || q.hp <= 0 || !this.hostile(p, q) || distance(p, q) > effect.radius)
            continue;
          if (
            this.damage(q, p, Math.atan2(q.y - p.y, q.x - p.x), effect.damage * staff) &&
            effect.freeze
          )
            this.freeze(q);
        }
        this.event('explosion', p, p.team, angle, p.classId, 1);
        this.state.events.at(-1)!.color = skill.color;
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
        const terrain = this.terrainFor(p);
        if (p.classId === 'mage') {
          // The mage blinks: instant, short, and through walls; only the landing spot must be free.
          const from = { x: p.x, y: p.y };
          const to = blinkTarget(p, angle, effect.distance, terrain);
          p.x = to.x;
          p.y = to.y;
          this.event('blink', from, p.team, angle, p.classId, 1);
          const ev = this.state.events.at(-1)!;
          ev.tx = to.x;
          ev.ty = to.y;
          ev.playerId = p.id;
        } else {
          translate(
            p,
            Math.cos(angle) * effect.distance,
            Math.sin(angle) * effect.distance,
            terrain,
          );
          this.event('dash', p, p.team, angle, p.classId, 1);
        }
        p.invuln = Math.max(p.invuln, 0.25);
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
        // The eye opens on what is aimed at and waits: the charge is spent on the choice, not here.
        const prey = this.stealTarget(p, effect.range, {
          x: p.x + Math.cos(angle) * effect.range,
          y: p.y + Math.sin(angle) * effect.range,
        });
        if (!prey) return;
        const offer = this.stealOptions(character, prey);
        if (!offer.options.length) return;
        this.event('cast', prey, p.team, angle, p.classId, 1);
        this.state.events.at(-1)!.color = '#ff6fb0';
        if (offer.options.length === 1) {
          this.stealing.set(p.id, {
            targetId: prey.id,
            range: effect.range + 40,
            options: offer.options,
            left: STEAL_WINDOW,
          });
          this.chooseSteal(p.id, offer.options[0].id);
          return;
        }
        this.stealing.set(p.id, {
          targetId: prey.id,
          range: effect.range + 40,
          options: offer.options,
          left: STEAL_WINDOW,
        });
        this.stealOffers.push({ id: p.id, offer });
        return;
      }
      case 'raise': {
        this.raise(p, { x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26 });
        return;
      }
      case 'imbue': {
        this.imbues.set(p.id, { left: effect.duration, skill, effect, grown: 0 });
        p.imbue = skill.color;
        this.event('fury', p, p.team, p.angle, p.classId);
        this.state.events.at(-1)!.color = skill.color;
        return;
      }
    }
  }

  // ─── Imbued weapons ───────────────────────────────────────────────────────────────────────────

  /** The imbue shaping a blow a character deals right now — only a weapon's blow, never a spell's. */
  private imbueFor(id: string | undefined) {
    if (!id || this.castingSchool !== undefined || this.pouring || this.reflecting)
      return undefined;
    return this.imbues.get(id);
  }

  /** A blow's amount once the weapon carries an affinity: from behind, or on the undead, more. */
  private imbued(
    imbue: { effect: Imbue },
    target: { angle: number; family?: string },
    angle: number,
    amount: number,
  ) {
    let share = imbue.effect.damage;
    if (imbue.effect.backstab && Math.cos(target.angle - angle) > 0.5)
      share += imbue.effect.backstab;
    if (imbue.effect.holy && target.family && UNDEAD.has(target.family)) share += imbue.effect.holy;
    return amount * (1 + share);
  }

  /** What an imbued blow leaves behind once it landed: the element's effect, and a use of the affinity. */
  private pour(attackerId: string, target: Player | Zombie, angle: number, dealt: number) {
    const imbue = this.imbues.get(attackerId);
    const attacker = this.state.players.find((q) => q.id === attackerId);
    const character = this.characters.get(attackerId);
    if (!imbue || !attacker || !character) return;
    const e = imbue.effect;
    const monster = 'family' in target && !!(target as Zombie).family;
    this.pouring = true;
    try {
      if (target.hp > 0) {
        if (e.stun) {
          if (monster)
            (target as Zombie).frozenLeft = Math.max((target as Zombie).frozenLeft, e.stun);
          else {
            const q = target as Player;
            q.stunLeft = Math.max(q.stunLeft, e.stun);
            q.windup = 0;
            q.shotCharge = 0;
          }
        }
        if (e.freeze) {
          if (monster)
            (target as Zombie).frozenLeft = Math.max((target as Zombie).frozenLeft, e.freeze);
          else this.freeze(target as Player);
          this.event('freeze', target, target.team);
        }
        if (e.burn)
          this.burns.set(target.id, { left: BURN_TIME, dps: e.burn, tick: 1, by: attackerId });
        if (e.knock)
          translate(
            target,
            Math.cos(angle) * e.knock,
            Math.sin(angle) * e.knock,
            monster ? this.terrain : this.terrainFor(target as Player),
          );
      }
      if (e.drain) attacker.hp = Math.min(attacker.maxHp, attacker.hp + dealt * e.drain);
      this.event(
        'imbue',
        target,
        attacker.team,
        angle,
        attacker.classId,
        e.stun || e.freeze ? 1 : 0,
      );
      this.state.events.at(-1)!.color = imbue.skill.color;
      // Each imbued blow is a use of the affinity, at most one every short while.
      if (imbue.grown <= 0) {
        imbue.grown = IMBUE_GROW_EVERY;
        this.grow(attacker, character, imbue.skill);
      }
    } finally {
      this.pouring = false;
    }
  }

  private stepBurns(dt: number) {
    for (const [id, burn] of this.burns) {
      const attacker = this.state.players.find((q) => q.id === burn.by);
      const player = this.state.players.find((q) => q.id === id);
      const monster = player ? undefined : this.state.zombies.find((z) => z.id === id);
      const target = player ?? monster;
      if (!attacker || !target || target.hp <= 0) {
        this.burns.delete(id);
        continue;
      }
      burn.left -= dt;
      burn.tick -= dt;
      if (burn.tick <= 0) {
        burn.tick += 1;
        this.pouring = true;
        try {
          if (player)
            this.damage(player, attacker, 0, burn.dps, { ignoreInvuln: true, pierce: true });
          else this.damageZombie(monster!, attacker.team, burn.dps, undefined, attacker.id);
        } finally {
          this.pouring = false;
        }
      }
      if (burn.left <= 0) this.burns.delete(id);
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
      color: AFFINITY_COLORS.sombra,
    });
  }

  /**
   * The impostor's eye on a monster: its hidden tree opens, its passive becomes yours, and a
   * monster that has grown hands its skills over further along.
   */
  /**
   * Every use counts, silently. At the threshold the System surprises the player: a level, or an
   * evolution that renames the skill. Casting an affinity's skill also cultivates that affinity —
   * fast while the character is a child, slowly as a youth, never again as an adult.
   */
  private grow(p: Player, character: Character, skill: WorldSkill) {
    if (this.duelOf(p.id)) return;
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
            (school === 'agua' || school === 'viento') && after === SURF_RANK
              ? school === 'agua'
                ? 'El agua ya no te frena: la caminás como si fuera tierra.'
                : 'El viento te sostiene: cruzás el agua sin hundirte.'
              : arcane && after === SILENT_CAST_RANK
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
        this.damageZombie(
          striker as Zombie,
          target.team,
          amount * parry.reflect,
          angle + Math.PI,
          target.id,
        );
        this.event(
          'counter',
          target,
          target.team,
          angle + Math.PI,
          target.classId,
          parry.reflect >= 2 ? 1 : 0,
        );
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
        this.event(
          'counter',
          target,
          target.team,
          angle + Math.PI,
          target.classId,
          parry.reflect >= 2 ? 1 : 0,
        );
        return false;
      }
    }
    const caster = (source as Partial<Player>).id;
    const howl = striker.family && striker.id ? (this.mobBuffs.get(striker.id)?.damage ?? 0) : 0;
    const attacker = caster ? this.characters.get(caster) : undefined;
    const imbue = attacker && amount > 0 ? this.imbueFor(caster) : undefined;
    const base = imbue ? this.imbued(imbue, target, angle, amount) : amount;
    const crit = !!attacker && this.random() < this.critChance(attacker);
    const scaled = attacker
      ? base * this.damageMultiplier(caster!) * (crit ? CRIT_MULTIPLIER : 1)
      : amount * (1 + howl);
    const alive = target.hp > 0;
    const landed = super.damage(target, source, angle, scaled, options);
    // A blow that lands takes the hands off the chest.
    if (landed) this.opening.delete(target.id);
    if (landed && caster) this.heal(caster, scaled);
    if (landed && imbue && alive) this.pour(caster!, target, angle, scaled);
    if (landed && alive && target.hp <= 0) {
      const duel = this.duelOf(target.id);
      if (duel) {
        const winner = duel.view.players.find((id) => id !== target.id)!;
        this.state.graves = this.state.graves.filter(
          (g) => !(g.name === target.name && distance(g, target) < 2),
        );
        this.finishDuel(duel, winner, 'ko');
      } else this.onDeath(target, source);
    }
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
      striker.id !== undefined &&
      !striker.family &&
      striker.id !== target.id &&
      this.characters.has(String(striker.id))
        ? String(striker.id)
        : undefined;
    const grave = this.state.graves.at(-1);
    if (grave && grave.name === target.name && grave.victim === undefined)
      Object.assign(grave, {
        victim: target.id,
        killer: killerId,
        level: target.level,
        maxHp: target.maxHp,
      });
    this.incantations.delete(target.id);
    delete target.blackHoleTelegraph;
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
          (lost > 0
            ? `Perdiste ${lost} de experiencia; lo que llevás es tuyo.`
            : 'Acá no se pierde nada. Volvés al altar.'),
        color: '#ff5a6e',
      });
    }

    const killer = killerId ? this.characters.get(killerId) : undefined;
    if (!killer || !character) return;
    // Killing another player gives no experience, or two browsers could farm each other.
    const awakens =
      this.definition.pvp === 'wild' &&
      (killer.affinities.sombra?.points ?? 0) > 0 &&
      !killer.skills.alzar;
    if (awakens) {
      killer.skills.alzar = { level: 1, uses: 0, nodes: [] };
      const free = CAST_SLOTS.find(
        (slot) => slotOpen(slot, killer.level) && killer.slots[slot] === null,
      );
      if (free) killer.slots[free] = 'alzar';
      this.sheetChanged.add(killer.id);
      this.notify(killer.id, {
        kind: 'learn',
        title: 'Un muerto te mira',
        text: '«Alzar» despertó en vos.',
        color: AFFINITY_COLORS.sombra,
        skillId: 'alzar',
      });
    }
    this.notify(killer.id, {
      kind: 'kill',
      title: `Derrotaste a ${target.name}`,
      text: killer.skills.alzar
        ? `Su cuerpo queda ${RULES.graveLife} s. Podés alzarlo.`
        : 'Su tumba queda un momento donde cayó.',
      color: AFFINITY_COLORS.sombra,
    });
  }

  private heal(id: string, dealt: number) {
    const character = this.characters.get(id);
    const share =
      (this.drains.get(id)?.share ?? 0) +
      (character ? affinityBonus(character.affinities).lifesteal : 0);
    if (share <= 0) return;
    const p = this.state.players.find((q) => q.id === id);
    if (p && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + dealt * share);
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
    if (by && this.duelOf(by)) return;
    const alive = z.hp > 0;
    const credit = this.creditFor(z, by);
    const own = credit.own && credit.killer ? credit.killer : undefined;
    const imbue = own && amount > 0 && alive ? this.imbueFor(own.id) : undefined;
    const towards = angle ?? (own ? Math.atan2(z.y - own.y, z.x - own.x) : 0);
    const base = imbue ? this.imbued(imbue, z, towards, amount) : amount;
    const scaled = own ? base * this.damageMultiplier(own.id) : amount;
    super.damageZombie(z, team, scaled, angle, by);
    if (own && alive) this.heal(own.id, scaled);
    if (imbue && own) this.pour(own.id, z, towards, scaled);
    if (!alive || z.hp > 0 || !z.family) return;
    this.corpses.push({ x: z.x, y: z.y, left: CORPSE_LIFE });
    const killer = credit.killer ?? (by === undefined ? this.nearestRival(z, Infinity) : undefined);
    if (!killer) return;
    const character = this.characters.get(killer.id)!;
    const won = xpFor(z.family, z.level, character.level);
    const eligible = [...new Set(this.partyRecipients(killer.id))]
      .filter(
        (id) =>
          this.characters.has(id) && (this.state.players.find((p) => p.id === id)?.hp ?? 0) > 0,
      )
      .sort();
    if (!eligible.includes(killer.id)) eligible.push(killer.id);
    const share = won / eligible.length;
    let subidaLevel: number | null = null;
    eligible.forEach((id) => {
      const result = this.grantXp(id, share);
      if (id === killer.id && result) subidaLevel = result.level;
    });
    // Announced only when a level is actually gained, and on the one who gained it: emitting it on
    // every kill with power 0 painted "NV 0" over each dead monster.
    if (subidaLevel !== null)
      this.event('levelup', killer, team, undefined, killer.classId, subidaLevel);
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
      const duel = this.duelOf(id);
      shaped.set(
        id,
        duel?.view.phase === 'countdown'
          ? idleInput(input.seq, input.angle)
          : worldInput(input, character?.weapon ?? 'espada', this.incantations.has(id)),
      );
    }
    const firstArrow = this.arrowId;
    const placements = this.stepPlayers(shaped, dt);
    this.stepDuels(dt);
    this.tagWeaponShots(firstArrow);
    // A parry is the engine's counter window, set after movement so no class kit can clear it.
    for (const p of s.players) {
      if (!this.characters.has(p.id)) continue;
      const parry = this.parries.get(p.id);
      p.counterLeft = parry?.left ?? 0;
      p.counterCharge = parry && parry.reflect >= 2 ? RULES.counterChargeTime : 0;
    }
    this.stepArrows(dt);
    this.stepZombies(dt);
    this.stepBlackHoles(dt);
    this.stepMonsters(dt);
    this.stepMobShots(dt);
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
      if (p.hp <= 0 || this.portalCd.has(p.id) || this.duelOf(p.id)) continue;
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

  /**
   * A staff's plain shot carries the character's strongest arcane affinity: a lightning child
   * throws lightning, not the duel mage's fireball. With no arcane door open it is a stick, and
   * hits like one.
   */
  private tagWeaponShots(after: number) {
    for (const a of this.state.arrows) {
      if (a.id <= after || a.worldElement) continue;
      const character = this.characters.get(a.owner);
      if (!character || character.weapon !== 'baston') continue;
      const element = primaryElement(character.affinities);
      a.worldElement = element ?? 'fisico';
      if (!element) a.damageScale = (a.damageScale ?? 1) * 0.5;
    }
  }

  /** Only fire bursts. A charged bolt of lightning or ice hits hard, but does not explode. */
  protected override explode(a: Arrow, owner: Player, amount: number, skip?: string) {
    if (a.worldElement && a.worldElement !== 'fuego') return;
    super.explode(a, owner, amount, skip);
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
      if (!character || p.hp <= 0 || this.duelOf(p.id)) {
        this.opening.delete(p.id);
        continue;
      }
      const chest = s.chests
        .filter((c) => c.ready && distance(p, c) <= CHEST_REACH)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      const warned = chest ? `${p.id}|${chest.id}` : '';
      for (const key of this.lootWarned)
        if (key.startsWith(`${p.id}|`) && key !== warned) this.lootWarned.delete(key);
      const current = this.opening.get(p.id);
      if (!chest || (current && current.chestId !== chest.id)) this.opening.delete(p.id);
      if (!chest) continue;
      const rules = CHEST_TIERS[chest.tier];
      if (INVENTORY_SIZE - character.inventory.length < rules.maxDrops) {
        if (!this.lootWarned.has(warned)) {
          this.lootWarned.add(warned);
          this.deny(
            p.id,
            rules.name,
            `Tu bolsa no tiene lugar: hacé espacio para ${rules.maxDrops} objetos.`,
          );
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
        if (entry.chestId === chest.id && (!lead || entry.elapsed > lead.elapsed))
          lead = { id, elapsed: entry.elapsed };
      chest.opener = lead?.id ?? null;
      chest.progress = lead ? Math.min(1, lead.elapsed / CHEST_TIERS[chest.tier].openSeconds) : 0;
    }
  }

  private loot(p: Player, character: Character, chest: ChestView) {
    const rules = CHEST_TIERS[chest.tier];
    const camp = this.definition.spawners[this.chestCamp.get(chest.id)!];
    const drops = rollLoot({
      tier: chest.tier,
      campLevel: camp.level,
      character,
      random: this.random,
    });
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
      color:
        chest.tier === 'legendario' ? '#ffc84d' : chest.tier === 'raro' ? '#56b8ff' : '#c9a36b',
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
    if (character.level < item.level)
      return refuse(`Necesitás nivel ${item.level} para «${item.name}».`);
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
    if (slot === 'weapon')
      return (this.deny(id, 'Arma', 'Las manos no quedan vacías: cambiá el arma por otra.'), false);
    const instance = character.equipment[slot];
    if (!instance) return false;
    if (character.inventory.length >= INVENTORY_SIZE)
      return (
        this.deny(
          id,
          ITEMS[instance.itemId]?.name ?? 'Objeto',
          `Tu bolsa está llena (${INVENTORY_SIZE}/${INVENTORY_SIZE}).`,
        ),
        false
      );
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
    if (!effect)
      return refuse(item?.slot ? 'Eso no se lee: se equipa.' : 'No sabés qué hacer con esto.');
    if (p.hp <= 0) return refuse('Los caídos no leen.');
    const consume = () => {
      character.inventory.splice(index, 1);
      this.bagChanged(id);
    };
    const tell = (title: string, text: string, color = '#9fd8ff') =>
      this.notify(id, { kind: 'item', title, text, color });

    switch (effect.kind) {
      case 'teach': {
        const skill = SKILLS_WORLD[effect.skillId];
        if (!skill) return refuse('Las páginas están en blanco.');
        const known = character.skills[skill.id];
        if (known) {
          if (known.level >= skill.maxLevel)
            return refuse(`«${skillName(skill, known.level)}» ya está en su nivel máximo.`);
          consume();
          this.raiseSkillLevel(id, skill, known);
          return true;
        }
        consume();
        character.skills[skill.id] = { level: 1, uses: 0, nodes: [] };
        const open = schoolOpen(skill, character.affinities, character.trees);
        const free = CAST_SLOTS.find(
          (slot) => slotOpen(slot, character.level) && character.slots[slot] === null,
        );
        if (open && free) character.slots[free] = skill.id;
        tell(
          `Aprendiste «${skill.name}»`,
          open
            ? skill.flavor
            : 'La conocés, pero tu cuerpo todavía no reconoce su flujo. Abrí esa afinidad para usarla.',
          skill.color,
        );
        return true;
      }
      case 'affinity': {
        const state = character.affinities[effect.affinity];
        const name = AFFINITY_NAMES[effect.affinity];
        if (state && state.points >= AFFINITY_POINT_CAP)
          return refuse(`${name} ya llegó a su tope de ${AFFINITY_POINT_CAP} puntos.`);
        consume();
        if (state) state.points++;
        else character.affinities[effect.affinity] = { points: 1, xp: 0, cultivation: 1 };
        tell(
          state ? `${name} se profundiza` : `Se abrió ${name}`,
          state ? `Ahora tenés ${state.points} puntos.` : 'Una puerta que no sabías que existía.',
        );
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
        if (character.copyCharges >= COPY_CHARGE_CAP)
          return refuse(`El ojo no aguanta más de ${COPY_CHARGE_CAP} cargas.`);
        consume();
        character.copyCharges++;
        tell(
          'El ojo se abre otra vez',
          `Cargas del Ojo del Impostor: ${character.copyCharges}.`,
          '#ff6fb0',
        );
        return true;
      }
    }
  }

  // ─── Monster skills ─────────────────────────────────────────────────────────────────────────

  /**
   * Monsters with a kit pick a skill by how far their prey is, stop, show where it will land, and
   * only then let it go. Frozen, they lose the cast. Poison ticks here too, once a second.
   */
  private stepMonsters(dt: number) {
    const s = this.state as WorldSnapshot;
    const alive = new Set(s.zombies.map((z) => z.id));
    for (const [id, cds] of this.mobSkillCd) {
      if (!alive.has(id)) {
        this.mobSkillCd.delete(id);
        continue;
      }
      for (const key of Object.keys(cds)) cds[key] = Math.max(0, cds[key] - dt);
    }
    for (const [id, buff] of this.mobBuffs)
      if ((buff.left -= dt) <= 0 || !alive.has(id)) this.mobBuffs.delete(id);
    for (const id of this.mobCasting.keys()) if (!alive.has(id)) this.mobCasting.delete(id);

    for (const z of s.zombies) {
      const family = z.family ? MOB_FAMILIES[z.family] : undefined;
      if (!family?.kit.length || z.hp <= 0) {
        z.skill = undefined;
        continue;
      }
      const casting = this.mobCasting.get(z.id);
      if (casting) {
        if (z.frozenLeft > 0) {
          this.mobCasting.delete(z.id);
          z.skill = undefined;
          continue;
        }
        // Rooted while it winds up: whatever the walking brain decided this tick is undone.
        z.x = casting.at.x;
        z.y = casting.at.y;
        z.attackCd = Math.max(z.attackCd, 0.2);
        casting.left -= dt;
        const where =
          casting.skill.kind === 'nova' && casting.skill.at === 'self' ? casting.at : casting.aim;
        z.skill = {
          name: casting.skill.name,
          kind: casting.skill.kind,
          left: Math.max(0, casting.left),
          total: casting.skill.windup,
          x: where.x,
          y: where.y,
          radius: casting.skill.radius ?? 0,
          color: casting.skill.color,
        };
        if (casting.left <= 0) {
          this.mobCasting.delete(z.id);
          z.skill = undefined;
          this.resolveMonsterSkill(z, casting.skill, casting.aim);
        }
        continue;
      }
      if (z.frozenLeft > 0 || !z.target) continue;
      const prey: (Vec & { hp: number }) | undefined =
        s.players.find((p) => p.id === z.target) ?? s.zombies.find((q) => q.id === z.target);
      if (!prey || prey.hp <= 0) continue;
      const cds = this.mobSkillCd.get(z.id) ?? {};
      this.mobSkillCd.set(z.id, cds);
      const gap = distance(z, prey);
      const skill = family.kit.find((k) => {
        if ((cds[k.id] ?? 0) > 0 || gap < k.min || gap > k.max) return false;
        if (k.kind === 'bolt' && !lineClear(z, prey, this.terrain)) return false;
        if (k.kind === 'heal')
          return s.zombies.some(
            (q) =>
              q.faction === 'monster' &&
              q.hp > 0 &&
              q.hp < q.maxHp * 0.7 &&
              distance(z, q) <= (k.radius ?? 0),
          );
        if (k.kind === 'summon') return this.summonsOf(z).length < (k.summon?.max ?? 0);
        return true;
      });
      if (!skill) continue;
      cds[skill.id] = skill.cooldown;
      this.mobCasting.set(z.id, {
        skill,
        left: skill.windup,
        aim: { x: prey.x, y: prey.y },
        at: { x: z.x, y: z.y },
      });
      z.angle = Math.atan2(prey.y - z.y, prey.x - z.x);
      // The warning goes out the same tick the wind-up starts: the whole windup is time to react.
      const where = skill.kind === 'nova' && skill.at === 'self' ? z : prey;
      z.skill = {
        name: skill.name,
        kind: skill.kind,
        left: skill.windup,
        total: skill.windup,
        x: where.x,
        y: where.y,
        radius: skill.radius ?? 0,
        color: skill.color,
      };
      this.event('cast', z, z.team, z.angle, undefined, 0);
    }

    for (const [id, poison] of this.poisons) {
      const p = s.players.find((q) => q.id === id);
      if (!p || p.hp <= 0) {
        this.poisons.delete(id);
        continue;
      }
      poison.left -= dt;
      poison.tick -= dt;
      if (poison.tick <= 0) {
        poison.tick += 1;
        const source = s.zombies.find((z) => z.id === poison.source) ?? {
          team: 'red' as Team,
          faction: 'monster' as const,
          id: poison.source,
        };
        this.damage(p, source, 0, poison.dps, { ignoreInvuln: true, pierce: true });
      }
      if (poison.left <= 0) this.poisons.delete(id);
    }
  }

  private summonsOf(z: Zombie) {
    return this.state.zombies.filter(
      (q) => q.owner === `wild:${this.zoneId}:summon:${z.id}` && q.hp > 0,
    );
  }

  /** A blow from a monster's skill, with whatever it carries: a web that holds, a poison that stays. */
  private monsterHit(
    p: Player,
    source: Allegiant & Partial<Zombie>,
    angle: number,
    amount: number,
    skill: Pick<MobSkill, 'freeze' | 'poison'>,
  ) {
    const landed = this.damage(p, source as Pick<Player, 'team'>, angle, amount);
    if (!landed || p.hp <= 0) return landed;
    if (skill.freeze) {
      this.freeze(p);
      p.stunLeft = Math.max(p.stunLeft, skill.freeze);
      p.frozenLeft = Math.max(p.frozenLeft, skill.freeze);
    }
    if (skill.poison) {
      const fresh = !this.poisons.has(p.id);
      this.poisons.set(p.id, {
        left: skill.poison.seconds,
        dps: skill.poison.dps * amount,
        tick: 1,
        source: String(source.id),
      });
      if (fresh && this.characters.has(p.id))
        this.notify(p.id, {
          kind: 'denied',
          title: 'Envenenado',
          text: `Perdés vida durante ${skill.poison.seconds} s.`,
          color: '#b6e05a',
        });
    }
    return landed;
  }

  private resolveMonsterSkill(z: Zombie, skill: MobSkill, aim: Vec) {
    const s = this.state as WorldSnapshot;
    const stats = mobStats(z.family!, z.level);
    const amount =
      stats.damage * (skill.damage ?? 1) * (1 + (this.mobBuffs.get(z.id)?.damage ?? 0));
    const angle = Math.atan2(aim.y - z.y, aim.x - z.x);
    switch (skill.kind) {
      case 'bolt': {
        const speed = skill.speed ?? 320;
        s.mobShots.push({
          id: ++this.mobShotId,
          owner: z.id,
          x: z.x,
          y: z.y,
          angle,
          speed,
          damage: amount,
          life: (skill.max + 80) / speed,
          radius: 7,
          color: skill.color,
          ...(skill.freeze ? { freeze: skill.freeze } : {}),
          ...(skill.poison ? { poison: skill.poison } : {}),
        });
        this.event('shot', z, z.team, angle);
        return;
      }
      case 'nova': {
        const centre = skill.at === 'target' ? aim : { x: z.x, y: z.y };
        const radius = skill.radius ?? 80;
        for (const p of s.players)
          if (p.hp > 0 && this.hostile(z, p) && distance(p, centre) <= radius + RULES.radius)
            this.monsterHit(p, z, Math.atan2(p.y - centre.y, p.x - centre.x), amount, skill);
        for (const q of s.zombies)
          if (
            q !== z &&
            q.hp > 0 &&
            this.hostile(z, q) &&
            distance(q, centre) <= radius + RULES.zombieRadius
          )
            this.damageZombie(q, z.team, amount, Math.atan2(q.y - centre.y, q.x - centre.x), z.id);
        this.event('explosion', centre, z.team, angle, undefined, 1);
        this.state.events.at(-1)!.color = skill.color;
        return;
      }
      case 'charge': {
        const reach = Math.min(320, distance(z, aim) + 40);
        const struck = new Set<string>();
        for (let run = 0; run < reach; run += 10) {
          const before = { x: z.x, y: z.y };
          translate(z, Math.cos(angle) * 10, Math.sin(angle) * 10, this.terrain);
          for (const p of s.players)
            if (
              !struck.has(p.id) &&
              p.hp > 0 &&
              this.hostile(z, p) &&
              distance(p, z) <= RULES.radius + stats.radius + 4
            ) {
              struck.add(p.id);
              this.monsterHit(p, z, angle, amount, skill);
            }
          if (Math.hypot(z.x - before.x, z.y - before.y) < 1) break;
        }
        this.event('dash', z, z.team, angle, undefined, 1);
        return;
      }
      case 'howl': {
        for (const q of s.zombies)
          if (
            q.faction === 'monster' &&
            q.hp > 0 &&
            q.owner === z.owner &&
            distance(q, z) <= (skill.radius ?? 200) &&
            skill.buff
          )
            this.mobBuffs.set(q.id, { left: skill.buff.seconds, damage: skill.buff.damage });
        this.event('fury', z, z.team, angle);
        return;
      }
      case 'heal': {
        for (const q of s.zombies)
          if (q.faction === 'monster' && q.hp > 0 && distance(q, z) <= (skill.radius ?? 200)) {
            q.hp = Math.min(q.maxHp, q.hp + q.maxHp * (skill.heal ?? 0.2));
            this.event('heal', q, q.team);
          }
        return;
      }
      case 'summon': {
        const summon = skill.summon!;
        const room = summon.max - this.summonsOf(z).length;
        for (let i = 0; i < Math.min(summon.count, room); i++) {
          const level = Math.max(1, z.level - 1);
          const minion = mobStats(summon.familyId, level);
          const spot = {
            x: z.x + Math.cos(angle + (i - 0.5) * 1.6) * 40,
            y: z.y + Math.sin(angle + (i - 0.5) * 1.6) * 40,
          };
          const risen = this.newZombie(
            { id: `wild:${this.zoneId}:summon:${z.id}`, team: 'red', angle },
            spot,
            z,
            {
              family: summon.familyId,
              faction: 'monster',
              level,
              hp: minion.hp,
              maxHp: minion.hp,
              life: summon.seconds,
              name: MOB_FAMILIES[summon.familyId].name,
            },
          );
          s.zombies.push(risen);
          this.event('raise', risen, z.team);
        }
        return;
      }
    }
  }

  /** Stones, webs and spit in flight. A raised parry swats them back into their thrower. */
  private stepMobShots(dt: number) {
    const s = this.state as WorldSnapshot;
    s.mobShots = s.mobShots.filter((shot) => {
      shot.life -= dt;
      if (shot.life <= 0) return false;
      const thrower = s.zombies.find((z) => z.id === shot.owner);
      const source: Allegiant & Partial<Zombie> = thrower ?? {
        team: 'red',
        faction: 'monster',
        id: shot.owner,
      };
      const steps = Math.max(1, Math.ceil((shot.speed * dt) / 6));
      for (let i = 0; i < steps; i++) {
        shot.x += (Math.cos(shot.angle) * shot.speed * dt) / steps;
        shot.y += (Math.sin(shot.angle) * shot.speed * dt) / steps;
        if (blocked(shot.x, shot.y, 2, this.terrain)) return false;
        const p = s.players.find(
          (q) =>
            q.hp > 0 && this.hostile(source, q) && distance(q, shot) < RULES.radius + shot.radius,
        );
        if (p) {
          if (p.counterLeft > 0 && thrower && thrower.hp > 0) {
            this.damageZombie(thrower, p.team, shot.damage, shot.angle + Math.PI, p.id);
            this.event('counter', p, p.team, shot.angle + Math.PI, p.classId, 0);
          } else this.monsterHit(p, source, shot.angle, shot.damage, shot);
          return false;
        }
        const q = s.zombies.find(
          (z) =>
            z.hp > 0 &&
            this.hostile(source, z) &&
            distance(z, shot) < RULES.zombieRadius + shot.radius,
        );
        if (q) {
          this.damageZombie(q, 'red', shot.damage, shot.angle, shot.owner);
          return false;
        }
      }
      return true;
    });
  }

  /** Mana ticks back for anyone who has a pool at all. */
  private stepMana(dt: number) {
    for (const p of this.state.players) {
      const character = this.characters.get(p.id);
      if (!character || p.hp <= 0) continue;
      const max = this.maxManaOf(character);
      const clarity = 1 + affinityBonus(character.affinities).manaRegen;
      p.mana = Math.min(
        max,
        (p.mana ?? max) + manaRegenFor(statsWithEquipment(character)) * clarity * dt,
      );
      p.maxMana = max;
    }
  }
}

/** Points still to place, for the client's level-up panel. */
export const unspentPoints = (character: Character) => character.unspent;
export { POINTS_PER_LEVEL, CLASSES };
