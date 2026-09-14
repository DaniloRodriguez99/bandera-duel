import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import { RULES, chargePower, CLASSES, TEAMS, TEAM_NAMES, TEAM_ICONS, validName, type Snapshot, type ClassId, type Team } from '@bandera/shared';
import { Arena } from './scene.js';
import {
  muted,
  toggleMute,
  unlockAudio,
  musicVolume,
  setMusicVolume,
  setMusicMode,
} from './audio.js';
import { savedClass, saveClass, mountClasses, updateClasses } from './classes.js';
import { updateAbilities } from './abilities.js';
import './style.css';
import { Practice, PRACTICE_PLAYER } from './practice.js';

function hudTeam(team: Team, right = false) {
  const label = right ? `${TEAM_NAMES[team]} ${TEAM_ICONS[team]}` : `${TEAM_ICONS[team]} ${TEAM_NAMES[team]}`;
  const parts = [`<span>${label}</span>`, `<b id="score-${team}">0</b>`, `<small id="flag-${team}">En base</small>`];
  return `<div id="team-${team}" class="team ${team}"${team === 'blue' || team === 'red' ? '' : ' hidden'}>${(right ? parts.reverse() : parts).join('')}</div>`;
}
document.querySelector('#app')!.innerHTML = `
<header class="topbar"><a class="brand" href="/" aria-label="Bandera Duel, inicio"><span class="brand-mark">⚑</span><span>BANDERA<span class="brand-thin"> DUEL</span><small>LA GLORIA NO SE HEREDA. SE ROBA.</small></span></a><div class="header-right"><span class="edition">PRIMERA EDICIÓN <b>01</b></span><button id="mute" class="icon-btn" aria-label="Silenciar sonido"></button></div></header>
<main>
<section id="intro" class="intro"><div class="hero-copy"><div class="eyebrow"><i></i> DUELO ONLINE · HASTA 4 JUGADORES</div><h1>Tu rival tiene<br>algo <em>tuyo.</em></h1><p>Entrá al castillo. Robá su bandera.<br>Volvé con la gloria antes de que te alcancen.</p><div class="facts"><span><b>04</b> rivales</span><span><b>03</b> minutos</span><span><b>01</b> vencedor</span></div></div>
<div class="entry-card"><div class="card-top"><span class="tiny">EL DESAFÍO EMPIEZA ACÁ</span><span class="swords">⚔</span></div><h2 id="entry-title">Prepará tu estandarte.</h2><p id="entry-description">Elegí tu guerrero, prepará una sala e invitá a tu rival.</p><form id="entry-form"><div class="player-setup"><div class="setup-heading"><span>01</span><h3>Tu guerrero</h3></div><label for="name">TU APODO</label><input id="name" name="name" placeholder="Caballero sin nombre" maxlength="16" autocomplete="nickname" required><fieldset id="entry-class-picker" class="class-picker"><legend>ELEGÍ TU GUERRERO</legend><div id="entry-classes" class="class-grid"></div></fieldset></div><div class="room-setup"><div class="setup-heading"><span>02</span><h3>Tu próximo duelo</h3></div><fieldset id="room-options"><legend>TU SALA</legend><label for="room-title">TÍTULO</label><input id="room-title" maxlength="48" value="Duelo medieval"><label for="visibility">VISIBILIDAD</label><select id="visibility"><option value="private">Privada · solo por enlace</option><option value="public">Pública · aparece en el listado</option></select><label class="check-option"><input id="allow-spectators" type="checkbox" checked> Permitir espectadores (máximo 5)</label></fieldset><label for="room-password">CONTRASEÑA (OPCIONAL)</label><input id="room-password" type="password" maxlength="64" autocomplete="off" placeholder="Sin contraseña"><label id="spectator-choice" hidden><input id="spectator" type="checkbox"> Entrar como espectador</label></div><div class="entry-actions"><button id="enter" class="primary" type="submit">Crear un duelo <span>↗</span></button><button id="practice-start" class="secondary" type="button">Probar contra un rival inmóvil</button><span class="entry-note">Práctica local, sin sala.</span></div></form><div id="status" class="status" role="status" aria-live="polite">Sin cuentas. Sin descargas. Solo el duelo.</div><button id="new-instead" class="text-btn" hidden>Crear otra sala</button></div></section>
<section id="room-browser" class="room-browser"><div class="browser-heading"><div><span class="tiny">BUSCÁ TU PRÓXIMO RIVAL</span><h2>Salas públicas</h2></div><button id="refresh-rooms" class="secondary">↻ Actualizar salas</button></div><p id="rooms-status" role="status"></p><h3 class="room-group-title">● Combates en vivo</h3><p id="live-empty">No hay combates públicos en curso.</p><div id="live-rooms-list"></div><h3 class="room-group-title">Salas para jugar y próximas rondas</h3><div id="rooms-list"></div></section><section class="arena-section"><div class="arena-heading"><div><span class="live-dot"></span><span id="arena-label">EL PATIO DEL REY</span><span class="map-label">ARENA 01</span></div><span id="connection-label">ACERO · ARCO · MAGIA</span></div>
<div id="practice-toolbar" hidden><span>PRÁCTICA · RIVAL INMÓVIL</span><button id="practice-reset" class="secondary">Reiniciar práctica</button><button id="practice-exit" class="secondary">Volver al inicio</button></div><div id="hud" class="hud" hidden>${hudTeam('blue')}${hudTeam('green')}<div class="clock"><span id="timer">3:00</span><small>PRIMERO A 3</small></div>${hudTeam('violet', true)}${hudTeam('red', true)}</div>
<div id="stage" class="stage"><span id="spectator-count" hidden aria-live="polite"></span><div id="game"></div><div id="abilities" class="abilities" hidden aria-label="Habilidades"></div><div class="preview-tag" id="preview-tag">HASTA CUATRO ESTANDARTES. UNA SOLA GLORIA.</div>
<div id="overlay" class="overlay" hidden><div class="overlay-card"><span id="overlay-kicker" class="tiny">SALA</span><h2 id="overlay-title">Esperando a tu rival</h2><p id="overlay-description"></p><p id="room-heading"></p><div id="roster" class="roster"></div><fieldset id="room-picker" class="class-picker compact"><legend>TU CLASE · PODÉS CAMBIAR ANTES DE JUGAR</legend><div id="room-classes" class="class-grid"></div></fieldset><p id="selection-status" role="status" hidden></p><div id="invitation"><label for="invite">LINK DE INVITACIÓN</label><div class="invite-row"><input id="invite" readonly aria-label="Link de invitación"><button id="copy" class="secondary">Copiar</button></div></div><button id="ready" class="primary">Estoy listo <span>⚔</span></button><button id="leave" class="text-btn">Salir de la sala</button></div></div>
<div id="announcement" class="announcement" hidden aria-live="polite"></div>
<div id="touch-controls"><div id="stick-move" class="stick" aria-label="Mover"><span></span><small>MOVER</small></div><div class="touch-right"><button id="touch-trap" class="touch-action" aria-label="Colocar trampa" hidden>Q</button><button id="touch-volley" class="touch-action" aria-label="Disparo triple" hidden>E</button><button id="touch-sword" class="touch-action" aria-label="Espada">⚔</button><button id="touch-guard" class="touch-action" aria-label="Mantener escudo" hidden>⛨</button><button id="touch-summon" class="touch-action" aria-label="Invocar zombies" hidden>☠</button><button id="touch-dash" class="touch-action" aria-label="Dash">➟</button><div id="stick-aim" class="stick" aria-label="Apuntar y soltar para disparar"><span></span><small>APUNTAR</small></div></div></div></div>
<div class="arena-bottom"><span id="arena-hint">Robá la bandera rival y traela a tu base. La tuya debe estar en casa.</span><div id="cooldowns" hidden><span id="health" aria-label="Vida"></span><span id="lives" aria-label="Muertes"></span><span id="cd-sword"></span><span id="cd-shot"></span><span id="cd-dash"></span><span id="cd-guard" hidden></span><span id="cd-trap" hidden></span><span id="cd-volley" hidden></span><span id="cd-summon" hidden></span></div><span class="corner-detail">◆ &nbsp; ✚ &nbsp; ▲ &nbsp; ●</span></div></section>
<section id="guide" class="guide"><article><span class="step">01 / ROBÁ</span><h3>Entrá en terreno rival.</h3><p>Tocá su bandera para llevarla. Podés pelear mientras la transportás.</p></article><article><span class="step">02 / RESISTÍ</span><h3>Un golpe cambia todo.</h3><p>Si te hieren, soltás la bandera. Recuperá la tuya con solo tocarla.</p></article><article><span class="step">03 / VOLVÉ</span><h3>Tu base. Tu victoria.</h3><p>Capturá con tu bandera en casa. Tres capturas deciden el duelo. Con cinco muertes quedás afuera.</p></article></section>
<div id="control-guide" class="control-guide"></div>
</main><footer><span>BANDERA DUEL <b> / </b> HECHO PARA LA REVANCHA.</span><span>HASTA 4 · V0.1</span></footer><div id="rotate"><span>↻</span><h2>Giralo para el duelo.</h2><p>La arena se juega con el celular horizontal.</p></div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const arena = new Arena();
$('touch-guard').insertAdjacentHTML('afterend','<button id="touch-ice" class="touch-action" aria-label="Lanzar hielo" hidden>❄</button>');
$('cooldowns').insertAdjacentHTML('beforeend','<span id="cd-ice" hidden></span>');
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  pixelArt: true,
  antialias: false,
  backgroundColor: '#23362f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: arena,
  banner: false,
  input: { activePointers: 5 },
});
let practice: Practice | undefined;
let room: Room | undefined,
  current: Snapshot | undefined,
  busy = false,
  online = false;
let target = new URL(location.href).searchParams.get('sala');
const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
const endpoint =
  configured || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`;
