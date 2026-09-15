import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { Room, ServerError, type Client } from '@colyseus/core';
import {
  Duel,
  RULES,
  idleInput,
  sanitizeInput,
  validName,
  validClass,
  DEFAULT_CLASS,
  DEFAULT_MAP,DEFAULT_MODE,MAPS,MODE_INFO,validMap,validMode,playerVisibleTo,zombieVisibleTo,pointBush,lineClear,
  type ClassId,
  type Team,type Snapshot,type MapId,type GameMode,
  type Input,
} from '@bandera/shared';

const listedRooms = new Map<string, DuelRoom>();
export const publicRooms = () => [...listedRooms.values()].filter(r => r.publicInfo().visibility === 'public').map(r => r.publicInfo());

export class DuelRoom extends Room {
  maxClients = RULES.maxPlayers + 5;
  private title = 'Duelo medieval';
  private visibility: 'public' | 'private' = 'private';
  private allowSpectators = true;
  private passwordKey = randomBytes(32);
  private passwordHash?: Buffer;
  private watching = new Set<string>();
  private perspectives=new Map<string,Team>();
  publicInfo() {
    return { roomId: this.roomId, title: this.title, visibility: this.visibility,
      passwordRequired: !!this.passwordHash, allowSpectators: this.allowSpectators,
      spectators: this.watching.size, maxSpectators: 5,
      players: this.game.state.players.filter(p => p.connected).length,
      playerSlots: this.game.state.players.length, phase: this.game.state.phase,
      mapId:this.game.state.mapId,mapName:MAPS[this.game.state.mapId].name,mode:this.game.state.mode,modeName:MODE_INFO[this.game.state.mode].name,maxPlayers:this.game.state.maxPlayers,
      score: {...this.game.state.score}, timeLeft: this.game.state.timeLeft, paused: this.game.state.paused,
      names: this.game.state.players.map(p => p.name),teams:this.game.state.players.map(p=>p.team) };
  }
  private publishInfo() { this.broadcast('roomInfo', this.publicInfo()); }
  private viewFor(client:Client):Snapshot{const source=this.game.state,own=source.players.find(p=>p.id===client.sessionId),perspective=own?.team??this.perspectives.get(client.sessionId)??source.players[0]?.team??'blue';const hidden=source.players.filter(p=>!playerVisibleTo(source,p,perspective)),visibleIds=new Set(source.players.filter(p=>playerVisibleTo(source,p,perspective)).map(p=>p.id)),view=structuredClone(source);view.perspective=perspective;view.participants=source.players.map(({id,name,team,classId,ready,connected,deaths})=>({id,name,team,classId,ready,connected,deaths}));view.players=view.players.filter(p=>visibleIds.has(p.id));view.zombies=view.zombies.filter(z=>zombieVisibleTo(source,z,perspective));for(const z of view.zombies)if(z.target&&!visibleIds.has(z.target))z.target=null;const detected=(where:{x:number;y:number},team:Team)=>{if(team===perspective)return true;const bush=pointBush(MAPS[source.mapId],where);if(!bush)return true;return source.players.some(p=>p.team===perspective&&p.hp>0&&p.bushId===bush&&Math.hypot(p.x-where.x,p.y-where.y)<=90&&lineClear(p,where,MAPS[source.mapId].walls));};view.traps=view.traps.filter(t=>detected(t,t.team));view.graves=view.graves.filter(g=>detected(g,g.team));view.events=view.events.filter(e=>!hidden.some(p=>Math.hypot(e.x-p.x,e.y-p.y)<25));return view;}
  private sendSnapshots(){for(const client of this.clients)client.send('snapshot',this.viewFor(client));}
  onDispose() { listedRooms.delete(this.roomId); }

