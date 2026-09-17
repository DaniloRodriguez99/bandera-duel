import { Client, Room, ServerError } from '@colyseus/core';
import { RULES, sanitizeInput, validClass, validName, type Input, type Player, type Zombie } from '@bandera/shared';
import {
  CAST_SLOTS,
  World,
  newCharacter,
  validCreation,
  type CastSlot,
  type Character,
  type WorldSnapshot,
} from '@bandera/shared/world';
import { rollDestiny } from '@bandera/shared/rpg/skills';
import { DEFAULT_ZONE, ZONES, type ZoneId } from '@bandera/shared/rpg/zones';
import { StoreError, type AccountId, type CharacterStore } from './store/characters.js';
import { storeFromEnv } from './store/env.js';

/**
 * The persistent world room.
 *
 * Its lifecycle is the opposite of `DuelRoom`: there is no lobby, no countdown and no winner,
 * people walk in mid-session, and the room stays alive when the last one leaves so the world is
 * still there tomorrow. `DuelRoom` is not touched at all; this is registered beside it.
 *
 * Every zone is its own `World`, created the first time somebody sets foot in it. Crossing a
 * portal moves the character from one to the other; the worlds never share entities.
 */

/** How much more than a screen a client is told about, and where it stops being told. */
const VIEW_WIDTH = RULES.width;
const VIEW_HEIGHT = RULES.height;
const ENTER_SCALE = 1.3;
const LEAVE_SCALE = 1.7;
/** Everyone online is saved on this beat; travel, leaving and disposal save at once. */
const SAVE_EVERY_SECONDS = 15;


/**
 * The store outlives the room on purpose. It is the only thing meant to survive the process, so
 * it cannot be a room field: a disposed room, or a second one, would take every account and every
 * character with it. The driver comes from the environment (memory when nothing is set, as in the
 * tests); swapping in a Postgres driver is the whole job of going to production.
 */
let store: CharacterStore = storeFromEnv();
export const useCharacterStore = (next: CharacterStore) => (store = next);
export const characterStore = () => store;

const logSaveError = (characterId: string, error: unknown) =>
  console.error(
    JSON.stringify({ event: 'save-failed', characterId, error: String((error as Error)?.message ?? error) }),
  );

interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const grow = (centre: { x: number; y: number }, scale: number): Rect => ({
  minX: centre.x - (VIEW_WIDTH * scale) / 2,
  maxX: centre.x + (VIEW_WIDTH * scale) / 2,
  minY: centre.y - (VIEW_HEIGHT * scale) / 2,
  maxY: centre.y + (VIEW_HEIGHT * scale) / 2,
});

const inside = (rect: Rect, p: { x: number; y: number }) =>
  p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;

export class WorldRoom extends Room {
  /** No cap: the world is an open room, not a match. */
  maxClients = 200;
  maxMessagesPerSecond = 65;
  /** One World per zone that has been visited. */
  private worlds = new Map<ZoneId, World>();
  /** The zone each online character is standing in. */
  private zoneOf = new Map<string, ZoneId>();
  private accounts = new Map<string, AccountId>();
  private characterOf = new Map<string, string>();
  private queues = new Map<string, Input[]>();
  private seen = new Map<string, number>();
  /** Ids a client already knows about, so entities are not resent as new on every tick. */
  private known = new Map<string, Set<string>>();
  private saveClock = 0;
  /**
   * A character standing still this long is disconnected (and saved), so an idle tab cannot keep
   * the server — and its bill — running. Choosing or creating a character gets more time.
   */
  static idleSeconds = Number(process.env.WORLD_IDLE_SECONDS) || 60;
  static choosingIdleSeconds = 300;
  /** Last time each connection did something: walked, struck, cast, learned. */
  private lastActive = new Map<string, number>();
  private touch = (client: Client) => this.lastActive.set(client.sessionId, Date.now());

  /** Every world room alive in this process, so shutdown can save them all before exiting. */
  private static live = new Set<WorldRoom>();
  static async flushAll() {
    await Promise.all([...WorldRoom.live].map((room) => room.flush()));
  }

