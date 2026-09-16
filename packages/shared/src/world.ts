import {
  CLASSES,
  DEFAULT_MAP,
  Duel,
  RULES,
  distance,
  newPlayer,
  translate,
  type ClassId,
  type Team,
  type Zombie,
  type Input,
  type MapDefinition,
  type Player,
  type Rect,
  type Snapshot,
  type Terrain,
  type Vec,
  defaultCustomization,
} from './index.js';
import { DEFAULT_ZONE, ZONES, zone, type Spawner, type ZoneDefinition, type ZoneId } from './rpg/zones.js';

/** Seconds a player cannot use a portal again, so two facing portals never bounce anyone. */
const PORTAL_COOLDOWN = 1.5;
/** How far a refused player is pushed back towards the middle of the zone. */
const PORTAL_PUSH = 90;

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
import { mobStats, xpFor } from './rpg/mobs.js';
import {
  BASE_STATS,
  POINTS_PER_LEVEL,
  applyXp,
  maxHpFor,
  maxManaFor,
  manaRegenFor,
  type StatId,
  type Stats,
} from './rpg/progression.js';

/**
 * The persistent world.
 *
 * It extends `Duel` on purpose: combat resolution — projectiles, guards, counters, knockback,
 * the undead brain — is a thousand lines the duel already gets right and the tests already pin.
 * The world composes its own `step()` out of the protected pieces instead of copying them, and
 * simply never runs the flag, score and match-clock tail, which is what makes that machinery
 * inert here without a single `if (mode === 'world')` in the shared code.
 */

/** What is saved between sessions. The simulation only ever reads a handful of these. */
export interface Character {
  id: string;
  accountId: string;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  unspent: number;
  stats: Stats;
  /** Where the character stood when it last left, and where it revives. */
  zoneId: ZoneId;
  x: number;
  y: number;
}

export function newCharacter(id: string, accountId: string, name: string, classId: ClassId): Character {
  const entry = zone(DEFAULT_ZONE).entry;
  return {
    id,
    accountId,
    name,
    classId,
    level: 1,
    xp: 0,
    unspent: 0,
    stats: { ...BASE_STATS },
    zoneId: DEFAULT_ZONE,
    x: entry.x,
    y: entry.y,
  };
}

export interface WorldSnapshot extends Snapshot {
  /** The zone this view belongs to. `mapId` stays a valid arena id so the shared types hold. */
  zoneId: ZoneId;
}

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

  /**
   * Copies the saved sheet onto the live entity and sizes its pools. It runs on join, on every
   * level up, on every spent point and after `revive`, so the entity is never a tick behind the
   * character — a client must not receive a first snapshot with an empty mana bar.
   */
  private applyCharacter(p: Player, character: Character) {
    p.level = character.level;
    p.maxHp = maxHpFor(character.stats);
    p.hp = Math.min(p.hp > 0 ? p.hp : p.maxHp, p.maxHp);
    p.maxMana = maxManaFor(character.stats);
    p.mana = Math.min(p.mana > 0 ? p.mana : p.maxMana, p.maxMana);
  }

  /** Places one of the points a level up granted, and resizes whatever pool it feeds. */
  spendPoint(id: string, stat: StatId): boolean {
    const character = this.characters.get(id);
    if (!character || character.unspent <= 0) return false;
    character.unspent--;
    character.stats[stat]++;
    const p = this.state.players.find((player) => player.id === id);
    if (p) this.applyCharacter(p, character);
    return true;
  }

  /** Joining is nothing like `Duel.add`: no team, no cap, no lobby. */
  join(character: Character): Player {
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
  }

  /** Experience for a kill, applied to the sheet and reported so the client can announce it. */
  grantXp(id: string, amount: number): { level: number; gained: number } | null {
    const character = this.characters.get(id);
    if (!character || amount <= 0) return null;
    const result = applyXp(character.level, character.xp, amount);
    character.level = result.level;
    character.xp = result.xp;
    character.unspent += result.unspent;
    if (result.gained > 0) {
      const p = this.state.players.find((player) => player.id === id);
      if (p) this.applyCharacter(p, character);
    }
    return result.gained > 0 ? { level: result.level, gained: result.gained } : null;
  }

  /**
   * The world's own loop. Same order as the duel — defenses and movement first, impacts after —
   * reusing the inherited pieces, and without the flag, capture and match-clock tail.
   */
  override step(inputs: Map<string, Input>, dt = RULES.tick as number) {
    const s = this.state;
    s.tick++;
    if (s.paused) return;
    const placements = this.stepPlayers(inputs, dt);
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
        z.hp = Math.min(stats.hp, z.hp + stats.hp * 0.25 * dt);
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
    });
    this.state.zombies.push(z);
  }

  /**
   * Experience for a kill.
   *
   * `damageZombie` is told the attacking side, never who struck, so for now the credit goes to
   * the closest player of that side. It is a slice-one simplification, and the place to fix it is
   * the day damage carries its author.
   */
  override damageZombie(z: Zombie, team: Team, amount = 1, angle?: number) {
    const alive = z.hp > 0;
    super.damageZombie(z, team, amount, angle);
    if (!alive || z.hp > 0 || !z.family) return;
    const killer = this.state.players
      .filter((p) => p.team === team && p.hp > 0 && this.characters.has(p.id))
      .sort((a, b) => distance(a, z) - distance(b, z))[0];
    if (!killer) return;
    const character = this.characters.get(killer.id)!;
    const won = xpFor(z.family, z.level, character.level);
    const subida = this.grantXp(killer.id, won);
    this.event('levelup', z, team, undefined, killer.classId, subida ? subida.level : 0);
  }

  /** Mana ticks back for anyone who has a pool at all. */
  private stepMana(dt: number) {
    for (const p of this.state.players) {
      const character = this.characters.get(p.id);
      if (!character || p.hp <= 0) continue;
      const max = maxManaFor(character.stats);
      p.mana = Math.min(max, (p.mana ?? max) + manaRegenFor(character.stats) * dt);
      p.maxMana = max;
    }
  }
}

/** Points still to place, for the client's level-up panel. */
export const unspentPoints = (character: Character) => character.unspent;
export { POINTS_PER_LEVEL, CLASSES };
