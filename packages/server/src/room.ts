import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { Room, ServerError, type Client } from '@colyseus/core';
import {
  Duel,
  RULES,
  idleInput,
  sanitizeInput,
  validName,
  sanitizeChatText,
  validClass,
  defaultCustomization,validCustomization,
  idleSlots,SKILL_SLOTS,
  DEFAULT_CLASS,
  DEFAULT_MAP,DEFAULT_MODE,MAPS,MODE_INFO,validMap,validMode,playerVisibleTo,zombieVisibleTo,pointBush,lineClear,
  type ClassId,
  type Team,type Snapshot,type MapId,type GameMode,
  type Input,
  type ChatMessage, type ChatHistory, type ChatStatus, type RoomClosingReason,
  type CharacterCustomization,
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
  private hostId: string | null = null;
  publicInfo() {
    return { roomId: this.roomId, title: this.title, visibility: this.visibility,
      passwordRequired: !!this.passwordHash, allowSpectators: this.allowSpectators,
      spectators: this.watching.size, maxSpectators: 5,
      players: this.game.state.players.filter(p => p.connected).length,
      playerSlots: this.game.state.players.length, phase: this.game.state.phase,
      mapId:this.game.state.mapId,mapName:MAPS[this.game.state.mapId].name,mode:this.game.state.mode,modeName:MODE_INFO[this.game.state.mode].name,maxPlayers:this.game.state.maxPlayers,
      score: {...this.game.state.score}, timeLeft: this.game.state.timeLeft, paused: this.game.state.paused,
      hostId:this.hostId,wave:this.game.state.pve?.wave??0,enemies:this.game.state.pve?.enemiesRemaining??0,pveCompleted:this.game.state.pve?.completed??false,
      names: this.game.state.players.map(p => p.name),teams:this.game.state.players.map(p=>p.team) };
  }
  private publishInfo() { this.broadcast('roomInfo', this.publicInfo()); }
  private viewFor(client:Client):Snapshot{const source=this.game.state,own=source.players.find(p=>p.id===client.sessionId),perspective=own?.team??this.perspectives.get(client.sessionId)??source.players[0]?.team??'blue';const hidden=source.players.filter(p=>!playerVisibleTo(source,p,perspective)),visibleIds=new Set(source.players.filter(p=>playerVisibleTo(source,p,perspective)).map(p=>p.id)),view=structuredClone(source);view.perspective=perspective;view.participants=source.players.map(({id,name,team,classId,ready,connected,deaths})=>({id,name,team,classId,ready,connected,deaths}));view.players=view.players.filter(p=>visibleIds.has(p.id));view.zombies=view.zombies.filter(z=>zombieVisibleTo(source,z,perspective));for(const z of view.zombies)if(z.target&&!visibleIds.has(z.target))z.target=null;const detected=(where:{x:number;y:number},team:Team)=>{if(team===perspective)return true;const bush=pointBush(MAPS[source.mapId],where);if(!bush)return true;return source.players.some(p=>p.team===perspective&&p.hp>0&&p.bushId===bush&&Math.hypot(p.x-where.x,p.y-where.y)<=90&&lineClear(p,where,MAPS[source.mapId].walls));};view.traps=view.traps.filter(t=>detected(t,t.team));view.graves=view.graves.filter(g=>detected(g,g.team));view.events=view.events.filter(e=>!hidden.some(p=>Math.hypot(e.x-p.x,e.y-p.y)<25));return view;}
  private sendSnapshots(){for(const client of this.clients)client.send('snapshot',this.viewFor(client));}
  private sendUpgradeOffers(){for(const client of this.clients)client.send('upgradeOffer',this.game.getUpgradeOffer(client.sessionId)??null);}
  onDispose() {
    listedRooms.delete(this.roomId);
    this.chatMessages.length = 0;
    this.chatWindows.clear();
    this.spectatorNames.clear();
    this.playerSessions.clear();
  }

  private spectators = new Set<string>();
  private spectatorNames = new Map<string, string>();
  private playerSessions = new Set<string>();
  private chatMessages: ChatMessage[] = [];
  private chatWindows = new Map<string, number[]>();
  private nextChatId = 1;
  private closing = false;
  private hadPlayer = false;
  private lastActivityAt = Date.now();
  private lastHumanInput = new Map<string, { angle: number; aimX: number; aimY: number }>();
  private connectedPlayerCount() {
    return this.game.state.players.filter((p) => p.connected && this.playerSessions.has(p.id)).length;
  }
  private chatStatus(): ChatStatus {
    const connectedPlayers = this.connectedPlayerCount();
    return { enabled: !this.closing && connectedPlayers >= 2, connectedPlayers, closing: this.closing };
  }
  private sendChatHistory(client: Client) {
    const history: ChatHistory = { ...this.chatStatus(), messages: [...this.chatMessages] };
    client.send('chatHistory', history);
  }
  private publishChatStatus() { this.broadcast('chatStatus', this.chatStatus()); }
  private touchActivity() { this.lastActivityAt = Date.now(); }
  private isHumanInput(id: string, input: Input) {
    const previous = this.lastHumanInput.get(id);
    this.lastHumanInput.set(id, { angle: input.angle, aimX: input.aimX, aimY: input.aimY });
    const action = input.sword || input.shot || input.dash || input.summon || input.trap || input.volley || input.command || input.mark || input.ice || input.slash || input.shieldBash || input.fury || input.guard;
    return !!action || Math.abs(input.x) > 0.01 || Math.abs(input.y) > 0.01 || (!!previous && (Math.abs(input.angle - previous.angle) > 0.01 || Math.abs(input.aimX - previous.aimX) > 0.01 || Math.abs(input.aimY - previous.aimY) > 0.01));
  }
  private closeRoom(reason: RoomClosingReason) {
    if (this.closing) return;
    this.closing = true;
    listedRooms.delete(this.roomId);
    this.broadcast('roomClosing', { reason });
    this.publishChatStatus();
    void this.lock();
    this.clock.setTimeout(() => void this.disconnect(4000), 80);
  }
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
    this.autoDispose = false;
    this.lastActivityAt = Date.now();
    this.title = typeof options.title === 'string' ? options.title.trim() : 'Duelo medieval';
    this.visibility = options.visibility === 'public' ? 'public' : 'private';
    this.allowSpectators = options.allowSpectators !== false;
    this.game=new Duel((options.mapId as MapId)??DEFAULT_MAP,(options.mode as GameMode)??DEFAULT_MODE);
    if (options.password) this.passwordHash = createHmac('sha256', this.passwordKey).update(options.password as string).digest();
    this.roomId = randomBytes(16).toString('hex');
    void this.setPrivate(true); // Discovery uses our password-free public DTO only.
    listedRooms.set(this.roomId, this);
    this.onMessage('input', (client, raw) => {
      if (this.closing) return;
      if (!this.game.state.players.some(p => p.id === client.sessionId)) return;
      const input = sanitizeInput(raw);
      if (!input || input.seq <= (this.seen.get(client.sessionId) ?? -1)) return;
      this.seen.set(client.sessionId, input.seq);
      if (this.isHumanInput(client.sessionId, input)) this.touchActivity();
      if (!(this.game.state.phase === 'playing' || (this.game.state.mode === 'pve' && this.game.state.phase === 'rewards')) || this.game.state.paused) return;
      const queue = this.queues.get(client.sessionId) || [];
      if (queue.length < 6) queue.push(input);
      this.queues.set(client.sessionId, queue);
      this.receivedAt.set(client.sessionId, Date.now());
    });
    this.onMessage('ready', (client) => { if (this.closing) return; this.game.ready(client.sessionId); this.touchActivity(); });
    this.onMessage('selectClass', (client, classId) => {
      if (this.closing) return;
      if (!validClass(classId) || !this.game.selectClass(client.sessionId, classId)) {
        client.send('selectionError', 'No se puede elegir esa clase ahora.');
        return;
      }
      this.touchActivity();
      this.sendSnapshots();
    });
    this.onMessage('selectCustomization', (client, customization: unknown) => {
      if(this.closing)return;
      const player=this.game.state.players.find(p=>p.id===client.sessionId);
      if(!player||!validCustomization(player.classId,customization)||!this.game.setCustomization(client.sessionId,customization)) {
        client.send('selectionError','La configuración de habilidades no es válida.'); return;
      }
      this.touchActivity();client.send('profileRevision',player.profileRevision);this.sendSnapshots();
    });
    this.onMessage('selectTeam',(client,team)=>{if(this.closing)return;if(!this.game.selectTeam(client.sessionId,team as Team))client.send('selectionError','No se puede elegir ese equipo.');else this.touchActivity();this.sendSnapshots();});
    this.onMessage('perspective',(client,team)=>{if(this.closing)return;if(!this.spectators.has(client.sessionId)||!this.game.state.players.some(p=>p.team===team))return;const current=this.perspectives.get(client.sessionId),exists=this.game.state.players.some(p=>p.team===current);if(!['lobby','finished'].includes(this.game.state.phase)&&exists)return;this.perspectives.set(client.sessionId,team as Team);this.touchActivity();this.sendSnapshots();});
    this.onMessage('startPve',(client)=>{if(this.closing||client.sessionId!==this.hostId)return client.send('selectionError','Solo el anfitrión puede iniciar la expedición.');if(!this.game.startPve())return client.send('selectionError','Todos los jugadores presentes deben estar listos.');this.touchActivity();this.sendSnapshots();this.publishInfo();});
    this.onMessage('continuePve',(client)=>{if(this.closing||client.sessionId!==this.hostId)return;if(this.game.continuePve()){this.touchActivity();this.sendSnapshots();this.sendUpgradeOffers();this.publishInfo();}});
    this.onMessage('selectUpgrade',(client,raw)=>{if(this.closing||!raw||typeof raw!=='object')return;const value=raw as {offerId?:unknown;key?:unknown;targetId?:unknown};if(!this.game.selectUpgrade(client.sessionId,value.offerId,value.key,value.targetId))return client.send('selectionError','La recompensa ya no está disponible.');this.touchActivity();client.send('upgradeOffer',null);this.sendSnapshots();});
    this.onMessage('sync', (client) => { client.send('snapshot', this.viewFor(client)); client.send('roomInfo', this.publicInfo()); this.sendChatHistory(client); client.send('upgradeOffer',this.game.getUpgradeOffer(client.sessionId)??null); });
    this.onMessage('chat', (client, raw) => {
      if (this.closing) return client.send('chatError', 'La sala se está cerrando.');
      if (this.connectedPlayerCount() < 2) return client.send('chatError', 'El chat se habilita cuando haya al menos 2 jugadores.');
      const text = sanitizeChatText(raw);
      if (!text) return client.send('chatError', `El mensaje debe tener entre 1 y ${RULES.chatMaxLength} caracteres y no incluir caracteres de control.`);
      const now = Date.now(), cutoff = now - RULES.chatRateWindowSeconds * 1000;
      const recent = (this.chatWindows.get(client.sessionId) ?? []).filter((stamp) => stamp > cutoff);
      if (recent.length >= RULES.chatRateLimit) return client.send('chatError', 'Estás enviando mensajes demasiado rápido. Esperá unos segundos.');
      recent.push(now); this.chatWindows.set(client.sessionId, recent);
      const player = this.game.state.players.find((p) => p.id === client.sessionId);
      const name = player?.name ?? this.spectatorNames.get(client.sessionId);
      if (!name) return;
      const message: ChatMessage = { id: this.nextChatId++, senderId: client.sessionId, name, role: player ? 'player' : 'spectator', text, sentAt: now };
      this.chatMessages.push(message);
      if (this.chatMessages.length > RULES.chatHistoryLimit) this.chatMessages.splice(0, this.chatMessages.length - RULES.chatHistoryLimit);
      this.touchActivity();
      this.broadcast('chatMessage', message);
    });
    this.onMessage('ping', (client, stamp) => {
      if (typeof stamp === 'number' && Number.isFinite(stamp)) client.send('pong', stamp);
    });
    this.setFixedTimestep(() => {
      if (!this.closing && Date.now() - this.lastActivityAt >= RULES.roomInactivitySeconds * 1000) { this.closeRoom('inactive'); return; }
      if (this.closing) return;
      const inputs = new Map<string, Input>();
      const s = this.game.state;
      s.paused = this.drops.size > 0;
      s.reconnectLeft = this.drops.size
        ? Math.max(0, (Math.min(...this.drops.values()) - Date.now()) / 1000)
        : 0;
      for (const p of s.players) {
        if (!(s.phase === 'playing' || (s.mode === 'pve' && s.phase === 'rewards')) || s.paused) {
          this.queues.set(p.id, []);
          this.last.delete(p.id);
          continue;
        }
        const next = this.queues.get(p.id)?.shift();
        const old = this.last.get(p.id) || idleInput(p.ack, p.angle);
        const input =
          next ??
          (Date.now() - (this.receivedAt.get(p.id) ?? 0) < 250
            ? { ...old, sword: false, shot: false, dash: false, blackHoleRelease: false, blackHoleDetonate: false, blinkRelease: false, summon: false, trap: false, volley: false, command: false, mark: false, ice: false, slash: false, shieldBash: false, fury: false,
                slots:Object.assign(idleSlots(),Object.fromEntries(SKILL_SLOTS.map(slot=>[slot,{pressed:false,held:old.slots[slot].held,released:false}])))}
            : idleInput(old.seq, p.angle));
        this.last.set(p.id, input);
        inputs.set(p.id, input);
      }
      const phase = s.phase;
      this.game.step(inputs);
      if (s.tick % 2 === 0) this.sendSnapshots();
      if(phase!==s.phase){this.sendSnapshots();this.sendUpgradeOffers();this.publishInfo();}
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
  onAuth(_client: Client, options: { name?: unknown; classId?: unknown; spectator?: unknown; password?: unknown; customization?:unknown }) {
    if (this.passwordHash && (typeof options.password !== 'string' || options.password.length > 64 || !timingSafeEqual(this.passwordHash, createHmac('sha256', this.passwordKey).update(options.password).digest())))
      throw new ServerError(403, 'Contraseña incorrecta.');
    if (options?.spectator !== undefined && typeof options.spectator !== 'boolean')
      throw new ServerError(400, 'Rol desconocido.');
    if (!validName(options?.name))
      throw new ServerError(400, 'Usá un apodo de 1 a 16 letras o números.');
    if (options.classId !== undefined && !validClass(options.classId))
      throw new ServerError(400, 'Clase de guerrero desconocida.');
    const classId=validClass(options.classId)?options.classId:DEFAULT_CLASS;
    if(options.customization!==undefined&&!validCustomization(classId,options.customization))
      throw new ServerError(400,'La configuración de habilidades no es válida.');
    if (options.spectator === true) {
      if (!this.allowSpectators) throw new ServerError(403, 'Esta sala no admite espectadores.');
      if (this.spectators.size >= 5) throw new ServerError(409, 'No quedan lugares para espectadores.');
      return true;
    }
    if (this.game.state.players.length >= this.game.state.maxPlayers) throw new ServerError(409, `Los ${this.game.state.maxPlayers} lugares están ocupados. Podés entrar como espectador.`);
    if (this.game.state.phase !== 'lobby') throw new ServerError(409, 'Esta partida ya empezó.');
    return true;
  }
  onJoin(client: Client, options: { name: string; classId?: ClassId; spectator?: boolean;perspective?:unknown;customization?:CharacterCustomization }) {
    if (this.closing) throw new ServerError(410, 'La sala ya terminó.');
    this.touchActivity();
    if (options.spectator === true) {
      if (!this.allowSpectators) throw new ServerError(403, 'Esta sala no admite espectadores.');
      if (this.spectators.size >= 5) throw new ServerError(409, 'No quedan lugares para espectadores.');
      this.spectators.add(client.sessionId);
      this.spectatorNames.set(client.sessionId, validName(options.name)!);
      this.watching.add(client.sessionId);
      const requested=options.perspective;this.perspectives.set(client.sessionId,this.game.state.players.some(p=>p.team===requested)?requested as Team:this.game.state.players[0]?.team??'blue');
    } else { const classId=options.classId??DEFAULT_CLASS;this.game.add(client.sessionId,validName(options.name)!,classId,options.customization??defaultCustomization(classId));this.playerSessions.add(client.sessionId);this.hadPlayer=true;if(!this.hostId)this.hostId=client.sessionId; }
    this.sendSnapshots();
    client.send('upgradeOffer', this.game.getUpgradeOffer(client.sessionId) ?? null);
    this.sendChatHistory(client);
    this.publishChatStatus();
    this.publishInfo();
    console.info(
      JSON.stringify({ event: 'join', room: this.roomId, players: this.game.state.players.length }),
    );
  }
  onDrop(client: Client) {
    if (this.closing) return;
    this.watching.delete(client.sessionId);
    this.publishInfo();
    const p = this.game.state.players.find((p) => p.id === client.sessionId);
    if (!p) {
      this.publishChatStatus();
      if (this.spectators.has(client.sessionId)) this.allowReconnection(client, RULES.reconnectSeconds).catch(() => {});
      return;
    }
    p.connected = false;
    this.publishChatStatus();
    this.drops.set(p.id, Date.now() + RULES.reconnectSeconds * 1000);
    this.game.state.paused = true;
    this.sendSnapshots();
    this.allowReconnection(client, RULES.reconnectSeconds).catch(() => {});
  }
  onReconnect(client: Client) {
    if (this.closing) return;
    this.touchActivity();
    if (this.spectators.has(client.sessionId)) this.watching.add(client.sessionId);
    this.publishInfo();
    this.drops.delete(client.sessionId);
    const p = this.game.state.players.find((p) => p.id === client.sessionId);
    if (p) p.connected = true;
    this.game.state.paused = this.drops.size > 0;
    this.queues.set(client.sessionId, []);
    this.last.delete(client.sessionId);
    this.sendSnapshots();
    client.send('upgradeOffer', this.game.getUpgradeOffer(client.sessionId) ?? null);
    this.sendChatHistory(client);
    this.publishChatStatus();
  }
  onLeave(client: Client) {
    if (this.closing) return;
    this.spectators.delete(client.sessionId);
    this.spectatorNames.delete(client.sessionId);
    this.chatWindows.delete(client.sessionId);
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
    this.lastHumanInput.delete(client.sessionId);
    if (!p) { this.publishChatStatus(); return; }
    this.playerSessions.delete(client.sessionId);
    if(this.hostId===client.sessionId){this.hostId=this.playerSessions.values().next().value??null;this.publishInfo();}
    if (s.phase === 'lobby' || s.phase === 'finished') this.game.remove(client.sessionId);
    else {
      p.connected = false;
      this.game.abandon(p.id);
    }
    s.paused = this.drops.size > 0;
    this.publishChatStatus();
    if (this.hadPlayer && this.playerSessions.size === 0) { this.closeRoom('empty'); return; }
    this.sendSnapshots();
    console.info(JSON.stringify({ event: 'leave', room: this.roomId }));
  }
}
