import {
  CLASSES,
  DEFAULT_MAP,
  Duel,
  RULES,
  distance,
  newPlayer,
  projectileStats,
  translate,
  defaultCustomization,
  type Arrow,
  type ClassId,
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
import { POINTS_PER_LEVEL, applyXp, maxHpFor, maxManaFor, manaRegenFor, type StatId } from './rpg/progression.js';
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
  type WorldSkill,
} from './rpg/skills.js';
import {
  CAST_SLOTS,
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
  kind: 'callout' | 'skill' | 'evolution' | 'rank' | 'denied' | 'steal' | 'level' | 'learn' | 'widen';
  title: string;
  text: string;
  color?: string;
  skillId?: string;
  rarity?: string;
  incantation?: string;
  slot?: CastSlot;
  cooldown?: number;
  mana?: number;
}

export interface WorldSnapshot extends Snapshot {
  /** The zone this view belongs to. `mapId` stays a valid arena id so the shared types hold. */
  zoneId: ZoneId;
}

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

  private maxManaOf(character: Character) {
    return maxManaFor(character.stats) + character.bonusMana;
  }

  /**
   * Copies the saved sheet onto the live entity and sizes its pools. It runs on join, on every
   * level up, on every spent point and after `revive`, so the entity is never a tick behind the
   * character — a client must not receive a first snapshot with an empty mana bar.
   */
  private applyCharacter(p: Player, character: Character) {
    const passive = this.passivesOf(character);
    p.level = character.level;
    p.maxHp = Math.round(maxHpFor(character.stats) * (1 + passive.maxHp) * 10) / 10;
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
    // Remember where they stood, so re-logging in puts them back there.
    if (p && character) {
      character.x = p.x;
      character.y = p.y;
      character.zoneId = this.zoneId;
    }
    s.players = s.players.filter((player) => player.id !== id);
    s.zombies = s.zombies.filter((z) => z.owner !== id);
    this.characters.delete(id);
    this.incantations.delete(id);
    this.parries.delete(id);
    this.buffs.delete(id);
    this.drains.delete(id);
  }

  /** Experience for a kill, applied to the sheet and reported so the client can announce it. */
  grantXp(id: string, amount: number): { level: number; gained: number } | null {
    const character = this.characters.get(id);
    if (!character || amount <= 0) return null;
    this.sheetChanged.add(id);
    const bonus = 1 + this.passivesOf(character).xp;
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
    return 1 + buff + this.passivesOf(character).damage + touki;
  }

  private nearestCharacter(team: Team, at: Vec, reach = 520) {
    return this.state.players
      .filter((p) => p.team === team && p.hp > 0 && this.characters.has(p.id) && distance(p, at) <= reach)
      .sort((a, b) => distance(a, at) - distance(b, at))[0];
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
      const passive = this.passivesOf(character);
      if (passive.regen > 0) p.hp = Math.min(p.maxHp, p.hp + passive.regen * dt);
      // Speed rides on the upgrade state `movePlayer` already reads, so prediction stays honest.
      p.pve.speed = (this.buffs.get(p.id)?.speed ?? 0) + passive.speed;
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
          if (z.team === p.team || z.hp <= 0 || distance(p, z) > effect.radius) continue;
          this.damageZombie(z, p.team, effect.damage * staff, Math.atan2(z.y - p.y, z.x - p.x));
          if (effect.freeze && z.hp > 0) {
            z.frozenLeft = Math.max(z.frozenLeft, effect.freeze);
            this.event('freeze', z, z.team);
          }
        }
        this.event('explosion', p, p.team, angle, p.classId, 1);
        return;
      }
      case 'heal': {
        for (const q of s.players) {
          if (q.team !== p.team || q.hp <= 0 || distance(p, q) > effect.radius) continue;
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
    }
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
    if (progress.level < skill.maxLevel && progress.uses >= usesToLevel(skill, progress.level)) {
      const previous = skillName(skill, progress.level);
      progress.uses = 0;
      progress.level++;
      const evolution = skill.evolutions.find((e) => e.level === progress.level);
      if (evolution)
        this.notify(p.id, {
          kind: 'evolution',
          title: `«${previous}» evolucionó en «${evolution.name}»`,
          text: evolution.line,
          color: skill.color,
          rarity: skill.rarity,
          skillId: skill.id,
        });
      else
        this.notify(p.id, {
          kind: 'skill',
          title: `${skillName(skill, progress.level)} → Nv ${progress.level}`,
          text: 'Algo en tu cuerpo aprendió sin avisarte.',
          color: skill.color,
          skillId: skill.id,
        });
    }
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
    const striker = source as Partial<Zombie>;
    const parry = this.parries.get(target.id);
    if (parry && striker.family && (striker.hp ?? 0) > 0 && target.hp > 0) {
      this.damageZombie(striker as Zombie, target.team, amount * parry.reflect, angle + Math.PI);
      this.event('counter', target, target.team, angle + Math.PI, target.classId, parry.reflect >= 2 ? 1 : 0);
      return false;
    }
    const caster = (source as Partial<Player>).id;
    const scaled = caster && this.characters.has(caster) ? amount * this.damageMultiplier(caster) : amount;
    const landed = super.damage(target, source, angle, scaled, options);
    if (landed && caster) this.heal(caster, scaled);
    if (landed && target.hp <= 0 && striker.family) this.evolveMonster(striker as Zombie);
    return landed;
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
   * Experience for a kill.
   *
   * `damageZombie` is told the attacking side, never who struck, so the credit — and any buff or
   * drain — goes to the closest character of that side. A slice-one simplification, to be fixed
   * the day damage carries its author.
   */
  override damageZombie(z: Zombie, team: Team, amount = 1, angle?: number) {
    const alive = z.hp > 0;
    const nearest = this.nearestCharacter(team, z);
    const scaled = nearest ? amount * this.damageMultiplier(nearest.id) : amount;
    super.damageZombie(z, team, scaled, angle);
    if (nearest && alive) this.heal(nearest.id, scaled);
    if (!alive || z.hp > 0 || !z.family) return;
    this.corpses.push({ x: z.x, y: z.y, left: CORPSE_LIFE });
    const killer = nearest ?? this.nearestCharacter(team, z, Infinity);
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

  /** Mana ticks back for anyone who has a pool at all. */
  private stepMana(dt: number) {
    for (const p of this.state.players) {
      const character = this.characters.get(p.id);
      if (!character || p.hp <= 0) continue;
      const max = this.maxManaOf(character);
      p.mana = Math.min(max, (p.mana ?? max) + manaRegenFor(character.stats) * dt);
      p.maxMana = max;
    }
  }
}

/** Points still to place, for the client's level-up panel. */
export const unspentPoints = (character: Character) => character.unspent;
export { POINTS_PER_LEVEL, CLASSES };