  private spectators = new Set<string>();
  maxMessagesPerSecond = 65;
  game!:Duel;
  private queues = new Map<string, Input[]>();
  private last = new Map<string, Input>();
  private seen = new Map<string, number>();
  private receivedAt = new Map<string, number>();
  private drops = new Map<string, number>();
  onCreate(options: { title?: unknown; visibility?: unknown; password?: unknown; allowSpectators?: unknown;mapId?:unknown;mode?:unknown } = {}) {
    if (options.title !== undefined && (typeof options.title !== 'string' || !options.title.trim() || options.title.trim().length > 48 || /[\x00-\x1f<>]/.test(options.title)))
      throw new ServerError(400, 'El título debe tener entre 1 y 48 caracteres, sin etiquetas.');
    if (options.visibility !== undefined && !['public', 'private'].includes(options.visibility as string))
      throw new ServerError(400, 'Visibilidad desconocida.');
    if (options.allowSpectators !== undefined && typeof options.allowSpectators !== 'boolean')
      throw new ServerError(400, 'Opción de espectadores inválida.');
    if(options.mapId!==undefined&&!validMap(options.mapId))throw new ServerError(400,'Mapa desconocido.');
    if(options.mode!==undefined&&!validMode(options.mode))throw new ServerError(400,'Formato desconocido.');
    if (options.password !== undefined && (typeof options.password !== 'string' || options.password.length > 64))
      throw new ServerError(400, 'La contraseña admite hasta 64 caracteres.');
    this.title = typeof options.title === 'string' ? options.title.trim() : 'Duelo medieval';
    this.visibility = options.visibility === 'public' ? 'public' : 'private';
    this.allowSpectators = options.allowSpectators !== false;
    this.game=new Duel((options.mapId as MapId)??DEFAULT_MAP,(options.mode as GameMode)??DEFAULT_MODE);
    if (options.password) this.passwordHash = createHmac('sha256', this.passwordKey).update(options.password as string).digest();
    this.roomId = randomBytes(16).toString('hex');
    void this.setPrivate(true); // Discovery uses our password-free public DTO only.
    listedRooms.set(this.roomId, this);
    this.onMessage('input', (client, raw) => {
      if (!this.game.state.players.some(p => p.id === client.sessionId)) return;
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
    this.onMessage('selectClass', (client, classId) => {
      if (!validClass(classId) || !this.game.selectClass(client.sessionId, classId)) {
        client.send('selectionError', 'No se puede elegir esa clase ahora.');
        return;
      }
      this.sendSnapshots();
    });
    this.onMessage('selectTeam',(client,team)=>{if(!this.game.selectTeam(client.sessionId,team as Team))client.send('selectionError','No se puede elegir ese equipo.');this.sendSnapshots();});
    this.onMessage('perspective',(client,team)=>{if(!this.spectators.has(client.sessionId)||!this.game.state.players.some(p=>p.team===team))return;const current=this.perspectives.get(client.sessionId),exists=this.game.state.players.some(p=>p.team===current);if(!['lobby','finished'].includes(this.game.state.phase)&&exists)return;this.perspectives.set(client.sessionId,team as Team);this.sendSnapshots();});
    this.onMessage('sync', (client) => { client.send('snapshot', this.viewFor(client)); client.send('roomInfo', this.publicInfo()); });
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
            ? { ...old, sword: false, shot: false, dash: false, summon: false, trap: false, volley: false, command: false, mark: false, ice: false, slash: false, shieldBash: false, fury: false }
            : idleInput(old.seq, p.angle));
        this.last.set(p.id, input);
        inputs.set(p.id, input);
      }
      const phase = s.phase;
      this.game.step(inputs);
      if (s.tick % 2 === 0) this.sendSnapshots();
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
  onAuth(_client: Client, options: { name?: unknown; classId?: unknown; spectator?: unknown; password?: unknown }) {
    if (this.passwordHash && (typeof options.password !== 'string' || options.password.length > 64 || !timingSafeEqual(this.passwordHash, createHmac('sha256', this.passwordKey).update(options.password).digest())))
      throw new ServerError(403, 'Contraseña incorrecta.');
    if (options?.spectator !== undefined && typeof options.spectator !== 'boolean')
      throw new ServerError(400, 'Rol desconocido.');
    if (!validName(options?.name))
      throw new ServerError(400, 'Usá un apodo de 1 a 16 letras o números.');
    if (options.classId !== undefined && !validClass(options.classId))
      throw new ServerError(400, 'Clase de guerrero desconocida.');
    if (options.spectator === true) {
      if (!this.allowSpectators) throw new ServerError(403, 'Esta sala no admite espectadores.');
      if (this.spectators.size >= 5) throw new ServerError(409, 'No quedan lugares para espectadores.');
      return true;
    }
    if (this.game.state.players.length >= this.game.state.maxPlayers) throw new ServerError(409, `Los ${this.game.state.maxPlayers} lugares están ocupados. Podés entrar como espectador.`);
    if (this.game.state.phase !== 'lobby') throw new ServerError(409, 'Esta partida ya empezó.');
    return true;
  }
  onJoin(client: Client, options: { name: string; classId?: ClassId; spectator?: boolean;perspective?:unknown }) {
    if (options.spectator === true) {
      if (!this.allowSpectators) throw new ServerError(403, 'Esta sala no admite espectadores.');
      if (this.spectators.size >= 5) throw new ServerError(409, 'No quedan lugares para espectadores.');
      this.spectators.add(client.sessionId);
      this.watching.add(client.sessionId);
      const requested=options.perspective;this.perspectives.set(client.sessionId,this.game.state.players.some(p=>p.team===requested)?requested as Team:this.game.state.players[0]?.team??'blue');
    } else this.game.add(client.sessionId, validName(options.name)!, options.classId ?? DEFAULT_CLASS);
    this.sendSnapshots();
    this.publishInfo();
    console.info(
      JSON.stringify({ event: 'join', room: this.roomId, players: this.game.state.players.length }),
    );
  }
  onDrop(client: Client) {
    this.watching.delete(client.sessionId);
    this.publishInfo();
    const p = this.game.state.players.find((p) => p.id === client.sessionId);
    if (!p) {
      if (this.spectators.has(client.sessionId)) this.allowReconnection(client, RULES.reconnectSeconds).catch(() => {});
      return;
    }
    p.connected = false;
    this.drops.set(p.id, Date.now() + RULES.reconnectSeconds * 1000);
    this.game.state.paused = true;
    this.sendSnapshots();
    this.allowReconnection(client, RULES.reconnectSeconds).catch(() => {});
  }
  onReconnect(client: Client) {
    if (this.spectators.has(client.sessionId)) this.watching.add(client.sessionId);
    this.publishInfo();
    this.drops.delete(client.sessionId);
    const p = this.game.state.players.find((p) => p.id === client.sessionId);
    if (p) p.connected = true;
    this.game.state.paused = this.drops.size > 0;
    this.queues.set(client.sessionId, []);
    this.last.delete(client.sessionId);
    this.sendSnapshots();
  }
  onLeave(client: Client) {
    this.spectators.delete(client.sessionId);
    this.perspectives.delete(client.sessionId);
    this.watching.delete(client.sessionId);
    this.publishInfo();
    const s = this.game.state,
      p = s.players.find((p) => p.id === client.sessionId);
    this.drops.delete(client.sessionId);
    this.queues.delete(client.sessionId);
    this.last.delete(client.sessionId);
    this.seen.delete(client.sessionId);
    this.receivedAt.delete(client.sessionId);
    if (!p) return;
    if (s.phase === 'lobby' || s.phase === 'finished') this.game.remove(client.sessionId);
    else {
      p.connected = false;
      this.game.abandon(p.id);
    }
    s.paused = this.drops.size > 0;
    this.sendSnapshots();
    console.info(JSON.stringify({ event: 'leave', room: this.roomId }));
  }
}