  private worldFor(zoneId: ZoneId): World {
    const id = ZONES[zoneId] ? zoneId : DEFAULT_ZONE;
    let world = this.worlds.get(id);
    if (!world) {
      world = new World(id);
      this.worlds.set(id, world);
    }
    return world;
  }

  private worldOf(characterId: string): World | undefined {
    const zoneId = this.zoneOf.get(characterId);
    return zoneId ? this.worlds.get(zoneId) : undefined;
  }

  private clientOf(characterId: string): Client | undefined {
    return this.clients.find((c) => this.characterOf.get(c.sessionId) === characterId);
  }

  onCreate() {
    this.autoDispose = false;
    WorldRoom.live.add(this);

    this.onMessage('input', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      if (!id) return;
      const input = sanitizeInput(message);
      if (!input) return;
      // Only doing something counts; a mouse resting on the canvas still sends aim every tick.
      if (input.x !== 0 || input.y !== 0 || input.sword || input.shot || input.charge) this.touch(client);
      const last = this.seen.get(id) ?? -1;
      if (input.seq <= last) return;
      this.seen.set(id, input.seq);
      const queue = this.queues.get(id) ?? [];
      // Same discipline as the duel: a short queue, so a flood cannot buy extra turns.
      if (queue.length < 6) queue.push(input);
      this.queues.set(id, queue);
    });

