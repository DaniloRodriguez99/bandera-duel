import { Client, Room, ServerError } from '@colyseus/core';
import { RULES, sanitizeInput, validClass, validName, type Input, type Player } from '@bandera/shared';
import { World, newCharacter, type Character, type WorldSnapshot } from '@bandera/shared/world';
import { MemoryStore, StoreError, type AccountId, type CharacterStore } from './store/characters.js';

/**
 * The persistent world room.
 *
 * Its lifecycle is the opposite of `DuelRoom`: there is no lobby, no countdown and no winner,
 * people walk in mid-session, and the room stays alive when the last one leaves so the world is
 * still there tomorrow. `DuelRoom` is not touched at all; this is registered beside it.
 */

/** How much more than a screen a client is told about, and where it stops being told. */
const VIEW_WIDTH = RULES.width;
const VIEW_HEIGHT = RULES.height;
const ENTER_SCALE = 1.3;
const LEAVE_SCALE = 1.7;
/** Saving is debounced: losing thirty seconds of walking is fine, losing a level is not. */
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
  private world = new World();
  private accounts = new Map<string, AccountId>();
  private characterOf = new Map<string, string>();
  private queues = new Map<string, Input[]>();
  private seen = new Map<string, number>();
  /** Ids a client already knows about, so entities are not resent as new on every tick. */
  private known = new Map<string, Set<string>>();
  private dirty = new Set<string>();
  private saveClock = 0;

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
      if (this.world.spendPoint(id, stat as never)) {
        this.dirty.add(id);
        this.sendSheet(client, id);
      }
    });

    this.onMessage('sync', (client) => {
      const id = this.characterOf.get(client.sessionId);
      this.known.delete(client.sessionId);
      this.sendSnapshot(client);
      if (id) this.sendSheet(client, id);
    });

    this.setFixedTimestep(() => {
      const inputs = new Map<string, Input>();
      for (const p of this.world.state.players) {
        const queue = this.queues.get(p.id);
        const next = queue?.shift();
        if (next) inputs.set(p.id, next);
      }
      this.world.step(inputs);
      if (this.world.state.tick % 2 === 0) for (const client of this.clients) this.sendSnapshot(client);
      this.saveClock += RULES.tick;
      if (this.saveClock >= SAVE_EVERY_SECONDS) {
        this.saveClock = 0;
        void this.flush();
      }
    }, 30);
    // Same reason as the duel room: disabling patches before the timer exists loses the clock.
    this.patchRate = null;
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
    this.world.join(character);
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
    // `leave` writes the position back onto the sheet before the entity disappears.
    const character = this.world.characters.get(id);
    this.world.leave(id);
    this.queues.delete(id);
    this.seen.delete(id);
    this.dirty.delete(id);
    if (character) await store.save(character);
  }

  /** The private sheet: experience, points and stats never travel in everyone's snapshot. */
  private sendSheet(client: Client, id: string) {
    const character = this.world.characters.get(id);
    if (character) client.send('sheet', character);
  }

  /**
   * The view is built, never cloned and filtered. What a client gets IS its world, which is why
   * the existing scene needs no change: it already garbage-collects whatever stops arriving.
   */
  private viewFor(client: Client): WorldSnapshot | null {
    const id = this.characterOf.get(client.sessionId);
    const source = this.world.state as WorldSnapshot;
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

  private async flush() {
    for (const id of [...this.dirty]) {
      const character = this.world.characters.get(id);
      this.dirty.delete(id);
      if (character) await store.save(character);
    }
  }

  /** Position is saved on a slower beat than progression; a level up marks the sheet at once. */
  markDirty(id: string) {
    this.dirty.add(id);
  }

  async onDispose() {
    // Flush what this room still owes, but never close the store: it is shared by the whole
    // process, and closing it here would take every other room's persistence down with it.
    await this.flush();
  }
}

export type { Player };
