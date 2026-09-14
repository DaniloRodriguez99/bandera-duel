import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import { RULES, CLASSES, validName, type Snapshot, type ClassId } from '@bandera/shared';
import { Arena } from './scene.js';
import { muted, toggleMute, unlockAudio } from './audio.js';
import { savedClass, saveClass, mountClasses, updateClasses } from './classes.js';
import './style.css';

document.querySelector('#app')!.innerHTML = `
<header class="topbar"><a class="brand" href="/" aria-label="Bandera Duel, inicio"><span class="brand-mark">⚑</span><span>BANDERA<span class="brand-thin"> DUEL</span><small>LA GLORIA NO SE HEREDA. SE ROBA.</small></span></a><div class="header-right"><span class="edition">PRIMERA EDICIÓN <b>01</b></span><button id="mute" class="icon-btn" aria-label="Silenciar sonido"></button></div></header>
<main>
<section id="intro" class="intro"><div class="hero-copy"><div class="eyebrow"><i></i> DUELO ONLINE · 1 CONTRA 1</div><h1>Tu rival tiene<br>algo <em>tuyo.</em></h1><p>Entrá al castillo. Robá su bandera.<br>Volvé con la gloria antes de que te alcancen.</p><div class="facts"><span><b>02</b> rivales</span><span><b>03</b> minutos</span><span><b>01</b> vencedor</span></div></div>
<div class="entry-card"><div class="card-top"><span class="tiny">EL DESAFÍO EMPIEZA ACÁ</span><span class="swords">⚔</span></div><h2 id="entry-title">Prepará tu estandarte.</h2><p id="entry-description">Creá una sala privada e invitá a tu rival.</p><form id="entry-form"><label for="name">TU APODO</label><input id="name" name="name" placeholder="Caballero sin nombre" maxlength="16" autocomplete="nickname" required><label id="spectator-choice" hidden><input id="spectator" type="checkbox"> Entrar como espectador</label><fieldset id="entry-class-picker" class="class-picker"><legend>ELEGÍ TU GUERRERO</legend><div id="entry-classes" class="class-grid"></div></fieldset><button id="enter" class="primary" type="submit">Crear un duelo <span>↗</span></button></form><div id="status" class="status" role="status" aria-live="polite">Sin cuentas. Sin descargas. Solo el duelo.</div><button id="new-instead" class="text-btn" hidden>Crear otra sala</button></div></section>
<section class="arena-section"><div class="arena-heading"><div><span class="live-dot"></span><span id="arena-label">EL PATIO DEL REY</span><span class="map-label">ARENA 01</span></div><span id="connection-label">ACERO · ARCO · MAGIA</span></div>
<div id="hud" class="hud" hidden><div class="team blue"><span>◆ AZUR</span><b id="score-blue">0</b><small id="flag-blue">En base</small></div><div class="clock"><span id="timer">3:00</span><small>PRIMERO A 3</small></div><div class="team red"><small id="flag-red">En base</small><b id="score-red">0</b><span>CARMESÍ ✚</span></div></div>
<div id="stage" class="stage"><div id="game"></div><div class="preview-tag" id="preview-tag">DOS ESTANDARTES. UN SOLO CAMINO A LA VICTORIA.</div>
<div id="overlay" class="overlay" hidden><div class="overlay-card"><span id="overlay-kicker" class="tiny">SALA PRIVADA</span><h2 id="overlay-title">Esperando a tu rival</h2><p id="overlay-description"></p><div id="roster" class="roster"></div><fieldset id="room-picker" class="class-picker compact"><legend>TU CLASE · PODÉS CAMBIAR ANTES DE JUGAR</legend><div id="room-classes" class="class-grid"></div></fieldset><p id="selection-status" role="status" hidden></p><div id="invitation"><label for="invite">LINK DE INVITACIÓN</label><div class="invite-row"><input id="invite" readonly aria-label="Link de invitación"><button id="copy" class="secondary">Copiar</button></div></div><button id="ready" class="primary">Estoy listo <span>⚔</span></button><button id="leave" class="text-btn">Salir de la sala</button></div></div>
<div id="announcement" class="announcement" hidden aria-live="polite"></div>
<div id="touch-controls"><div id="stick-move" class="stick" aria-label="Mover"><span></span><small>MOVER</small></div><div class="touch-right"><button id="touch-sword" class="touch-action" aria-label="Espada">⚔</button><button id="touch-guard" class="touch-action" aria-label="Mantener escudo" hidden>⛨</button><button id="touch-dash" class="touch-action" aria-label="Dash">➟</button><div id="stick-aim" class="stick" aria-label="Apuntar y soltar para disparar"><span></span><small>APUNTAR</small></div></div></div></div>
<div class="arena-bottom"><span id="arena-hint">Robá la bandera rival y traela a tu base. La tuya debe estar en casa.</span><div id="cooldowns" hidden><span id="health" aria-label="Vida"></span><span id="cd-sword"></span><span id="cd-shot"></span><span id="cd-dash"></span><span id="cd-guard" hidden></span></div><span class="corner-detail">◆ &nbsp; VS &nbsp; ✚</span></div></section>
<section id="guide" class="guide"><article><span class="step">01 / ROBÁ</span><h3>Entrá en terreno rival.</h3><p>Tocá su bandera para llevarla. Podés pelear mientras la transportás.</p></article><article><span class="step">02 / RESISTÍ</span><h3>Un golpe cambia todo.</h3><p>Si te hieren, soltás la bandera. Recuperá la tuya con solo tocarla.</p></article><article><span class="step">03 / VOLVÉ</span><h3>Tu base. Tu victoria.</h3><p>Capturá con tu bandera en casa. Tres capturas deciden el duelo.</p></article></section>
<div id="control-guide" class="control-guide"></div>
</main><footer><span>BANDERA DUEL <b> / </b> HECHO PARA LA REVANCHA.</span><span>1V1 · V0.1</span></footer><div id="rotate"><span>↻</span><h2>Giralo para el duelo.</h2><p>La arena se juega con el celular horizontal.</p></div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const arena = new Arena();
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
mountClasses($('entry-classes'), selectedClass, id => {
  selectedClass=id;saveClass(id);updateClasses($('entry-classes'),id);showClassControls(id);
});
mountClasses($('room-classes'),selectedClass,id=>room?.send('selectClass',id));
let displayedClass: ClassId | undefined;
function showClassControls(id:ClassId) {
  if(displayedClass===id)return;
  displayedClass=id;
  const stats=CLASSES[id],ranged=stats.ranged,guardian=id==='guardian',mage=id==='mage';
  const projectile=mage?'Hechizo':'Flecha',melee=mage?'Báculo':'Daga';
  $('touch-dash').hidden=!stats.dash;$('touch-guard').hidden=!stats.shield;
  $('touch-sword').textContent=ranged?(mage?'✦':'†'):'⚔';
  $('touch-sword').setAttribute('aria-label',ranged?melee:id==='vanguard'?'Espada pesada':'Espada');
  $('stick-aim').setAttribute('aria-label',ranged?`Apuntar y soltar ${mage?'el hechizo':'para disparar'}`:'Apuntar');
  $('cd-shot').hidden=!ranged;$('cd-dash').hidden=!stats.dash;$('cd-guard').hidden=!stats.shield;
  $('control-guide').innerHTML=`<span><kbd>W A S D</kbd> Mover</span><span><kbd>CLIC</kbd> ${ranged?projectile:'Espada'}</span>${id!=='vanguard'?`<span><kbd>CLIC DER.</kbd> ${ranged?melee:'Mantener escudo'}</span>`:''}${stats.dash?'<span><kbd>ESPACIO</kbd> Esquivar</span>':''}<span class="mobile-help">${ranged?`Mové a la izquierda. Apuntá y soltá a la derecha para lanzar ${mage?'magia':'una flecha'}. Botones de ${melee.toLowerCase()} y dash.`:guardian?'Mové y apuntá con las palancas. Golpeá con espada o mantené pulsado el escudo.':'Mové y apuntá con las palancas. El botón de espada prepara un golpe pesado.'}</span>`;
}
showClassControls(selectedClass);
function entryMode() {
  $('spectator-choice').hidden = !target;
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
  $('preview-tag').hidden = true;
  $('hud').hidden = false;
  $('guide').hidden = true;
  document.body.classList.add('in-room');
  $<HTMLInputElement>('invite').value = location.href;
  room.onMessage('snapshot', (s: Snapshot) => {
    current = s;
    arena.receive(s, joined.sessionId);
    render(s);
  });
  room.onMessage('selectionError', (message:string) => { $('selection-status').hidden=false;$('selection-status').textContent=message; });
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
    if (online && current?.players.some(p => p.id === joined.sessionId)) joined.send('input', input);
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
      ? await client.joinById(target, { name, classId:selectedClass, spectator: $<HTMLInputElement>('spectator').checked })
      : await client.create('duel', { name, classId:selectedClass });
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
  $('spectator-choice').hidden = true;
  $<HTMLInputElement>('spectator').checked = false;
  $('entry-class-picker').hidden = false;
  history.replaceState(null, '', location.pathname);
  $('entry-title').textContent = 'Prepará tu estandarte.';
  $('entry-description').textContent = 'Creá una sala privada e invitá a tu rival.';
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
  if (!room) return;
  const me = s.players.find((p) => p.id === room!.sessionId);
  $('score-blue').textContent = String(s.score.blue);
  $('score-red').textContent = String(s.score.red);
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
    ? `JUGÁS PARA ${me.team === 'blue' ? '◆ AZUR' : '✚ CARMESÍ'}`
    : 'ESPECTADOR · VISTA DEL DUELO';
  $('stage').dataset.phase = s.phase;
  const overlay = s.phase === 'lobby' || s.phase === 'finished';
  $('overlay').hidden = !overlay;
  $('touch-controls').classList.toggle('active', !!me && s.phase === 'playing' && !s.paused);
  $('cooldowns').hidden = !me || s.phase !== 'playing';
  $('room-picker').hidden = !me || !overlay;
  $('control-guide').hidden = !me;
  $('stage').dataset.role = me ? 'player' : 'spectator';
  if (me) {
    selectedClass=me.classId;saveClass(me.classId);showClassControls(me.classId);
    updateClasses($('room-classes'),me.classId,!overlay||s.paused);
    $('room-picker').hidden=!overlay;
    $('stage').dataset.class=me.classId;
    $('stage').dataset.guarding=String(me.guarding);
    $('stage').dataset.dashing=String(me.dashInvulnerable);
    $('health').textContent=`♥ ${me.hp}/${me.maxHp}`;
    $('health').setAttribute('aria-label',`Vida: ${me.hp} de ${me.maxHp}`);
    $('cd-guard').textContent=me.guarding?`⛨ Cubriendo ${me.guardLeft.toFixed(1)}s`:`⛨ ${me.guardCd>0?me.guardCd.toFixed(1)+'s':'Listo'}`;
    $('cd-sword').textContent = `⚔ ${me.swordCd > 0 ? me.swordCd.toFixed(1) + 's' : 'Lista'}`;
    $('cd-shot').textContent = `${me.classId==='mage'?'✦':'➶'} ${me.shotCd > 0 ? me.shotCd.toFixed(1) + 's' : 'Lista'}`;
    $('cd-dash').textContent = `➟ ${me.dashCd > 0 ? me.dashCd.toFixed(1) + 's' : 'Listo'}`;
  }
  $('arena-hint').textContent = s.flags.some((f) => f.carrier === me?.id)
    ? '¡Tenés la bandera! Volvé a tu base.'
    : me?.hp === 0
      ? `Reaparecés en ${Math.ceil(me.respawnLeft)} s`
      : 'Robá la bandera rival. Recuperá la tuya. Volvé a casa.';
  if (overlay) {
    $('overlay-kicker').textContent =
      s.phase === 'finished' ? 'EL DUELO TERMINÓ' : 'SALA PRIVADA · 1V1';
    $('overlay-title').textContent =
      s.phase === 'finished'
        ? s.winner === 'draw'
          ? 'Un duelo a la altura.'
          : s.winner === me?.team
            ? 'La gloria es tuya.'
            : 'Esta vez, ganó tu rival.'
        : s.players.length < 2
          ? 'Falta tu rival.'
          : 'El duelo está servido.';
    $('overlay-description').textContent =
      s.phase === 'finished'
        ? s.reason === 'abandono'
          ? 'El rival abandonó la partida.'
          : `${s.score.blue} — ${s.score.red}. ¿Otra ronda?`
        : 'Compartí el link. Cuando estén listos, empieza la batalla.';
    const roster = $('roster');
    roster.replaceChildren();
    for (const team of ['blue', 'red']) {
      const p = s.players.find((p) => p.team === team),
        row = document.createElement('div');
      row.className = `roster-player ${team}`;
      const title = document.createElement('span');
      title.textContent = `${team === 'blue' ? '◆' : '✚'} ${p?.name || 'Esperando rival…'}${p?' · '+CLASSES[p.classId].name:''}`;
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
    $('invitation').hidden = s.phase !== 'lobby';
    $('ready').hidden = !me || s.phase === 'finished' && s.players.some((p) => !p.connected);
    $<HTMLButtonElement>('ready').disabled = s.paused || s.players.length < 2;
    $('ready').textContent = me?.ready
      ? 'Listo ✓ · Esperando rival'
      : s.phase === 'finished'
        ? 'Quiero revancha ↗'
        : 'Estoy listo ⚔';
  }
  if (!me) {
    $('arena-hint').textContent = 'Estás observando. Los jugadores deciden cuándo empezar y pedir revancha.';
    if (overlay) {
      $('overlay-title').textContent = s.phase === 'finished'
        ? s.winner === 'draw' ? 'Empate.' : `Ganó ${s.winner === 'blue' ? 'Azur' : 'Carmesí'}.`
        : 'Esperando a los jugadores';
      $('overlay-description').textContent = s.phase === 'finished'
        ? `${s.score.blue} — ${s.score.red}. Esperando una nueva ronda.`
        : 'Estás como espectador. La partida empieza cuando ambos estén listos.';
    }
  }
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
