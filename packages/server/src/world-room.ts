import { Client, Room, ServerError } from '@colyseus/core';
import { randomUUID } from 'node:crypto';
import { RULES, distance, sanitizeInput, validClass, validName, type Input, type Player, type Zombie } from '@bandera/shared';
import {
  CAST_SLOTS,
  World,
  newCharacter,
  validCreation,
  type CastSlot,
  type Character,
  type Party,
  type SocialInviteKind,
  type TradeView,
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
const INTERACTION_RANGE = 180;
const INVITE_LIFE = 15_000;
const PARTY_LIMIT = 4;


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
  private leaving = new Set<string>();
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
  private lastAngle = new Map<string, number>();
  private parties = new Map<string, Party>();
  private invites = new Map<string, { id: string; kind: SocialInviteKind; from: string; to: string; expiresAt: number }>();
  private trades = new Map<string, { id: string; players: [string, string]; offers: Map<string, Set<string>>; accepted: Set<string> }>();
  private socialSerial = 0;
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
      world.partyRecipients = (killerId) => {
        const party = this.partyOf(killerId);
        return party ? party.members.map((m) => m.id).filter((member) => this.zoneOf.get(member) === id) : [killerId];
      };
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

  private partyOf(id: string) {
    return [...this.parties.values()].find((p) => p.members.some((m) => m.id === id));
  }

  private playerPair(aId: string, bId: string) {
    const world = this.worldOf(aId);
    if (!world || world !== this.worldOf(bId)) return null;
    const a = world.state.players.find((p) => p.id === aId);
    const b = world.state.players.find((p) => p.id === bId);
    return a && b ? { world, a, b } : null;
  }

  private canInteract(aId: string, bId: string) {
    const pair = this.playerPair(aId, bId);
    return !!pair && aId !== bId && pair.a.hp > 0 && pair.b.hp > 0 && distance(pair.a, pair.b) <= INTERACTION_RANGE;
  }

  private social(client: Client | undefined, text: string, kind = 'info') { client?.send('socialResult', { kind, text }); }

  private async loadParty(id: string) {
    const party = await store.partyFor(id);
    if (party) this.parties.set(party.id, party);
    if (party) this.sendParty(party);
    else this.clientOf(id)?.send('party', null);
  }

  private partyView(party: Party) {
    return { ...party, members: party.members.map((m) => ({
      ...m, online: this.zoneOf.has(m.id), zoneId: this.zoneOf.get(m.id),
    })) };
  }

  private sendParty(party: Party | null) {
    if (!party) return;
    const view = this.partyView(party);
    for (const member of party.members) this.clientOf(member.id)?.send('party', view);
  }

  private tradeOf(id: string) { return [...this.trades.values()].find((t) => t.players.includes(id)); }

  private sendTrade(trade: ReturnType<WorldRoom['tradeOf']>) {
    if (!trade) return;
    for (const id of trade.players) {
      const other = trade.players.find((p) => p !== id)!;
      const mine = this.worldOf(id)?.characters.get(id);
      const theirs = this.worldOf(other)?.characters.get(other);
      if (!mine || !theirs) continue;
      const offered = (who: string, c: Character) => [...(trade.offers.get(who) ?? [])].flatMap((uid) => {
        const item = c.inventory.find((i) => i.uid === uid); return item ? [item] : [];
      });
      const view: TradeView = {
        id: trade.id, partner: { id: other, name: theirs.name },
        own: offered(id, mine), theirs: offered(other, theirs),
        accepted: trade.accepted.has(id), partnerAccepted: trade.accepted.has(other),
      };
      this.clientOf(id)?.send('trade', view);
    }
  }

  private cancelTrade(id: string, text = 'El comercio fue cancelado.') {
    const trade = this.tradeOf(id); if (!trade) return;
    this.trades.delete(trade.id);
    for (const player of trade.players) { this.clientOf(player)?.send('trade', null); this.social(this.clientOf(player), text, 'trade'); }
  }

  private async completeTrade(trade: NonNullable<ReturnType<WorldRoom['tradeOf']>>) {
    const [aId, bId] = trade.players;
    if (!this.canInteract(aId, bId)) return this.cancelTrade(aId, 'El comercio se canceló porque se alejaron.');
    const world = this.worldOf(aId)!;
    const a = world.characters.get(aId)!, b = world.characters.get(bId)!;
    const aUids = [...(trade.offers.get(aId) ?? [])], bUids = [...(trade.offers.get(bId) ?? [])];
    const aItems = aUids.map((uid) => a.inventory.find((i) => i.uid === uid)).filter(Boolean) as Character['inventory'];
    const bItems = bUids.map((uid) => b.inventory.find((i) => i.uid === uid)).filter(Boolean) as Character['inventory'];
    if (aItems.length !== aUids.length || bItems.length !== bUids.length) return this.cancelTrade(aId, 'La oferta dejó de ser válida.');
    if (a.inventory.length - aItems.length + bItems.length > 20 || b.inventory.length - bItems.length + aItems.length > 20)
      return this.cancelTrade(aId, 'Una de las mochilas no tiene espacio suficiente.');
    const beforeA = structuredClone(a), beforeB = structuredClone(b);
    a.inventory = a.inventory.filter((i) => !aUids.includes(i.uid));
    b.inventory = b.inventory.filter((i) => !bUids.includes(i.uid));
    for (const item of bItems) a.inventory.push({ uid: `i${a.itemSerial++}`, itemId: item.itemId });
    for (const item of aItems) b.inventory.push({ uid: `i${b.itemSerial++}`, itemId: item.itemId });
    try {
      await store.saveMany([a, b]);
      world.sheetChanged.add(aId); world.sheetChanged.add(bId);
      this.trades.delete(trade.id);
      for (const id of trade.players) { this.clientOf(id)?.send('trade', null); this.social(this.clientOf(id), 'Comercio completado.', 'trade'); }
    } catch (error) {
      Object.assign(a, beforeA); Object.assign(b, beforeB);
      // FileStore updates its in-memory book before the durable rename. Put that book back too;
      // a later successful flush must never resurrect the failed transfer.
      await store.saveMany([beforeA, beforeB]).catch(() => {});
      this.cancelTrade(aId, 'No se pudo guardar el comercio; ningún objeto cambió de dueño.');
    }
  }

  onCreate() {
    this.autoDispose = false;
    WorldRoom.live.add(this);

    this.onMessage('input', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      if (!id) return;
      const input = sanitizeInput(message);
      if (!input) return;
      // Only doing something counts; a mouse resting on the canvas still sends the same aim every
      // tick. Turning the aim does count: a keyboard player aims with the arrows while standing.
      const turned = Math.abs(input.angle - (this.lastAngle.get(client.sessionId) ?? input.angle)) > 0.05;
      this.lastAngle.set(client.sessionId, input.angle);
      if (input.x !== 0 || input.y !== 0 || input.sword || input.shot || input.charge || turned) this.touch(client);
      const last = this.seen.get(id) ?? -1;
      if (input.seq <= last) return;
      this.seen.set(id, input.seq);
      const queue = this.queues.get(id) ?? [];
      // Same discipline as the duel: a short queue, so a flood cannot buy extra turns.
      if (queue.length < 6) queue.push(input);
      this.queues.set(id, queue);
    });

    // What the player chose to steal from the target the eye is open on.
    this.onMessage('stealPick', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      this.touch(client);
      const option = (message as { option?: unknown })?.option;
      if (!id || typeof option !== 'string' || option.length > 80) return;
      if (this.worldOf(id)?.chooseSteal(id, option)) this.sendSheet(client, id);
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
      if (id && uid && !this.tradeOf(id)?.offers.get(id)?.has(uid)) this.worldOf(id)?.equip(id, uid);
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
      if (!id || !uid || this.tradeOf(id)?.offers.get(id)?.has(uid) || (skillId !== undefined && (typeof skillId !== 'string' || skillId.length > 40))) return;
      this.worldOf(id)?.useItem(id, uid, skillId as string | undefined);
    });
    this.onMessage('discard', (client, message: unknown) => {
      this.touch(client);
      const id = this.characterOf.get(client.sessionId);
      const uid = uidOf(message);
      if (id && uid && !this.tradeOf(id)?.offers.get(id)?.has(uid)) this.worldOf(id)?.discard(id, uid);
    });

    this.onMessage('socialInvite', (client, message: unknown) => {
      const from = this.characterOf.get(client.sessionId);
      const targetId = (message as { targetId?: unknown } | null)?.targetId;
      const kind = (message as { kind?: unknown } | null)?.kind as SocialInviteKind;
      if (!from || typeof targetId !== 'string' || !['party', 'trade', 'duel'].includes(kind)) return;
      if (!this.canInteract(from, targetId)) return this.social(client, 'Ese jugador ya no está suficientemente cerca.', 'error');
      if ((kind === 'trade' || kind === 'duel') && (this.tradeOf(from) || this.tradeOf(targetId) || this.worldOf(from)?.duelOf(from) || this.worldOf(targetId)?.duelOf(targetId)))
        return this.social(client, 'Uno de los jugadores ya está ocupado.', 'error');
      if (kind === 'party') {
        const party = this.partyOf(from);
        if (this.partyOf(targetId)) return this.social(client, 'Ese jugador ya pertenece a un party.', 'error');
        if (party && (party.leaderId !== from || party.members.length >= PARTY_LIMIT))
          return this.social(client, party.leaderId !== from ? 'Solo el líder puede invitar.' : 'El party ya está completo.', 'error');
      }
      const id = `s${++this.socialSerial}`;
      const invite = { id, kind, from, to: targetId, expiresAt: Date.now() + INVITE_LIFE };
      this.invites.set(id, invite);
      const source = this.worldOf(from)?.characters.get(from)!;
      this.clientOf(targetId)?.send('socialInvite', { id, kind, from: { id: from, name: source.name }, expiresAt: invite.expiresAt });
      this.social(client, `Invitación de ${kind === 'party' ? 'party' : kind === 'trade' ? 'comercio' : 'duelo'} enviada.`, kind);
    });

    this.onMessage('socialRespond', async (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId);
      const inviteId = (message as { inviteId?: unknown } | null)?.inviteId;
      const accept = (message as { accept?: unknown } | null)?.accept === true;
      if (!id || typeof inviteId !== 'string') return;
      const invite = this.invites.get(inviteId);
      if (!invite || invite.to !== id) return;
      this.invites.delete(inviteId);
      if (!accept) return this.social(this.clientOf(invite.from), 'Tu invitación fue rechazada.', invite.kind);
      if (invite.expiresAt <= Date.now() || !this.canInteract(invite.from, invite.to)) {
        this.social(client, 'La invitación ya no es válida.', 'error');
        return this.social(this.clientOf(invite.from), 'La invitación venció.', 'error');
      }
      if (invite.kind === 'party') {
        if (this.partyOf(invite.to)) return this.social(client, 'Ya pertenecés a un party.', 'error');
        let party = this.partyOf(invite.from);
        if (!party) {
          const leader = this.worldOf(invite.from)!.characters.get(invite.from)!;
          party = { id: `p:${Date.now()}:${invite.from}`, leaderId: invite.from, members: [{ id: invite.from, name: leader.name, joinedAt: Date.now() }] };
        }
        if (party.leaderId !== invite.from || party.members.length >= PARTY_LIMIT) return this.social(client, 'El party ya no puede aceptar miembros.', 'error');
        const target = this.worldOf(id)!.characters.get(id)!;
        party.members.push({ id, name: target.name, joinedAt: Date.now() });
        this.parties.set(party.id, party); await store.saveParty(party); this.sendParty(party);
        return;
      }
      if (invite.kind === 'trade') {
        if (this.tradeOf(invite.from) || this.tradeOf(invite.to) || this.worldOf(invite.from)?.duelOf(invite.from) || this.worldOf(invite.to)?.duelOf(invite.to)) return this.social(client, 'Uno de los jugadores ya está ocupado.', 'error');
        const trade = { id: `t:${Date.now()}:${invite.from}`, players: [invite.from, invite.to] as [string, string], offers: new Map<string, Set<string>>([[invite.from, new Set()], [invite.to, new Set()]]), accepted: new Set<string>() };
        this.trades.set(trade.id, trade); this.sendTrade(trade); return;
      }
      this.cancelTrade(invite.from, 'El comercio se cerró para iniciar el duelo.');
      this.cancelTrade(invite.to, 'El comercio se cerró para iniciar el duelo.');
      if (!this.worldOf(invite.from)?.startDuel(invite.from, invite.to)) return this.social(client, 'No se pudo iniciar el duelo.', 'error');
      for (const player of [invite.from, invite.to]) this.social(this.clientOf(player), 'El duelo comienza en 3…', 'duel');
    });

    this.onMessage('partyLeave', async (client) => {
      const id = this.characterOf.get(client.sessionId); const party = id ? this.partyOf(id) : undefined;
      if (!id || !party) return;
      party.members = party.members.filter((m) => m.id !== id);
      client.send('party', null);
      if (!party.members.length) { this.parties.delete(party.id); await store.deleteParty(party.id); return; }
      if (party.leaderId === id) party.leaderId = [...party.members].sort((a, b) => a.joinedAt - b.joinedAt)[0].id;
      await store.saveParty(party); this.sendParty(party);
    });

    this.onMessage('partyKick', async (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId); const targetId = (message as { targetId?: unknown } | null)?.targetId;
      const party = id ? this.partyOf(id) : undefined;
      if (!id || !party || party.leaderId !== id || typeof targetId !== 'string' || targetId === id) return;
      if (!party.members.some((m) => m.id === targetId)) return;
      party.members = party.members.filter((m) => m.id !== targetId); this.clientOf(targetId)?.send('party', null);
      await store.saveParty(party); this.sendParty(party);
    });

    this.onMessage('tradeOffer', (client, message: unknown) => {
      const id = this.characterOf.get(client.sessionId); const uid = (message as { uid?: unknown } | null)?.uid;
      const trade = id ? this.tradeOf(id) : undefined; const character = id ? this.worldOf(id)?.characters.get(id) : undefined;
      if (!id || !trade || typeof uid !== 'string' || !character?.inventory.some((i) => i.uid === uid)) return;
      const offer = trade.offers.get(id)!; offer.has(uid) ? offer.delete(uid) : offer.add(uid); trade.accepted.clear(); this.sendTrade(trade);
    });
    this.onMessage('tradeAccept', async (client) => {
      const id = this.characterOf.get(client.sessionId); const trade = id ? this.tradeOf(id) : undefined;
      if (!id || !trade) return; trade.accepted.add(id); this.sendTrade(trade);
      if (trade.players.every((p) => trade.accepted.has(p))) await this.completeTrade(trade);
    });
    this.onMessage('tradeCancel', (client) => { const id = this.characterOf.get(client.sessionId); if (id) this.cancelTrade(id); });
    this.onMessage('duelAbandon', (client) => { const id = this.characterOf.get(client.sessionId); if (id) this.worldOf(id)?.abandonDuel(id); });

    this.onMessage('selectCharacter', async (client, message: unknown) => {
      const account = this.accounts.get(client.sessionId);
      const id = (message as { id?: unknown } | null)?.id;
      if (!account || this.characterOf.has(client.sessionId) || typeof id !== 'string') return;
      try {
        await this.chooseCharacter(client, account, id, {});
      } catch (error) {
        client.send('characterResult', { error: (error as Error).message || 'No se pudo entrar con ese personaje.' });
      }
    });

    this.onMessage('createCharacter', async (client, message: unknown) => {
      const account = this.accounts.get(client.sessionId);
      if (!account || this.characterOf.has(client.sessionId)) return;
      const request = (message ?? {}) as Record<string, unknown>;
      try {
        const name = validName(request.name);
        if (!name || !validCreation(request.creation)) throw new ServerError(400, 'Revisá el nombre, las afinidades y el arma.');
        await this.chooseCharacter(client, account, `c${randomUUID()}`, {
          createCharacter: true, name, classId: request.classId, creation: request.creation,
        });
      } catch (error) {
        client.send('characterResult', { error: (error as Error).message || 'No se pudo crear el personaje.' });
      }
    });

    this.onMessage('deleteCharacter', async (client, message: unknown) => {
      const account = this.accounts.get(client.sessionId);
      const id = (message as { id?: unknown } | null)?.id;
      if (!account || this.characterOf.has(client.sessionId) || typeof id !== 'string') return;
      try {
        const character = await store.load(account, id);
        if (!character) throw new StoreError('no-existe', 'El personaje ya no existe');
        if (this.zoneOf.has(id) || this.leaving.has(id)) throw new StoreError('no-existe', 'Ese personaje está conectado o terminando de guardar. Intentá de nuevo al salir del mundo.');
        const party = await store.partyFor(id);
        await store.deleteCharacter(account, id);
        if (party) {
          party.members = party.members.filter((member) => member.id !== id);
          if (!party.members.length) this.parties.delete(party.id);
          else {
            if (party.leaderId === id) party.leaderId = [...party.members].sort((a, b) => a.joinedAt - b.joinedAt)[0].id;
            this.parties.set(party.id, party);
            this.sendParty(party);
          }
        }
        client.send('characters', { characters: await store.listCharacters(account), max: 5 });
      } catch (error) {
        client.send('deleteCharacterResult', { error: error instanceof StoreError ? error.message : 'No se pudo eliminar el personaje. Intentá de nuevo.' });
      }
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
      if (tick % 15 === 0) this.expireSocial();
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
    this.lastAngle.delete(client.sessionId);
      client.send('idle', { seconds });
      client.leave(4000);
    }
  }

  private ticks = 0;
  private tickCount() {
    return this.ticks++;
  }

  private expireSocial() {
    const now = Date.now();
    for (const [id, invite] of this.invites) {
      if (invite.expiresAt > now) continue;
      this.invites.delete(id);
      this.social(this.clientOf(invite.from), 'La invitación venció.', invite.kind);
      this.clientOf(invite.to)?.send('socialInviteExpired', { id });
    }
    for (const trade of [...this.trades.values()])
      if (!this.canInteract(...trade.players)) this.cancelTrade(trade.players[0], 'El comercio se canceló porque se alejaron.');
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
    // The impostor's eye asks its owner what to take; nobody else sees the list.
    for (const { id, offer } of world.stealOffers.splice(0)) this.clientOf(id)?.send('stealOffer', offer);
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
    this.cancelTrade(characterId, 'El comercio se canceló al cambiar de zona.');
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
    const party = this.partyOf(characterId); if (party) this.sendParty(party);
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
    await this.chooseCharacter(client, auth.account, chosen, options);
  }

  private async chooseCharacter(client: Client, account: AccountId, chosen: string, options: Record<string, unknown>) {
    // Already in the world: from another tab, or a connection that has not timed out yet. The new
    // session takes over the live character. Loading it from the store instead would put a second
    // entity with the same id in the zone, and two copies of one sheet saving over each other.
    if (this.zoneOf.has(chosen)) {
      const world = this.worldOf(chosen)!;
      const live = world.characters.get(chosen)!;
      if (live.accountId !== account) throw new ServerError(409, 'Ese personaje ya está en el mundo.');
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
    let character = await store.load(account, chosen);
    if (!character) {
      if (options.createCharacter !== true)
        throw new ServerError(404, 'Ese personaje ya no existe. Volvé a seleccionarlo.');
      const classId = validClass(options.classId) ? options.classId : 'guardian';
      const name = validName(options.name);
      if (!name) throw new ServerError(400, 'Nombre de personaje inválido');
      // The dice are thrown here, on the server: a fated skill cannot be rerolled from a browser.
      const creation = validCreation(options.creation) ? options.creation : undefined;
      const destiny = creation ? rollDestiny(Math.random, creation) : undefined;
      character = newCharacter(chosen, account, name, classId, creation, destiny);
      await store.createCharacter(account, character);
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
    void this.loadParty(character.id).catch((error) => logSaveError(character.id, error));
  }

  async onLeave(client: Client) {
    const id = this.characterOf.get(client.sessionId);
    if (id) {
      this.cancelTrade(id, 'El comercio se canceló por desconexión.');
      this.worldOf(id)?.abandonDuel(id);
    }
    this.characterOf.delete(client.sessionId);
    this.accounts.delete(client.sessionId);
    this.lastActive.delete(client.sessionId);
    this.lastAngle.delete(client.sessionId);
    this.known.delete(client.sessionId);
    if (!id) return;
    const world = this.worldOf(id);
    // `leave` writes the position back onto the sheet before the entity disappears.
    const character = world?.characters.get(id);
    this.leaving.add(id);
    world?.leave(id);
    this.zoneOf.delete(id);
    this.queues.delete(id);
    this.seen.delete(id);
    const currentParty = this.partyOf(id); if (currentParty) this.sendParty(currentParty);
    try {
      if (character) await store.save(character);
    } finally {
      this.leaving.delete(id);
    }
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
      blackHoles: source.blackHoles.filter((hole) => inside(leave, hole)),
      graves: source.graves.filter((g) => inside(leave, g)),
      traps: source.traps.filter((t) => inside(leave, t)),
      chests: (source.chests ?? []).filter((c) => inside(leave, c)),
      mobShots: (source.mobShots ?? []).filter((m) => inside(leave, m)),
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
