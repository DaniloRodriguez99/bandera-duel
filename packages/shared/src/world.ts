import {
  CLASSES,
  DEFAULT_MAP,
  Duel,
  RULES,
  newPlayer,
  type ClassId,
  type Input,
  type MapDefinition,
  type Player,
  type Rect,
  type Snapshot,
  type Terrain,
  type Vec,
  defaultCustomization,
} from './index.js';
import { DEFAULT_ZONE, zone, type ZoneDefinition, type ZoneId } from './rpg/zones.js';
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
    if (character) this.applyCharacter(p, character);
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
    this.stepMana(dt);
    this.syncParticipants();
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