    this.onMessage('spendPoint', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      this.touch(client);
      const stat = (message as { stat?: unknown })?.stat;
      if (!id || typeof stat !== 'string') return;
      if (this.worldOf(id)?.spendPoint(id, stat as never)) this.sendSheet(client, id);
    });

    // A key pressed for a skill slot, aimed at a point of the world.
    this.onMessage('cast', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      this.touch(client);
      const m = message as { slot?: unknown; aimX?: unknown; aimY?: unknown } | null;
      if (!id || !m || !CAST_SLOTS.includes(m.slot as CastSlot)) return;
      const x = Number(m.aimX);
      const y = Number(m.aimY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      this.worldOf(id)?.cast(id, m.slot as CastSlot, { x, y });
    });

    this.onMessage('learn', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      this.touch(client);
      const m = message as { skillId?: unknown; nodeId?: unknown } | null;
      if (!id || typeof m?.skillId !== 'string' || typeof m.nodeId !== 'string') return;
      this.worldOf(id)?.learn(id, m.skillId, m.nodeId);
    });

    this.onMessage('slot', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      this.touch(client);
      const m = message as { slot?: unknown; skillId?: unknown } | null;
      if (!id || !CAST_SLOTS.includes(m?.slot as CastSlot)) return;
      const skillId = typeof m!.skillId === 'string' ? m!.skillId : null;
      this.worldOf(id)?.setSlot(id, m!.slot as CastSlot, skillId);
    });

    // The bag. The World validates everything; here only the shape of the message.
    const uidOf = (message: unknown) => {
      const uid = (message as { uid?: unknown } | null)?.uid;
      return typeof uid === 'string' && /^i\d{1,9}$/.test(uid) ? uid : null;
    };
    this.onMessage('equip', (client, message: unknown) => {
      this.touch(client);
      const id = this.characterOf.get(client.sessionId);
      const uid = uidOf(message);
      if (id && uid) this.worldOf(id)?.equip(id, uid);
    });
    this.onMessage('unequip', (client, message: unknown) => {
      this.touch(client);
      const id = this.characterOf.get(client.sessionId);
      const slot = (message as { slot?: unknown } | null)?.slot;
      if (id && (slot === 'weapon' || slot === 'armor' || slot === 'amulet')) this.worldOf(id)?.unequip(id, slot);
    });
    this.onMessage('useItem', (client, message: unknown) => {
      this.touch(client);
      const id = this.characterOf.get(client.sessionId);
      const uid = uidOf(message);
      const skillId = (message as { skillId?: unknown } | null)?.skillId;
      if (!id || !uid || (skillId !== undefined && (typeof skillId !== 'string' || skillId.length > 40))) return;
      this.worldOf(id)?.useItem(id, uid, skillId as string | undefined);
    });
    this.onMessage('discard', (client, message: unknown) => {
      this.touch(client);
      const id = this.characterOf.get(client.sessionId);
      const uid = uidOf(message);
      if (id && uid) this.worldOf(id)?.discard(id, uid);
    });

    // Colyseus closes the connection (code 4002) on any message type the room did not register.
    // The client pings every two seconds, and the shared bind() can send duel messages too, so
    // the world answers pings and quietly ignores anything else it does not know.
    this.onMessage('ping', (client, stamp: unknown) => client.send('pong', stamp));
    this.onMessage('*', () => {});

    this.onMessage('sync', (client) => {
      const id = this.characterOf.get(client.sessionId);
      this.known.delete(client.sessionId);
      this.sendSnapshot(client);
      if (id) this.sendSheet(client, id);
    });

    this.setFixedTimestep(() => {
      for (const world of this.worlds.values()) {
        const inputs = new Map<string, Input>();
        for (const p of world.state.players) {
          const next = this.queues.get(p.id)?.shift();
          if (next) inputs.set(p.id, next);
        }
        world.step(inputs);
        this.drainBorders(world);
      }
      const tick = this.tickCount();
      if (tick % 2 === 0) for (const client of this.clients) this.sendSnapshot(client);
      if (tick % 30 === 0) this.dropIdle();
      this.saveClock += RULES.tick;
      if (this.saveClock >= SAVE_EVERY_SECONDS) {
        this.saveClock = 0;
        // Already logged per character inside; the next beat tries again.
        void this.flush().catch(() => {});
      }
    }, 30);
    // Same reason as the duel room: disabling patches before the timer exists loses the clock.
    this.patchRate = null;
  }

  /** Says why, then disconnects; `onLeave` saves the character as for any other departure. */
  private dropIdle() {
    const now = Date.now();
    for (const client of this.clients) {
      const playing = this.characterOf.has(client.sessionId);
      const seconds = playing ? WorldRoom.idleSeconds : Math.max(WorldRoom.idleSeconds, WorldRoom.choosingIdleSeconds);
      const limit = seconds * 1000;
      if (now - (this.lastActive.get(client.sessionId) ?? now) < limit) continue;
      this.lastActive.delete(client.sessionId);
      client.send('idle', { seconds });
      client.leave(4000);
    }
  }

  private ticks = 0;
  private tickCount() {
    return this.ticks++;
  }

  /** Carries out the trips a zone asked for, and tells the refused why they were turned back. */
  private drainBorders(world: World) {
    for (const refusal of world.refusals.splice(0)) {
      this.clientOf(refusal.id)?.send('refused', {
        to: refusal.to,
        name: ZONES[refusal.to]?.name ?? null,
        minLevel: refusal.minLevel,
        open: refusal.open,
      });
    }
    // What the System has to tell each character goes to that character alone.
    for (const notice of world.notices.splice(0)) this.clientOf(notice.id)?.send('system', notice);
    // Experience, levels and spent points change the private sheet; without this the client kept
    // showing its old level until it happened to resync.
    for (const id of world.sheetChanged) {
      const client = this.clientOf(id);
      if (client) this.sendSheet(client, id);
    }
    world.sheetChanged.clear();
    // Loot and gear are saved the moment they change, not on the next 15 s beat: a crash in between
    // must not take a legendary drop with it.
    for (const id of world.saveNow) {
      const character = world.characters.get(id);
      if (character) void store.save(character).catch((error) => logSaveError(id, error));
    }
    world.saveNow.clear();
    for (const trip of world.travels.splice(0)) void this.travel(trip.id, trip.to, trip.arrive);
  }

  /**
   * Moves a character between zones. Asynchronous from day one: today it is a move between two
   * maps in the same process, and this is exactly the seam that becomes a hand-off between
   * instances the day one process stops holding the whole world.
   */
  async travel(characterId: string, to: ZoneId, arrive: { x: number; y: number }) {
    const from = this.worldOf(characterId);
    const character = from?.characters.get(characterId);
    if (!from || !character || !ZONES[to]) return;
    from.leave(characterId);
    character.zoneId = to;
    character.x = arrive.x;
    character.y = arrive.y;
    this.worldFor(to).join(character);
    this.zoneOf.set(characterId, to);
    this.queues.set(characterId, []);
    const client = this.clientOf(characterId);
    if (client) {
      this.known.delete(client.sessionId);
      client.send('entered', { characterId, zoneId: to });
      this.sendSheet(client, characterId);
      this.sendSnapshot(client);
    }
    // Called with `void` from the tick: a failed save must be logged here, not become an
    // unhandled rejection that takes the whole process down.
    await store.save(character).catch((error) => logSaveError(characterId, error));
  }

  /**
   * Authentication happens before the join, so a wrong password never reaches the world. The
   * client asks either to create an account or to come back to one.
   */
  async onAuth(_client: Client, options: Record<string, unknown>) {
    const name = validName(options.account);
    const password = typeof options.password === 'string' ? options.password : '';
    if (!name) throw new ServerError(400, 'Nombre inválido');
    if (password.length < 6) throw new ServerError(400, 'La clave necesita 6 caracteres');
    try {
      const account =
        options.create === true
          ? await store.createAccount(name, password)
          : await store.verify(name, password);
      if (!account) throw new ServerError(401, 'Nombre o clave incorrectos');
      return { account };
    } catch (error) {
      if (error instanceof StoreError) throw new ServerError(409, error.message);
      throw error;
    }
  }

  async onJoin(client: Client, options: Record<string, unknown>, auth: { account: AccountId }) {
    this.accounts.set(client.sessionId, auth.account);
    this.touch(client);
    const saved = await store.listCharacters(auth.account);
    // Coming back with no character named means the client is still choosing one.
    const chosen = typeof options.characterId === 'string' ? options.characterId : null;
    if (!chosen) {
      client.send('characters', { characters: saved, max: 5 });
      return;
    }
    // Already in the world: from another tab, or a connection that has not timed out yet. The new
    // session takes over the live character. Loading it from the store instead would put a second
    // entity with the same id in the zone, and two copies of one sheet saving over each other.
    if (this.zoneOf.has(chosen)) {
      const world = this.worldOf(chosen)!;
      const live = world.characters.get(chosen)!;
      if (live.accountId !== auth.account) throw new ServerError(409, 'Ese personaje ya está en el mundo.');
      const old = this.clientOf(chosen);
      if (old) {
        // Detached first, so its onLeave finds nothing to remove and cannot take the new entity.
        this.characterOf.delete(old.sessionId);
        this.accounts.delete(old.sessionId);
        this.lastActive.delete(old.sessionId);
        this.known.delete(old.sessionId);
      }
      world.leave(chosen);
      this.zoneOf.delete(chosen);
      this.queues.delete(chosen);
      // The new client counts its inputs from zero again.
      this.seen.delete(chosen);
      this.enter(client, live);
      old?.send('replaced', {});
      old?.leave(4001);
      return;
    }
    let character = await store.load(auth.account, chosen);
    if (!character) {
      const classId = validClass(options.classId) ? options.classId : 'guardian';
      const name = validName(options.name) ?? 'Alguien';
      // The dice are thrown here, on the server: a fated skill cannot be rerolled from a browser.
      const creation = validCreation(options.creation) ? options.creation : undefined;
      const destiny = creation ? rollDestiny(Math.random) : undefined;
      character = newCharacter(chosen, auth.account, name, classId, creation, destiny);
      await store.createCharacter(auth.account, character);
    }
    this.enter(client, character);
  }

  private enter(client: Client, character: Character) {
    const world = this.worldFor(character.zoneId);
    character.zoneId = world.definition.id;
    world.join(character);
    this.zoneOf.set(character.id, character.zoneId);
    this.characterOf.set(client.sessionId, character.id);
    this.queues.set(character.id, []);
    client.send('entered', { characterId: character.id, zoneId: character.zoneId });
    this.sendSheet(client, character.id);
    this.sendSnapshot(client);
  }

  async onLeave(client: Client) {
    const id = this.characterOf.get(client.sessionId);
    this.characterOf.delete(client.sessionId);
    this.accounts.delete(client.sessionId);
    this.lastActive.delete(client.sessionId);
    this.known.delete(client.sessionId);
    if (!id) return;
    const world = this.worldOf(id);
    // `leave` writes the position back onto the sheet before the entity disappears.
    const character = world?.characters.get(id);
    world?.leave(id);
    this.zoneOf.delete(id);
    this.queues.delete(id);
    this.seen.delete(id);
    if (character) await store.save(character);
  }

  /** The private sheet: experience, points and stats never travel in everyone's snapshot. */
  private sendSheet(client: Client, id: string) {
    const character = this.worldOf(id)?.characters.get(id);
    if (character) client.send('sheet', character);
  }

  /**
   * The view is built, never cloned and filtered. What a client gets IS its world, which is why
   * the existing scene needs no change: it already garbage-collects whatever stops arriving.
   */
  private viewFor(client: Client): WorldSnapshot | null {
    const id = this.characterOf.get(client.sessionId);
    if (!id) return null;
    const world = this.worldOf(id);
    if (!world) return null;
    const source = world.state as WorldSnapshot;
    const own = source.players.find((p) => p.id === id);
    if (!own) return null;
    const known = this.known.get(client.sessionId) ?? new Set<string>();
    this.known.set(client.sessionId, known);
    const enter = grow(own, ENTER_SCALE);
    const leave = grow(own, LEAVE_SCALE);
    // Hysteresis: something entered at 1.3 screens only disappears past 1.7, so the destroy and
    // rebuild of a visual always happens off-screen instead of flickering at the boundary.
    const visible = (entity: { id: string; x: number; y: number }) => {
      const seen = known.has(entity.id);
      const keep = seen ? inside(leave, entity) : inside(enter, entity);
      if (keep) known.add(entity.id);
      else known.delete(entity.id);
      return keep;
    };
    // Colour is per viewer: in the wild every other character and its undead are the enemy, and the
    // client already paints red. The shared state keeps its teams; only this view changes.
    const paint = <T extends Player | Zombie>(x: T): T => (x.id !== id && world.rivalOf(id, x) ? { ...x, team: 'red' } : x);
    return {
      ...source,
      players: source.players.filter((p) => p.id === own.id || visible(p)).map(paint),
      zombies: source.zombies.filter(visible).map(paint),
      arrows: source.arrows.filter((a) => inside(leave, a)),
      graves: source.graves.filter((g) => inside(leave, g)),
      traps: source.traps.filter((t) => inside(leave, t)),
      chests: (source.chests ?? []).filter((c) => inside(leave, c)),
      events: source.events.filter((e) => inside(leave, e)).slice(-24),
    };
  }

  private sendSnapshot(client: Client) {
    const view = this.viewFor(client);
    if (view) client.send('snapshot', view);
  }

  /**
   * Saves every character online. Cheap at this cadence, and nothing progress-related is missed.
   * The saves go out together so a driver that writes to disk can fold them into one write, and
   * one character failing to save does not stop the others. Throws if any failed.
   */
  private async flush() {
    const online = [...this.worlds.values()].flatMap((world) => [...world.characters.values()]);
    const results = await Promise.allSettled(
      online.map((character) => {
        const world = this.worldOf(character.id);
        const p = world?.state.players.find((q) => q.id === character.id);
        if (world && p) {
          const at = world.restingPlace(p);
          character.x = at.x;
          character.y = at.y;
        }
        return store.save(character);
      }),
    );
    const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [[online[i].id, r.reason] as const] : []));
    for (const [id, error] of failed) logSaveError(id, error);
    if (failed.length) throw new Error(`No se pudieron guardar ${failed.length} personajes`);
  }

  async onDispose() {
    WorldRoom.live.delete(this);
    // Flush what this room still owes, but never close the store: it is shared by the whole
    // process, and closing it here would take every other room's persistence down with it.
    await this.flush();
  }
}

export type { Player };