const client = new Client(endpoint);
const nameInput = $<HTMLInputElement>('name');
nameInput.value = localStorage.getItem('bandera-name') || '';
let selectedClass = savedClass();
mountClasses($('entry-classes'), selectedClass, (id) => {
  selectedClass = id;
  saveClass(id);
  updateClasses($('entry-classes'), id);
  showClassControls(id);
});
mountClasses($('room-classes'), selectedClass, (id) => room?.send('selectClass', id));
let displayedClass: ClassId | undefined;
function showClassControls(id:ClassId) {
  if(displayedClass===id)return;
  displayedClass=id;
  const stats=CLASSES[id],ranged=stats.ranged,guardian=id==='guardian',mage=id==='mage';
  $('touch-ice').hidden=!mage;$('cd-ice').hidden=!mage;
  const projectile=mage?'Hechizo':'Flecha',melee=mage?'Báculo':'Daga';
  for (const idPart of ['touch-trap','touch-volley','cd-trap','cd-volley']) $(idPart).hidden = id !== 'archer';
  $('touch-dash').hidden=!stats.dash;$('touch-guard').hidden=!stats.shield;
  $('touch-summon').hidden=!stats.summon;$('touch-sword').hidden=!stats.melee;$('cd-summon').hidden=!stats.summon;$('cd-sword').hidden=!stats.melee;
  $('touch-sword').textContent=ranged?(mage?'✦':'†'):'⚔';
  $('touch-sword').setAttribute('aria-label',ranged?melee:id==='vanguard'?'Espada pesada':'Espada');
  $('stick-aim').setAttribute('aria-label',ranged?`Apuntar y soltar ${mage?'el hechizo':'para disparar'}`:'Apuntar');
  $('cd-shot').hidden=!ranged;$('cd-dash').hidden=!stats.dash;$('cd-guard').hidden=!stats.shield;
  $('control-guide').innerHTML=`<span><kbd>W A S D</kbd> Mover</span><span><kbd>CLIC</kbd> ${ranged?projectile:'Espada'}</span>${id!=='vanguard'?`<span><kbd>CLIC DER.</kbd> ${ranged?melee:'Mantener escudo'}</span>`:''}${stats.dash?'<span><kbd>ESPACIO</kbd> Esquivar</span>':''}<span class="mobile-help">${ranged?`Mové a la izquierda. Apuntá y soltá a la derecha para lanzar ${mage?'magia':'una flecha'}. Botones de ${melee.toLowerCase()} y dash.`:guardian?'Mové y apuntá con las palancas. Golpeá con espada o mantené pulsado el escudo.':'Mové y apuntá con las palancas. El botón de espada prepara un golpe pesado.'}</span>`;
  if(id==='archer') $('control-guide').innerHTML += '<span><kbd>MANTENER CLIC</kbd> Cargar flecha · 0,8 s · +30 % daño y velocidad</span><span class="mobile-help">Mantené la palanca de apuntado para cargar; soltala para disparar.</span>';
  if(id==='archer') $('control-guide').innerHTML += '<span><kbd>Q</kbd> Trampa · inmóvil 0,5 s</span><span><kbd>E</kbd> Triple flecha · 5 s</span><span><kbd>CARGANDO + E</kbd> Triple al 33 %</span><span><kbd>SALTO CARGADO</kbd> Soltá el tiro o E en pleno salto (tiro cargado: flecha de viento que rompe escudos; ambos: triple de viento)</span>';
  if(stats.summon)$('control-guide').innerHTML='<span><kbd>W A S D</kbd> Mover</span><span><kbd>CLIC</kbd> Fuego</span><span><kbd>ESPACIO</kbd> Invocar zombies</span><span class="mobile-help">Mové a la izquierda. Apuntá y soltá a la derecha para lanzar fuego. Espacio o el botón ☠ invocan dos zombies; hasta 2 invocaciones activas a la vez.</span>';
  $('touch-guard').setAttribute('aria-label', mage ? 'Lanzar escudo mágico' : 'Mantener escudo');
  if (mage) {
    $('touch-guard').hidden = false; $('cd-guard').hidden = false;
    $('stick-aim').setAttribute('aria-label','Apuntar y soltar para lanzar bola de fuego');
    $('control-guide').innerHTML='<span><kbd>W A S D</kbd> Mover</span><span><kbd>CLIC</kbd> Bola de fuego</span><span><kbd>CLIC DER.</kbd> Escudo mágico</span><span><kbd>ESPACIO</kbd> Esquivar</span><span class="mobile-help">El escudo absorbe 2 golpes. Al romperse, esperá 5 s y volvé a lanzarlo con clic derecho o el botón ⛨. Apuntá y soltá para lanzar fuego.</span>';
    $('control-guide').insertAdjacentHTML('beforeend','<span><kbd>CLIC CENTRAL</kbd> Hielo · inmoviliza 0,5 s · recarga 0,5 s</span><span class="mobile-help">Tocá ❄ para lanzar hielo hacia donde apuntás.</span>');
  }
  if (id !== 'archer') $('control-guide').innerHTML += '<span><kbd>MANTENER CLIC</kbd> Cargar · más daño y alcance al soltar</span>';
  if (stats.dash) $('control-guide').innerHTML += '<span><kbd>MANTENER ESPACIO</kbd> Dash más largo</span>';
  if (stats.summon) $('control-guide').innerHTML += '<span><kbd>MANTENER ESPACIO</kbd> Zombie mago · aura llena: mandala bajo el mouse que resucita a un rival caído</span><span><kbd>E</kbd> Zombies: círculo rojo y mouse, o automáticos</span><span><kbd>⌘/CTRL E</kbd> Pasar al zombie bajo el cursor entre el círculo rojo y el mouse</span>';
}
showClassControls(selectedClass);
function entryMode() {
  $('spectator-choice').hidden = !target;
  $('room-options').hidden = !!target;
  document.body.classList.toggle('joining-room', !!target);
  if (target) {
    $('entry-title').textContent = 'Aceptá el desafío.';
    $('entry-description').textContent = 'Tu rival te espera en una sala privada.';
    $('enter').innerHTML = 'Entrar al duelo <span>↗</span>';
    $('new-instead').hidden = false;
  }
}
entryMode();
$<HTMLInputElement>('spectator').onchange = () => {
  const watching = $<HTMLInputElement>('spectator').checked;
  $('entry-class-picker').hidden = watching;
  $('enter').textContent = watching ? 'Observar partida ↗' : 'Entrar al duelo ↗';
};
function muteLabel() {
  $('mute').textContent = muted ? '♪ OFF' : '♪ ON';
  $('mute').setAttribute('aria-pressed', String(muted));
  $('mute').setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
}
muteLabel();
const musicControl = document.createElement('label');
musicControl.className = 'music-control';
musicControl.innerHTML = `Música <input id="music-volume" aria-label="Volumen de música" type="range" min="0" max="100" value="${Math.round(musicVolume * 100)}">`;
$('mute').before(musicControl);
$<HTMLInputElement>('music-volume').oninput = (e) =>
  setMusicVolume(Number((e.target as HTMLInputElement).value) / 100);
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });
$('mute').onclick = () => {
  toggleMute();
  muteLabel();
};
function setStatus(text: string, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
async function warmup() {
  const health = new URL(endpoint.replace(/^ws/, 'http'));
  health.pathname = '/health';
  const start = Date.now();
  setStatus('Preparando servidor… El primer arranque puede tardar un minuto.');
  while (Date.now() - start < 85000) {
    try {
      const res = await fetch(health, { signal: AbortSignal.timeout(6000) });
      if (res.ok) return;
    } catch {
      /* Render may be asleep. */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw Error('El servidor no responde. Probá de nuevo en unos segundos.');
}
function bind(joined: Room) {
  joined.reconnection.minUptime = 0;
  joined.reconnection.minDelay = 300;
  joined.reconnection.maxDelay = 2000;
  joined.reconnection.maxRetries = 12;
  room = joined;
  online = true;
  current = undefined;
  arena.reset();
  target = room.roomId;
  history.replaceState(null, '', `?sala=${room.roomId}`);
  sessionStorage.setItem('bandera-token', room.reconnectionToken);
  $('intro').hidden = true;
  $('room-browser').hidden = true;
  $('spectator-count').hidden = false;
  $('preview-tag').hidden = true;
  $('hud').hidden = false;
  $('guide').hidden = true;
  document.body.classList.add('in-room');
  $<HTMLInputElement>('invite').value = location.href;
  room.onMessage('roomInfo', (info: RoomInfo) => {
    $('spectator-count').textContent = `Espectadores: ${info.spectators}/5`;
    $('entry-title').textContent = info.title;
    $('invite').setAttribute('aria-label', `Invitación a ${info.title}`);
    $('room-heading').textContent =
      `${info.title} · ${info.visibility === 'public' ? 'Pública' : 'Privada'}`;
  });
  room.onMessage('snapshot', (s: Snapshot) => {
    current = s;
    arena.receive(s, joined.sessionId);
    render(s);
  });
  room.onMessage('selectionError', (message: string) => {
    $('selection-status').hidden = false;
    $('selection-status').textContent = message;
  });
  room.onMessage('pong', (stamp: number) => {
    $('connection-label').textContent = `● CONECTADO · ${Math.round(performance.now() - stamp)} MS`;
  });
  room.onDrop(() => {
    online = false;
    arena.controls.enabled = false;
    arena.controls.clear();
    $('announcement').hidden = false;
    $('announcement').textContent = 'Reconectando… Reservamos tu lugar durante 15 s.';
  });
  room.onReconnect(() => {
    online = true;
    sessionStorage.setItem('bandera-token', joined.reconnectionToken);
    room?.send('sync');
  });
  room.onLeave(() => {
    online = false;
    sessionStorage.removeItem('bandera-token');
    if (room === joined) {
      arena.controls.enabled = false;
      arena.controls.clear();
      $('overlay').hidden = false;
      $('overlay-title').textContent = 'La sala terminó';
      $('overlay-description').textContent =
        'Se perdió la conexión o el servidor se reinició. Podés crear otro duelo.';
      $('ready').hidden = true;
      $('invitation').hidden = true;
      $('announcement').hidden = true;
    }
  });
  room.onError((_code, message) => {
    setStatus(message || 'Error de conexión.', true);
  });
  arena.send = (input) => {
    if (online && current?.players.some((p) => p.id === joined.sessionId))
      joined.send('input', input);
  };
  room.send('sync');
  $('stage').scrollIntoView({ block: 'center', behavior: 'smooth' });
}
$('entry-form').onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  const name = validName(nameInput.value);
  if (!name) {
    setStatus('Usá entre 1 y 16 letras, números, espacios, puntos o guiones.', true);
    return;
  }
  busy = true;
  $<HTMLButtonElement>('enter').disabled = true;
  unlockAudio();
  localStorage.setItem('bandera-name', name);
  try {
    await warmup();
    const joined = target
      ? await client.joinById(target, {
          name,
          classId: selectedClass,
          spectator: $<HTMLInputElement>('spectator').checked,
          password: $<HTMLInputElement>('room-password').value,
        })
      : await client.create('duel', {
          name,
          classId: selectedClass,
          title: $<HTMLInputElement>('room-title').value,
          visibility: $<HTMLSelectElement>('visibility').value,
          password: $<HTMLInputElement>('room-password').value,
          allowSpectators: $<HTMLInputElement>('allow-spectators').checked,
        });
    $<HTMLInputElement>('room-password').value = '';
    bind(joined);
  } catch (error) {
    const message = (error as Error).message || '';
    setStatus(
      /not found|not defined|expired/i.test(message)
        ? 'Esta sala ya no existe. Creá un nuevo duelo.'
        : /locked|full|seat|already/i.test(message)
          ? 'La sala está llena o la partida ya empezó.'
          : message || 'No se pudo entrar al duelo.',
      true,
    );
  } finally {
    busy = false;
    $<HTMLButtonElement>('enter').disabled = false;
  }
};
$('new-instead').onclick = () => {
  target = null;
  document.body.classList.remove('joining-room');
  $('room-options').hidden = false;
  $<HTMLInputElement>('room-password').value = '';
  $('spectator-choice').hidden = true;
  $<HTMLInputElement>('spectator').checked = false;
  $('entry-class-picker').hidden = false;
  history.replaceState(null, '', location.pathname);
  $('entry-title').textContent = 'Prepará tu estandarte.';
  $('entry-description').textContent = 'Elegí tu guerrero, prepará una sala e invitá a tu rival.';
  $('enter').innerHTML = 'Crear un duelo <span>↗</span>';
  $('new-instead').hidden = true;
  setStatus('Sin cuentas. Sin descargas. Solo el duelo.');
};
$('copy').onclick = async () => {
  const input = $<HTMLInputElement>('invite');
  try {
    await navigator.clipboard.writeText(input.value);
    $('copy').textContent = '¡Copiado!';
  } catch {
    input.select();
    $('copy').textContent = 'Seleccionado';
  }
  setTimeout(() => ($('copy').textContent = 'Copiar'), 1800);
};
$('ready').onclick = () => {
  unlockAudio();
  room?.send('ready');
};
$('leave').onclick = () => {
  sessionStorage.removeItem('bandera-token');
  const previous = room;
  room = undefined;
  void previous?.leave();
  location.assign(location.pathname);
};
function render(s: Snapshot) {
  if (!room && !practice) return;
  const me = s.players.find((p) => p.id === (practice ? PRACTICE_PLAYER : room!.sessionId));
  setMusicMode(
    s.paused
      ? 'menu'
      : s.phase === 'finished'
        ? s.winner === me?.team
          ? 'victory'
          : 'defeat'
        : ['playing', 'countdown', 'capture'].includes(s.phase)
          ? s.timeLeft <= 30
            ? 'urgent'
            : 'duel'
          : 'menu',
  );
  for (const team of TEAMS) {
    $(`team-${team}`).hidden = !s.bases.some((b) => b.team === team);
    $(`score-${team}`).textContent = String(s.score[team]);
    $(`flag-${team}`).textContent = s.players.find((p) => p.team === team)?.eliminated ? 'Eliminado' : '';
  }
  const seconds = Math.ceil(s.timeLeft);
  $('timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  for (const flag of s.flags)
    $(`flag-${flag.team}`).textContent =
      flag.status === 'home'
        ? 'En base'
        : flag.status === 'carried'
          ? '¡Robada!'
          : `En el suelo · ${Math.ceil(flag.returnLeft)} s`;
  $('arena-label').textContent = me
    ? `JUGÁS PARA ${TEAM_ICONS[me.team]} ${TEAM_NAMES[me.team]}`
    : 'ESPECTADOR · VISTA DEL DUELO';
  $('stage').dataset.phase = s.phase;
  const overlay = s.phase === 'lobby' || s.phase === 'finished';
  $('overlay').hidden = !overlay;
  $('touch-controls').classList.toggle('active', !!me && s.phase === 'playing' && !s.paused);
  $('cooldowns').hidden = !me || s.phase !== 'playing';
  $('abilities').hidden = !me || s.phase !== 'playing';
  $('room-picker').hidden = !me || !overlay;
  $('control-guide').hidden = !me;
  $('stage').dataset.role = me ? 'player' : 'spectator';
  if (me) {
    selectedClass=me.classId;saveClass(me.classId);showClassControls(me.classId);
    updateAbilities($('abilities'), me);
    updateClasses($('room-classes'),me.classId,!overlay||s.paused);
    $('room-picker').hidden=!overlay;
    $('stage').dataset.class=me.classId;
    $('stage').dataset.guarding=String(me.guarding);
    $('stage').dataset.magicShield=String(me.magicShieldHits);
    $('stage').dataset.frozen=String(me.frozenLeft>0);
    $('cd-ice').textContent=`❄ ${me.iceCd>0?me.iceCd.toFixed(1)+'s':'Listo'}`;
    $('stage').dataset.dashing=String(me.dashInvulnerable);
    $('health').textContent=`♥ ${me.hp}/${me.maxHp}`;
    $('health').setAttribute('aria-label',`Vida: ${me.hp} de ${me.maxHp}`);
    $('lives').textContent=`☠ ${me.deaths}/${RULES.maxDeaths}`;
    $('lives').setAttribute('aria-label',`Muertes: ${me.deaths} de ${RULES.maxDeaths}`);
    $('cd-guard').textContent=me.guarding?`⛨ Cubriendo ${me.guardLeft.toFixed(1)}s`:`⛨ ${me.guardCd>0?me.guardCd.toFixed(1)+'s':'Listo'}`;
    if(me.classId==='mage') $('cd-guard').textContent=me.magicShieldHits>0?`⛨ ${me.magicShieldHits}/2 golpes`:`⛨ ${me.magicShieldCd>0?me.magicShieldCd.toFixed(1)+'s':'Listo · clic derecho'}`;
    $('cd-sword').textContent = `⚔ ${me.swordCd > 0 ? me.swordCd.toFixed(1) + 's' : 'Lista'}`;
    $('stage').dataset.charge = String(me.shotCharge);
    $('stage').dataset.specialCharge = String(me.specialCharge);
    $('cd-shot').textContent = `${me.classId==='mage'?'✦':me.classId==='necromancer'?'✺':'➶'} ${me.shotCd > 0 ? me.shotCd.toFixed(1) + 's' : 'Lista'}`;
    if(me.classId==='archer' && me.shotCharge > 0) $('cd-shot').textContent = me.shotCharge>=RULES.chargeTime-1e-8 ? '➶ Cargada · +30 %' : `➶ Cargando ${Math.round(me.shotCharge/RULES.chargeTime*100)}%`;
    if(me.classId!=='archer' && me.shotCharge > 0) $(CLASSES[me.classId].ranged ? 'cd-shot' : 'cd-sword').textContent = `⚡ Cargando ${Math.round(chargePower(me.shotCharge)*100)} %`;
    $('cd-dash').textContent = `➟ ${me.dashCd > 0 ? me.dashCd.toFixed(1) + 's' : 'Listo'}`;
    if(me.specialCharge > 0 && CLASSES[me.classId].dash) $('cd-dash').textContent = `➟ Cargando ${Math.round(chargePower(me.specialCharge)*100)} %`;
    $('stage').dataset.trapLeft = String(me.trapLeft);
    $('stage').dataset.traps = String(s.traps.filter(t=>t.owner===me.id).length);
    $('cd-trap').textContent = me.trapLeft > 0 ? `Q Preparando ${me.trapLeft.toFixed(1)}s` : `Q Trampa · ${me.trapCd>0?me.trapCd.toFixed(1)+'s':'Lista'}`;
    $('cd-volley').textContent = `E Triple · ${me.volleyCd>0?me.volleyCd.toFixed(1)+'s':'Listo'}`;
    $('touch-trap').textContent = me.trapLeft>0?me.trapLeft.toFixed(1):me.trapCd>0?Math.ceil(me.trapCd)+'s':'Q';
    $('touch-volley').textContent = me.volleyCd>0?Math.ceil(me.volleyCd)+'s':'E';
    $('cd-summon').textContent = `☠ ${me.activeExecutions}/${RULES.zombieExecutions} · ${me.activeExecutions >= RULES.zombieExecutions ? 'Llenas' : me.summonCd > 0 ? me.summonCd.toFixed(1) + 's' : 'Listo'}`;
    if(me.specialCharge > 0 && CLASSES[me.classId].summon) $('cd-summon').textContent = me.specialCharge >= RULES.overchargeTime ? `☠ Aura ${Math.round(Math.min(1, me.specialCharge / RULES.raiseCharge) * 100)} % · resucitar` : '☠ Cargando · zombie con gorro';
  }
  $('arena-hint').textContent = s.flags.some((f) => f.carrier === me?.id)
    ? '¡Tenés la bandera! Volvé a tu base.'
    : me?.eliminated
      ? 'Quedaste eliminado. Mirá cómo termina la batalla.'
      : me?.hp === 0
      ? `Reaparecés en ${Math.ceil(me.respawnLeft)} s`
      : 'Robá la bandera rival. Recuperá la tuya. Volvé a casa.';
  if (overlay) {
    $('overlay-kicker').textContent =
      s.phase === 'finished' ? 'EL DUELO TERMINÓ' : `SALA · ${s.players.length}/${RULES.maxPlayers}`;
    $('overlay-title').textContent =
      s.phase === 'finished'
        ? s.winner === 'draw'
          ? 'Un duelo a la altura.'
          : s.winner === me?.team
            ? 'La gloria es tuya.'
            : s.players.length > 2
              ? `Esta vez, ganó ${s.players.find((p) => p.team === s.winner)?.name ?? 'otro rival'}.`
              : 'Esta vez, ganó tu rival.'
        : s.players.length < 2
          ? 'Falta tu rival.'
          : 'El duelo está servido.';
    $('overlay-description').textContent =
      s.phase === 'finished'
        ? s.reason === 'abandono'
          ? 'Tus rivales abandonaron la partida.'
          : s.reason === 'eliminación'
            ? 'Quedó un solo guerrero en pie. ¿Otra ronda?'
            : `${s.bases.map((b) => s.score[b.team]).join(' — ')}. ¿Otra ronda?`
        : `Compartí el link: hasta ${RULES.maxPlayers} jugadores. Cuando todos estén listos, empieza la batalla.`;
    const roster = $('roster');
    roster.replaceChildren();
    for (const team of TEAMS) {
      const p = s.players.find((p) => p.team === team),
        row = document.createElement('div');
      row.className = `roster-player ${team}`;
      const title = document.createElement('span');
      title.textContent = `${TEAM_ICONS[team]} ${p?.name || 'Esperando rival…'}${p?' · '+CLASSES[p.classId].name:''}`;
      const state = document.createElement('small');
      state.textContent = !p
        ? 'ASIENTO LIBRE'
        : !p.connected
          ? 'DESCONECTADO'
          : p.ready
            ? 'LISTO ✓'
            : 'PREPARÁNDOSE';
      row.append(title, state);
      roster.append(row);
    }
    $('invitation').hidden = false;
    $('ready').hidden = !me || (s.phase === 'finished' && s.players.some((p) => !p.connected));
    $<HTMLButtonElement>('ready').disabled = s.paused || s.players.length < 2;
    $('ready').textContent = me?.ready
      ? 'Listo ✓ · Esperando rivales'
      : s.phase === 'finished'
        ? 'Quiero revancha ↗'
        : 'Estoy listo ⚔';
  }
  if (!me) {
    $('arena-hint').textContent =
      'Estás observando. Los jugadores deciden cuándo empezar y pedir revancha.';
    if (overlay) {
      $('overlay-title').textContent =
        s.phase === 'finished'
          ? s.winner === 'draw'
            ? 'Empate.'
            : `Ganó ${({ blue: 'Azul', red: 'Carmesí', green: 'Jade', violet: 'Violeta' } as const)[s.winner as Team]}.`
          : 'Esperando a los jugadores';
      $('overlay-description').textContent =
        s.phase === 'finished'
          ? `${s.bases.map((b) => s.score[b.team]).join(' — ')}. Esperando una nueva ronda.`
          : 'Estás como espectador. La partida empieza cuando ambos estén listos.';
    }
  }
  if (practice) {
    $('arena-label').textContent = 'PRÁCTICA LOCAL';
    $('stage').dataset.role = 'practice';
    $('practice-toolbar').dataset.dummyHp = String(s.players[1].hp);
    $('room-picker').hidden = true;
    $('invitation').hidden = true;
    $('ready').hidden = true;
    $('leave').hidden = true;
    if (overlay) {
      $('overlay-title').textContent = 'Práctica terminada';
      $('overlay-description').textContent =
        'Reiniciá la práctica o volvé al inicio para elegir otra clase.';
    }
  }
  if(me?.stunLeft) $('arena-hint').textContent = `Aturdido · ${me.stunLeft.toFixed(1)} s`;
  const announce = $('announcement');
  announce.hidden = overlay || !(s.paused || s.phase === 'countdown' || s.phase === 'capture');
  if (s.paused) {
    announce.hidden = false;
    announce.textContent = `Rival desconectado · ${Math.ceil(s.reconnectLeft)} s para volver`;
  } else if (s.phase === 'countdown')
    announce.textContent = String(Math.max(1, Math.ceil(s.phaseLeft)));
  else if (s.phase === 'capture') announce.textContent = '¡BANDERA CAPTURADA!';
}
setInterval(() => {
  if (room && online) room.send('ping', performance.now());
}, 2000);
const token = sessionStorage.getItem('bandera-token');
if (token && target && token.startsWith(target + ':')) {
  busy = true;
  $<HTMLButtonElement>('enter').disabled = true;
  setStatus('Recuperando tu lugar…');
  void client
    .reconnect(token)
    .then(bind)
    .catch(() => {
      sessionStorage.removeItem('bandera-token');
      setStatus('No pudimos recuperar la sesión. Entrá de nuevo o creá otra sala.', true);
    })
    .finally(() => {
      busy = false;
      $<HTMLButtonElement>('enter').disabled = false;
    });
}

interface RoomInfo {
  roomId: string;
  title: string;
  visibility: 'public' | 'private';
  passwordRequired: boolean;
  allowSpectators: boolean;
  spectators: number;
  maxSpectators: number;
  players: number;
  playerSlots: number;
  phase: string;
  score: Record<Team, number>;
  timeLeft: number;
  paused: boolean;
  names: string[];
}
let refreshingRooms = false;
async function refreshRooms() {
  if (room || practice || refreshingRooms) return;
  refreshingRooms = true;
  try {
    const url = new URL(endpoint.replace(/^ws/, 'http'));
    url.pathname = '/rooms';
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error();
    const rooms: RoomInfo[] = await response.json();
    $('rooms-list').replaceChildren();
    $('live-rooms-list').replaceChildren();
    $('live-empty').hidden = rooms.some((info) =>
      ['playing', 'capture', 'countdown'].includes(info.phase),
    );
    $('rooms-status').textContent = rooms.length
      ? 'Elegí una sala para jugar u observar.'
      : 'No hay salas públicas. ¡Creá la primera!';
    for (const info of rooms) {
      const live = ['playing', 'capture', 'countdown'].includes(info.phase);
      const card = document.createElement('article');
      card.className = 'room-list-card';
      card.dataset.roomId = info.roomId;
      if (live) {
        const badge = document.createElement('span');
        badge.className = 'live-badge';
        badge.textContent = info.paused ? '● EN PAUSA · RECONEXIÓN' : '● EN VIVO';
        card.append(badge);
      }
      const title = document.createElement('h3');
      title.textContent = info.title;
      const details = document.createElement('p');
      details.textContent = `${info.players}/${RULES.maxPlayers} jugadores · ${info.spectators}/5 espectadores · ${info.phase === 'lobby' ? 'Esperando jugadores' : info.phase === 'finished' ? 'Resultado' : 'En combate'}${info.passwordRequired ? ' · Con contraseña' : ''}`;
      card.append(title, details);
      if (live) {
        const score = document.createElement('p');
        score.className = 'live-score';
        const seconds = Math.ceil(info.timeLeft);
        score.textContent = `${info.names.join(' vs ')} · ${TEAMS.slice(0, info.names.length).map((team) => info.score[team]).join(' — ')} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        card.append(score);
      }
      const choose = (spectator: boolean) => {
        target = info.roomId;
        history.replaceState(null, '', `?sala=${target}`);
        entryMode();
        $('entry-title').textContent = info.title;
        $<HTMLInputElement>('spectator').checked = spectator;
        $('spectator').dispatchEvent(new Event('change'));
        $<HTMLInputElement>('room-password').value = '';
        $('entry-description').textContent = info.passwordRequired
          ? 'Ingresá el apodo y la contraseña de la sala.'
          : 'Ingresá tu apodo para entrar.';
        $('intro').scrollIntoView({ behavior: 'smooth' });
      };
      for (const spectator of live ? [true] : [false, true]) {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = spectator
          ? !info.allowSpectators
            ? 'Espectadores desactivados'
            : info.spectators >= 5
              ? 'Sin cupo de espectador'
              : live
                ? 'Ver combate'
                : 'Observar'
          : 'Jugar';
        button.disabled = spectator
          ? !info.allowSpectators || info.spectators >= 5
          : info.phase !== 'lobby' || info.playerSlots >= RULES.maxPlayers;
        button.onclick = () => choose(spectator);
        card.append(button);
      }
      $(live ? 'live-rooms-list' : 'rooms-list').append(card);
    }
  } catch {
    $('rooms-status').textContent =
      'No se pudo cargar el listado. El servidor puede estar despertando; probá actualizar.';
  } finally {
    refreshingRooms = false;
  }
}
$('refresh-rooms').onclick = () => void refreshRooms();
void refreshRooms();
setInterval(() => {
  if (!document.hidden) void refreshRooms();
}, 2000);

function startPractice() {
  if (room || busy || !arena.controls) return;
  unlockAudio();
  practice = new Practice(selectedClass, validName(nameInput.value) || 'Vos');
  arena.reset();
  arena.send = () => {};
  arena.localStep = (input) => {
    if (!practice) return;
    const snapshot = practice.step(input);
    arena.receive(snapshot, PRACTICE_PLAYER);
    render(snapshot);
  };
  $('intro').hidden = true;
  $('room-browser').hidden = true;
  $('guide').hidden = true;
  $('preview-tag').hidden = true;
  $('spectator-count').hidden = true;
  $('hud').hidden = false;
  $('practice-toolbar').hidden = false;
  $('connection-label').textContent = 'SIN CONEXIÓN AL SERVIDOR';
  document.body.classList.add('in-room', 'practicing');
  const snapshot = structuredClone(practice.duel.state);
  arena.receive(snapshot, PRACTICE_PLAYER);
  render(snapshot);
  $('stage').scrollIntoView({ block: 'center' });
}
$('practice-start').onclick = startPractice;
$('practice-reset').onclick = startPractice;
$('practice-exit').onclick = () => {
  practice = undefined;
  arena.reset();
  arena.send = () => {};
  document.body.classList.remove('in-room', 'practicing');
  for (const id of ['practice-toolbar', 'hud', 'overlay', 'cooldowns', 'announcement'])
    $(id).hidden = true;
  for (const id of ['intro', 'room-browser', 'guide', 'preview-tag', 'leave']) $(id).hidden = false;
  $('touch-controls').classList.remove('active');
  $('stage').dataset.role = 'preview';
  $('arena-label').textContent = 'EL PATIO DEL REY';
  $('connection-label').textContent = 'ACERO · ARCO · MAGIA';
  const preview = new Practice(selectedClass);
  preview.duel.state.phase = 'lobby';
  arena.receive(structuredClone(preview.duel.state), '');
  $('intro').scrollIntoView({ block: 'start' });
};
