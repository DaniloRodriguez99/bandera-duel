import { Client, Room, ServerError } from '@colyseus/core';
import { RULES, sanitizeInput, validClass, validName, type Input, type Player } from '@bandera/shared';
import { World, newCharacter, type Character, type WorldSnapshot } from '@bandera/shared/world';
import { DEFAULT_ZONE, ZONES, type ZoneId } from '@bandera/shared/rpg/zones';
import { MemoryStore, StoreError, type AccountId, type CharacterStore } from './store/characters.js';

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
 * character with it. Swapping this for a Postgres driver is the whole job of going to production.
 */
let store: CharacterStore = new MemoryStore();
export const useCharacterStore = (next: CharacterStore) => (store = next);
export const characterStore = () => store;

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

    this.onMessage('input', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      if (!id) return;
      const input = sanitizeInput(message);
      if (!input) return;
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
      const stat = (message as { stat?: unknown })?.stat;
      if (!id || typeof stat !== 'string') return;
      if (this.worldOf(id)?.spendPoint(id, stat as never)) this.sendSheet(client, id);
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
      if (this.tickCount() % 2 === 0) for (const client of this.clients) this.sendSnapshot(client);
      this.saveClock += RULES.tick;
      if (this.saveClock >= SAVE_EVERY_SECONDS) {
        this.saveClock = 0;
        void this.flush();
      }
    }, 30);
    // Same reason as the duel room: disabling patches before the timer exists loses the clock.
    this.patchRate = null;
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
    await store.save(character);
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
    const saved = await store.listCharacters(auth.account);
    // Coming back with no character named means the client is still choosing one.
    const chosen = typeof options.characterId === 'string' ? options.characterId : null;
    if (!chosen) {
      client.send('characters', { characters: saved, max: 5 });
      return;
    }
    let character = await store.load(auth.account, chosen);
    if (!character) {
      const classId = validClass(options.classId) ? options.classId : 'guardian';
      const name = validName(options.name) ?? 'Alguien';
      character = newCharacter(chosen, auth.account, name, classId);
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
    return {
      ...source,
      players: source.players.filter((p) => p.id === own.id || visible(p)),
      zombies: source.zombies.filter(visible),
      arrows: source.arrows.filter((a) => inside(leave, a)),
      graves: source.graves.filter((g) => inside(leave, g)),
      traps: source.traps.filter((t) => inside(leave, t)),
      events: source.events.filter((e) => inside(leave, e)).slice(-24),
    };
  }

  private sendSnapshot(client: Client) {
    const view = this.viewFor(client);
    if (view) client.send('snapshot', view);
  }

  /** Saves every character online. Cheap at this cadence, and nothing progress-related is missed. */
  private async flush() {
    const online = [...this.worlds.values()].flatMap((world) => [...world.characters.values()]);
    for (const character of online) {
      const p = this.worldOf(character.id)?.state.players.find((q) => q.id === character.id);
      if (p) {
        character.x = p.x;
        character.y = p.y;
      }
      await store.save(character);
    }
  }

  async onDispose() {
    // Flush what this room still owes, but never close the store: it is shared by the whole
    // process, and closing it here would take every other room's persistence down with it.
    await this.flush();
  }
}

export type { Player };
