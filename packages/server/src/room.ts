import { randomBytes } from 'node:crypto';
import { Room, ServerError, type Client } from '@colyseus/core';
import {
  Duel,
  RULES,
  idleInput,
  sanitizeInput,
  validName,
  other,
  type Input,
} from '@bandera/shared';

export class DuelRoom extends Room {
  maxClients = 2;
  maxMessagesPerSecond = 65;
  game = new Duel();
  private queues = new Map<string, Input[]>();
  private last = new Map<string, Input>();
  private seen = new Map<string, number>();
  private receivedAt = new Map<string, number>();
  private drops = new Map<string, number>();
  onCreate() {
    this.roomId = randomBytes(16).toString('hex');
    void this.setPrivate(true);
    this.onMessage('input', (client, raw) => {
      const input = sanitizeInput(raw);
      if (!input || input.seq <= (this.seen.get(client.sessionId) ?? -1)) return;
      this.seen.set(client.sessionId, input.seq);
      if (this.game.state.phase !== 'playing' || this.game.state.paused) return;
      const queue = this.queues.get(client.sessionId) || [];
      if (queue.length < 6) queue.push(input);
      this.queues.set(client.sessionId, queue);
      this.receivedAt.set(client.sessionId, Date.now());
    });
    this.onMessage('ready', (client) => this.game.ready(client.sessionId));
    this.onMessage('sync', (client) => client.send('snapshot', this.game.state));
    this.onMessage('ping', (client, stamp) => {
      if (typeof stamp === 'number' && Number.isFinite(stamp)) client.send('pong', stamp);
    });
    this.setFixedTimestep(() => {
      const inputs = new Map<string, Input>();
      const s = this.game.state;
      s.paused = this.drops.size > 0;
      s.reconnectLeft = this.drops.size
        ? Math.max(0, (Math.min(...this.drops.values()) - Date.now()) / 1000)
        : 0;
      for (const p of s.players) {
        if (s.phase !== 'playing' || s.paused) {
          this.queues.set(p.id, []);
          this.last.delete(p.id);
          continue;
        }
        const next = this.queues.get(p.id)?.shift();
        const old = this.last.get(p.id) || idleInput(p.ack, p.angle);
        const input =
          next ??
          (Date.now() - (this.receivedAt.get(p.id) ?? 0) < 250
            ? { ...old, sword: false, shot: false, dash: false }
            : idleInput(old.seq, p.angle));
        this.last.set(p.id, input);
        inputs.set(p.id, input);
      }
      const phase = s.phase;
      this.game.step(inputs);
      if (s.tick % 2 === 0) this.broadcast('snapshot', s);
      if (phase !== 'finished' && s.phase === 'finished')
        console.info(
          JSON.stringify({
            event: 'result',
            room: this.roomId,
            winner: s.winner,
            reason: s.reason,
          }),
        );
    }, 30);
    // Disable schema patches only after installing the simulation timer. Otherwise
    // Colyseus starts a second clock ticker and fixed-step elapsed time is lost.
    this.patchRate = null;
  }
  onAuth(_client: Client, options: { name?: unknown }) {
    if (!validName(options?.name))
      throw new ServerError(400, 'Usá un apodo de 1 a 16 letras o números.');
    if (this.game.state.phase !== 'lobby') throw new ServerError(409, 'Esta partida ya empezó.');
    return true;
  }
  onJoin(client: Client, options: { name: string }) {
    this.game.add(client.sessionId, validName(options.name)!);
    this.broadcast('snapshot', this.game.state);
    console.info(
      JSON.stringify({ event: 'join', room: this.roomId, players: this.game.state.players.length }),
    );
  }
  onDrop(client: Client) {
    const p = this.game.state.players.find((p) => p.id === client.sessionId);
    if (!p) return;
    p.connected = false;
    this.drops.set(p.id, Date.now() + RULES.reconnectSeconds * 1000);
    this.game.state.paused = true;
    this.broadcast('snapshot', this.game.state);
    this.allowReconnection(client, RULES.reconnectSeconds).catch(() => {});
  }
  onReconnect(client: Client) {
    this.drops.delete(client.sessionId);
    const p = this.game.state.players.find((p) => p.id === client.sessionId);
    if (p) p.connected = true;
    this.game.state.paused = this.drops.size > 0;
    this.queues.set(client.sessionId, []);
    this.last.delete(client.sessionId);
    this.broadcast('snapshot', this.game.state);
  }
  onLeave(client: Client) {
    const s = this.game.state,
      p = s.players.find((p) => p.id === client.sessionId);
    this.drops.delete(client.sessionId);
    this.queues.delete(client.sessionId);
    this.last.delete(client.sessionId);
    this.seen.delete(client.sessionId);
    this.receivedAt.delete(client.sessionId);
    if (!p) return;
    if (s.phase === 'lobby') {
      s.players = s.players.filter((p) => p.id !== client.sessionId);
      s.players.forEach((p) => (p.ready = false));
    } else {
      p.connected = false;
      if (s.phase !== 'finished') this.game.finish(other(p.team), 'abandono');
    }
    s.paused = this.drops.size > 0;
    this.broadcast('snapshot', s);
    console.info(JSON.stringify({ event: 'leave', room: this.roomId }));
  }
}
