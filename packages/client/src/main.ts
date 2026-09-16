import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import {
  RULES,
  chargePower,
  CLASSES,
  TEAMS,
  TEAM_NAMES,
  TEAM_ICONS,
  MAPS,
  MODE_INFO,
  validName,
  defaultCustomization,
  activePreset,
  type Snapshot,
  type ClassId,
  type Team,
  type MapId,
  type GameMode,
  type ChatMessage,
  type ChatHistory,
  type ChatStatus,
  type RoomClosingReason,
  type CharacterCustomization,
  type UpgradeOffer,
  type UpgradeId,
} from '@bandera/shared';
import { Arena } from './scene.js';
import {
  muted,
  toggleMute,
  unlockAudio,
  musicVolume,
  setMusicVolume,
  setMusicMode,
} from './audio.js';
import { savedClass, saveClass, mountClasses, updateClasses, updateMageSkin } from './classes.js';
import { updateAbilities } from './abilities.js';
import { mountTouchAbilities, updateTouchAbilities } from './mobile-controls.js';
import './style.css';
import { Practice, PRACTICE_PLAYER } from './practice.js';
import { loadMageCustomization, mountMageCustomization } from './customization.js';
import { UPGRADE_META, UPGRADE_ORDER } from './pve-upgrades.js';
import { WorldHud } from './isekai-hud.js';
import { zone, type ZoneId } from '@bandera/shared/rpg/zones';
import type { CastSlot, Character, Creation, Notice } from '@bandera/shared/world';

function hudTeam(team: Team, right = false) {
  const label = right
    ? `${TEAM_NAMES[team]} ${TEAM_ICONS[team]}`
    : `${TEAM_ICONS[team]} ${TEAM_NAMES[team]}`;
  const parts = [
    `<span>${label}</span>`,
    `<b id="score-${team}">0</b>`,
    `<small id="flag-${team}">En base</small>`,
  ];
  return `<div id="team-${team}" class="team ${team}"${team === 'blue' || team === 'red' ? '' : ' hidden'}>${(right ? parts.reverse() : parts).join('')}</div>`;
}
document.querySelector('#app')!.innerHTML = `
<header class="topbar"><a class="brand" href="/" aria-label="Bandera Duel, inicio"><span class="brand-mark">⚑</span><span>BANDERA<span class="brand-thin"> DUEL</span><small>LA GLORIA NO SE HEREDA. SE ROBA.</small></span></a><div class="header-right"><span class="edition">PRIMERA EDICIÓN <b>01</b></span><button id="mute" class="icon-btn" aria-label="Silenciar sonido"></button></div></header>
<main>
<section id="intro" class="intro"><div class="hero-copy"><div class="eyebrow"><i></i> DUELO ONLINE · HASTA 4 JUGADORES</div><h1>Tu rival tiene<br>algo <em>tuyo.</em></h1><p>Entrá al castillo. Robá su bandera.<br>Volvé con la gloria antes de que te alcancen.</p><div class="facts"><span><b>04</b> jugadores</span><span><b>03</b> minutos</span><span><b>01</b> vencedor</span></div></div>
<div class="entry-card"><div class="card-top"><span class="tiny">EL DESAFÍO EMPIEZA ACÁ</span><span class="swords">⚔</span></div><h2 id="entry-title">Prepará tu estandarte.</h2><p id="entry-description">Elegí tu guerrero, prepará una sala e invitá a tu rival.</p><form id="entry-form"><div class="player-setup"><div class="setup-heading"><span>01</span><h3>Tu guerrero</h3></div><label for="name">TU APODO</label><input id="name" name="name" placeholder="Caballero sin nombre" maxlength="16" autocomplete="nickname" required><fieldset id="world-account" class="world-account" hidden><legend>TU CUENTA DEL MUNDO</legend><p class="world-hint">El mundo guarda tus personajes. Entrá con tu cuenta o creá una nueva.</p><label for="world-user">CUENTA</label><input id="world-user" maxlength="16" autocomplete="username" placeholder="Tu nombre de cuenta"><label for="world-pass">CLAVE</label><input id="world-pass" type="password" minlength="6" maxlength="64" autocomplete="current-password" placeholder="Al menos 6 caracteres"><label class="check"><input id="world-new" type="checkbox"> Es mi primera vez, crear la cuenta</label><div id="world-characters" class="world-characters" hidden></div></fieldset><fieldset id="entry-class-picker" class="class-picker"><legend>ELEGÍ TU GUERRERO</legend><div id="entry-classes" class="class-grid"></div></fieldset></div><div class="room-setup"><div class="setup-heading"><span>02</span><h3>Tu próxima partida</h3></div><fieldset id="room-options"><legend>TU SALA</legend><label for="room-title">TÍTULO</label><input id="room-title" maxlength="48" value="Duelo medieval"><label for="visibility">VISIBILIDAD</label><select id="visibility"><option value="private">Privada · solo por enlace</option><option value="public">Pública · aparece en el listado</option></select><div class="option-row"><label>FORMATO<select id="game-mode"><option value="duel">Duelo · 1v1</option><option value="teams">Equipos · 2v2</option><option value="ffa3">Todos contra todos · 3</option><option value="ffa4">Todos contra todos · 4</option><option value="pve">Hordas PvE · 1–4</option><option value="world">Mundo isekai · abierto</option></select></label><label>MAPA<select id="map-select"><option value="courtyard">Patio del Rey</option><option value="forest">Bosque de Emboscadas</option><option value="ruins">Ruinas del Bastión</option><option value="crossroads">Encrucijada</option></select></label></div><div id="map-preview" class="map-preview"></div><label class="check-option"><input id="allow-spectators" type="checkbox" checked> Permitir espectadores (máximo 5)</label></fieldset><label for="room-password">CONTRASEÑA (OPCIONAL)</label><input id="room-password" type="password" maxlength="64" autocomplete="off" placeholder="Sin contraseña"><label id="spectator-choice" hidden><input id="spectator" type="checkbox"> Entrar como espectador</label><label id="perspective-choice" hidden>PERSPECTIVA<select id="spectator-perspective"><option value="blue">Azul</option><option value="red">Carmesí</option><option value="green">Jade</option><option value="violet">Violeta</option></select></label></div><div class="entry-actions"><button id="enter" class="primary" type="submit">Crear un duelo <span>↗</span></button><button id="practice-start" class="secondary" type="button">Probar contra un rival inmóvil</button><span class="entry-note">Práctica local, sin sala.</span></div></form><div id="status" class="status" role="status" aria-live="polite">Sin cuentas. Sin descargas. Solo el duelo.</div><button id="new-instead" class="text-btn" hidden>Crear otra sala</button></div></section>
<section id="room-browser" class="room-browser"><div class="browser-heading"><div><span class="tiny">BUSCÁ TU PRÓXIMO RIVAL</span><h2>Salas públicas</h2></div><button id="refresh-rooms" class="secondary">↻ Actualizar salas</button></div><p id="rooms-status" role="status"></p><h3 class="room-group-title">● Combates en vivo</h3><p id="live-empty">No hay combates públicos en curso.</p><div id="live-rooms-list"></div><h3 class="room-group-title">Salas para jugar y próximas rondas</h3><div id="rooms-list"></div></section><section class="arena-section"><div class="arena-heading"><div><span class="live-dot"></span><span id="arena-label">EL PATIO DEL REY</span><span class="map-label">ARENA 01</span></div><span id="connection-label">ACERO · ARCO · MAGIA</span></div>
<div id="practice-toolbar" hidden><span>PRÁCTICA · RIVAL INMÓVIL</span><button id="practice-reset" class="secondary">Reiniciar</button><button id="practice-exit" class="secondary">Salir</button></div><div id="hud" class="hud" hidden>${hudTeam('blue')}${hudTeam('green')}<div class="clock"><span id="timer">3:00</span><small id="clock-note">PRIMERO A 3</small></div>${hudTeam('violet', true)}${hudTeam('red', true)}<span id="spectator-count" hidden aria-live="polite"></span><div id="pve-hud" hidden><b id="pve-wave">OLEADA 0</b><span id="pve-enemies">0 enemigos</span><span id="pve-alive"></span></div><div id="pve-upgrades" hidden aria-label="Mejoras elegidas"></div><div id="boss-hud" hidden><span>GUARDIÁN DE LA CRIPTA</span><i><b id="boss-health"></b></i></div><div id="mobile-player-status" hidden><b id="mobile-health"></b><span id="mobile-state"></span></div></div>
<div id="stage" class="stage"><section id="pve-rewards" class="pve-rewards" hidden><header><span id="reward-wave"></span><b id="reward-time"></b></header><p>Elegí una recompensa. Si el tiempo termina, no recibirás ninguna.</p><div id="reward-cards"></div></section><label id="room-perspective-choice" hidden>PERSPECTIVA<select id="room-perspective"></select></label><div id="game"></div><div id="abilities" class="abilities" hidden aria-label="Habilidades"></div><div class="preview-tag" id="preview-tag">HASTA CUATRO ESTANDARTES. UNA SOLA GLORIA.</div>
<button id="chat-toggle" class="chat-toggle" type="button" hidden aria-expanded="false" aria-controls="chat-panel"><span aria-hidden="true">◈</span><span class="chat-label">CHAT</span><b id="chat-unread" hidden></b></button>
<aside id="chat-panel" class="chat-panel" hidden aria-label="Chat de sala"><header><div><span>CHAT DE SALA</span><small id="chat-players"></small></div><button id="chat-close" type="button" aria-label="Cerrar chat">×</button></header><ol id="chat-messages" role="log" aria-live="polite"></ol><p id="chat-status" role="status"></p><form id="chat-form"><input id="chat-input" maxlength="240" autocomplete="off" placeholder="Escribí un mensaje…" aria-label="Mensaje"><button id="chat-send" type="submit">Enviar</button></form></aside>
<div id="overlay" class="overlay" hidden><div class="overlay-card"><span id="overlay-kicker" class="tiny">SALA</span><h2 id="overlay-title">Esperando jugadores</h2><p id="overlay-description"></p><p id="room-heading"></p><div id="roster" class="roster"></div><label id="team-choice" hidden>TU EQUIPO<select id="team-select"><option value="blue">Azul</option><option value="red">Carmesí</option></select></label><fieldset id="room-picker" class="class-picker compact"><legend>TU CLASE · PODÉS CAMBIAR ANTES DE JUGAR</legend><div id="room-classes" class="class-grid"></div></fieldset><p id="selection-status" role="status" hidden></p><div id="invitation"><label for="invite">LINK DE INVITACIÓN</label><div class="invite-row"><input id="invite" readonly aria-label="Link de invitación"><button id="copy" class="secondary">Copiar</button></div></div><button id="ready" class="primary">Estoy listo <span>⚔</span></button><button id="pve-start" class="primary" hidden>Comenzar expedición ↗</button><button id="leave" class="text-btn">Salir de la sala</button></div></div>
<div id="announcement" class="announcement" hidden aria-live="polite"></div>
<div id="touch-controls"><div id="stick-move" class="stick" aria-label="Mover"><span></span><small>MOVER</small></div><div id="touch-actions" class="touch-actions" aria-label="Habilidades táctiles"></div></div></div>
<div class="arena-bottom"><span id="arena-hint">Robá la bandera rival y traela a tu base. La tuya debe estar en casa.</span><div id="cooldowns" hidden><span id="health" aria-label="Vida"></span><span id="lives" aria-label="Muertes"></span><span id="stealth-state"></span><span id="cd-sword"></span><span id="cd-shot"></span><span id="cd-dash"></span><span id="cd-guard" hidden></span><span id="cd-trap" hidden></span><span id="cd-volley" hidden></span><span id="cd-summon" hidden></span></div><span class="corner-detail">◆ &nbsp; ✚ &nbsp; ▲ &nbsp; ●</span></div></section>
<section id="guide" class="guide"><article><span class="step">01 / ROBÁ</span><h3>Entrá en terreno rival.</h3><p>Tocá su bandera para llevarla. Podés pelear mientras la transportás.</p></article><article><span class="step">02 / RESISTÍ</span><h3>Un golpe cambia todo.</h3><p>Si te hieren, soltás la bandera. Recuperá la tuya con solo tocarla.</p></article><article><span class="step">03 / VOLVÉ</span><h3>Tu base. Tu victoria.</h3><p>Capturá con tu bandera en casa. Tres capturas deciden la partida; las reapariciones son ilimitadas.</p></article></section>
<div id="control-guide" class="control-guide"></div>
</main><footer><span>BANDERA DUEL <b> / </b> HECHO PARA LA REVANCHA.</span><span>HASTA 4 · V0.1</span></footer><div id="customization" class="customization" hidden></div><div id="rotate"><span>↻</span><h2>Giralo para el duelo.</h2><p>La arena se juega con el celular horizontal.</p></div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const arena = new Arena();
$('cooldowns').insertAdjacentHTML('beforeend', '<span id="cd-ice" hidden></span>');
/** A key or a tap on a skill slot: cast it at wherever the character is aiming right now. */
const castSlot = (slot: CastSlot) => {
  if (!room || !online || !worldCharacterId) return;
  room.send('cast', { slot, aimX: arena.controls?.aimX ?? 0, aimY: arena.controls?.aimY ?? 0 });
};
const worldHud = new WorldHud($('stage'), {
  cast: castSlot,
  learn: (skillId, nodeId) => room?.send('learn', { skillId, nodeId }),
  slot: (slot, skillId) => room?.send('slot', { slot, skillId }),
  spend: (stat) => room?.send('spendPoint', { stat }),
});
window.addEventListener('keydown', (event) => {
  if (!worldCharacterId || (event.target as HTMLElement)?.matches?.('input, textarea, select')) return;
  if (event.code === 'KeyK' && !event.repeat) worldHud.togglePanel();
  if (event.code === 'Escape' && worldHud.panelOpen) worldHud.togglePanel(false);
});
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  pixelArt: true,
  antialias: false,
  backgroundColor: '#23362f',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
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
let selectedMap = (localStorage.getItem('bandera-map') as MapId) || 'courtyard';
if (!MAPS[selectedMap]) selectedMap = 'courtyard';
$<HTMLSelectElement>('map-select').value = selectedMap;
function updateMapPreview() {
  const map = MAPS[selectedMap];
  const mode = $<HTMLSelectElement>('game-mode').value as GameMode;
  const teams: Team[] =
    mode === 'pve'
      ? []
      : mode === 'ffa4'
        ? ['blue', 'red', 'green', 'violet']
        : mode === 'ffa3'
          ? ['blue', 'red', 'green']
          : ['blue', 'red'];
  const homes = mode.startsWith('ffa') ? map.cornerHomes : map.sideHomes;
  const walls = map.walls
    .map(
      (wall) =>
        `<g class="preview-wall"><rect x="${wall.x}" y="${wall.y}" width="${wall.w}" height="${wall.h}" rx="4"/><path d="M${wall.x + 5} ${wall.y + 8}h${Math.max(0, wall.w - 10)}M${wall.x + 5} ${wall.y + wall.h - 8}h${Math.max(0, wall.w - 10)}"/></g>`,
    )
    .join('');
  const bushes = map.bushes
    .map(
      (bush) =>
        `<g class="preview-bush"><rect x="${bush.x}" y="${bush.y}" width="${bush.w}" height="${bush.h}" rx="16"/><circle cx="${bush.x + bush.w * 0.28}" cy="${bush.y + bush.h * 0.45}" r="${Math.min(bush.h, bush.w) * 0.22}"/><circle cx="${bush.x + bush.w * 0.65}" cy="${bush.y + bush.h * 0.55}" r="${Math.min(bush.h, bush.w) * 0.26}"/></g>`,
    )
    .join('');
  const bases = teams
    .map((team) => {
      const home = homes[team as keyof typeof homes];
      return `<g class="preview-base ${team}" transform="translate(${home.x} ${home.y})"><circle r="34"/><circle r="22"/><path d="M0 18V-22M1-21l24 8-24 9z"/></g>`;
    })
    .join('');
  const pveMarkers =
    mode === 'pve'
      ? `${map.pveSpawns.map((spawn) => `<circle class="preview-mob-spawn" cx="${spawn.x}" cy="${spawn.y}" r="10"/>`).join('')}<g class="preview-base blue" transform="translate(${map.sideHomes.blue.x} ${map.sideHomes.blue.y})"><circle r="34"/><circle r="22"/><path d="M-12 6h24M0-12v30"/></g>`
      : '';
  $('map-preview').className = `map-preview ${map.theme}`;
  $('map-preview').innerHTML =
    `<svg class="map-mini" viewBox="0 0 960 540" role="img" aria-label="Vista táctica de ${map.name}"><defs><pattern id="floor-${map.id}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0v40"/></pattern></defs><rect class="preview-floor" width="960" height="540"/><rect class="preview-grid" width="960" height="540" fill="url(#floor-${map.id})"/><path class="preview-axis" d="M480 0v540M0 270h960"/>${bushes}${walls}<circle class="preview-center" cx="480" cy="270" r="42"/>${bases}${pveMarkers}<rect class="preview-frame" x="5" y="5" width="950" height="530" rx="8"/></svg><span class="map-copy"><strong>${map.name}</strong><span>${map.description}</span><small>${mode === 'pve' ? 'Campamento cooperativo · entradas de horda' : map.bushes.length ? `${map.bushes.length} zonas de arbustos · sigilo activo` : 'Arena abierta · sin arbustos'} · ${map.walls.length} coberturas</small></span>`;
  if (!target) {
    $('entry-title').textContent =
      mode === 'pve' ? 'Prepará la expedición.' : 'Prepará tu estandarte.';
    $('entry-description').textContent =
      mode === 'pve'
        ? 'Jugá solo o invitá hasta tres aliados. Podés empezar sin llenar la sala.'
        : 'Elegí tu guerrero, prepará una sala e invitá a tu rival.';
    $('enter').innerHTML =
      mode === 'pve' ? 'Crear expedición <span>↗</span>' : 'Crear un duelo <span>↗</span>';
  }
}
$<HTMLSelectElement>('map-select').onchange = (event) => {
  selectedMap = (event.target as HTMLSelectElement).value as MapId;
  localStorage.setItem('bandera-map', selectedMap);
  updateMapPreview();
};
$<HTMLSelectElement>('game-mode').addEventListener('change', updateMapPreview);
updateMapPreview();
let selectedClass = savedClass();
let mageCustomization: CharacterCustomization = loadMageCustomization();
const customizer = mountMageCustomization($('customization'), mageCustomization, (value) => {
  mageCustomization = value;
  updateMageSkin($('entry-classes'), value.selectedSkin);
  updateMageSkin($('room-classes'), value.selectedSkin);
  arena.controls.configure('mage', value);
  if (
    room &&
    current?.players.some((player) => player.id === room!.sessionId && player.classId === 'mage') &&
    ['lobby', 'finished'].includes(current.phase)
  )
    room.send('selectCustomization', value);
});
mountClasses(
  $('entry-classes'),
  selectedClass,
  (id) => {
    selectedClass = id;
    saveClass(id);
    updateClasses($('entry-classes'), id);
    showClassControls(id);
  },
  () => customizer.open(),
);
mountClasses(
  $('room-classes'),
  selectedClass,
  (id) => {
    room?.send('selectClass', id);
    if (id === 'mage') room?.send('selectCustomization', mageCustomization);
  },
  () => customizer.open(),
);
updateMageSkin($('entry-classes'), mageCustomization.selectedSkin);
updateMageSkin($('room-classes'), mageCustomization.selectedSkin);
let displayedClass: ClassId | undefined;
function showClassControls(id: ClassId) {
  if (displayedClass === id) return;
  displayedClass = id;
  const stats = CLASSES[id];
  const ranged = stats.ranged;
  const guardian = id === 'guardian';
  const mage = id === 'mage';
  mountTouchAbilities($('touch-actions'), id);
  $('cd-ice').hidden = !mage;
  $('cd-shot').hidden = !ranged;
  $('cd-dash').hidden = !stats.dash;
  $('cd-guard').hidden = !stats.shield && !mage;
  $('cd-trap').hidden = id !== 'archer';
  $('cd-volley').hidden = id !== 'archer';
  $('cd-summon').hidden = !stats.summon;
  $('cd-sword').hidden = !stats.melee;
  const projectile = mage ? 'Bola de fuego' : id === 'necromancer' ? 'Fuego' : 'Flecha';
  const melee = mage ? 'Báculo' : 'Daga';
  const secondary = stats.summon ? 'Invocar zombies' : ranged ? melee : 'Mantener escudo';
  $('control-guide').innerHTML =
    `<span><kbd>W A S D</kbd> Mover</span><span><kbd>CLIC</kbd> ${ranged ? projectile : 'Espada'}</span>${id !== 'vanguard' ? `<span><kbd>CLIC DER.</kbd> ${secondary}</span>` : ''}${stats.dash ? `<span><kbd>ESPACIO</kbd> ${guardian ? 'Embestida' : 'Esquivar'}</span>` : ''}<span class="mobile-help">Mové con la palanca izquierda. Tocá una habilidad para usar la dirección actual, o arrastrá su botón para apuntar. Volvé al centro antes de soltar para cancelar.</span>`;
  if (id === 'archer')
    $('control-guide').innerHTML +=
      '<span><kbd>MANTENER CLIC</kbd> Cargar flecha · 0,8 s</span><span><kbd>Q</kbd> Trampa</span><span><kbd>E</kbd> Triple</span>';
  if (mage)
    $('control-guide').innerHTML +=
      '<span><kbd>CLIC CENTRAL</kbd> Hielo</span><span><kbd>CLIC DER.</kbd> Escudo mágico</span>';
  if (stats.summon)
    $('control-guide').innerHTML +=
      '<span><kbd>ESPACIO</kbd> Invocar zombies</span><span><kbd>E</kbd> Mando</span><span><kbd>CTRL E</kbd> Marcar</span>';
  if (!ranged) $('control-guide').innerHTML += '<span><kbd>MANTENER CLIC</kbd> Cargar golpe</span>';
  if (stats.dash && !guardian)
    $('control-guide').innerHTML += '<span><kbd>MANTENER ESPACIO</kbd> Dash más largo</span>';
  if (guardian)
    $('control-guide').innerHTML +=
      '<span><kbd>Q</kbd> Golpe de escudo</span><span><kbd>E</kbd> Furia</span>';
  if (id === 'vanguard')
    $('control-guide').innerHTML +=
      '<span><kbd>Q</kbd> Tajo viajero</span><span><kbd>E</kbd> Contraataque</span>';
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
  $('perspective-choice').hidden = !watching;
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
let chatOpen = false;
let chatUnread = 0;
let chatClosedReason: RoomClosingReason | undefined;
let chatEnabled = false;
let latestRoomInfo: RoomInfo | undefined;
let currentOffer: UpgradeOffer | null = null;
function updateUnread() {
  const badge = $('chat-unread');
  badge.hidden = chatUnread === 0;
  badge.textContent = chatUnread > 99 ? '99+' : String(chatUnread);
}
function setChatOpen(open: boolean) {
  chatOpen = open;
  $('chat-panel').hidden = !open;
  $('chat-toggle').setAttribute('aria-expanded', String(open));
  if (open) {
    chatUnread = 0;
    updateUnread();
    $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
  }
}
function resetChat() {
  chatClosedReason = undefined;
  chatEnabled = false;
  chatUnread = 0;
  $('chat-messages').replaceChildren();
  updateUnread();
  setChatOpen(false);
  $('chat-toggle').hidden = true;
}
function renderChatStatus(status: ChatStatus) {
  chatEnabled = status.enabled && !chatClosedReason;
  $<HTMLInputElement>('chat-input').disabled = !chatEnabled;
  $<HTMLButtonElement>('chat-send').disabled = !chatEnabled;
  $('chat-players').textContent =
    `${status.connectedPlayers} jugador${status.connectedPlayers === 1 ? '' : 'es'} conectado${status.connectedPlayers === 1 ? '' : 's'}`;
  $('chat-status').textContent = chatClosedReason
    ? chatClosedReason === 'inactive'
      ? 'La sala se cerró por inactividad. El chat quedó en modo lectura.'
      : 'La sala se cerró porque no quedan jugadores. El chat quedó en modo lectura.'
    : chatEnabled
      ? ''
      : 'El chat se habilita cuando haya al menos 2 jugadores';
}
function appendChat(message: ChatMessage, ownSession: string) {
  const item = document.createElement('li');
  item.className =
    message.senderId === ownSession
      ? 'chat-own'
      : message.role === 'spectator'
        ? 'chat-spectator'
        : '';
  const head = document.createElement('div'),
    name = document.createElement('strong'),
    role = document.createElement('small'),
    time = document.createElement('time'),
    body = document.createElement('p');
  name.textContent = message.name;
  role.textContent = message.role === 'spectator' ? 'ESPECTADOR' : 'JUGADOR';
  time.dateTime = new Date(message.sentAt).toISOString();
  time.textContent = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(
    message.sentAt,
  );
  body.textContent = message.text;
  head.append(name, role, time);
  item.append(head, body);
  $('chat-messages').append(item);
  while ($('chat-messages').children.length > RULES.chatHistoryLimit)
    $('chat-messages').firstElementChild?.remove();
  if (chatOpen) $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
  else if (message.senderId !== ownSession) {
    chatUnread++;
    updateUnread();
  }
}
function renderPveUpgrades(player: Snapshot['players'][number] | undefined, active: boolean) {
  const panel = $('pve-upgrades');
  const stacks = player?.pve?.stacks;
  const entries = UPGRADE_ORDER.map((id) => [id, stacks?.[id] ?? 0] as const).filter(
    ([, count]) => count > 0,
  );
  panel.hidden = !active || entries.length === 0;
  panel.replaceChildren();
  if (panel.hidden) return;
  /*for (const [id, count] of entries) {
    const meta = UPGRADE_META[id];
    const item = document.createElement('span');
    item.className = 'pve-upgrade-chip';
    item.title = `${meta.title} x${count}: ${meta.short}`;
    item.setAttribute('aria-label', `${meta.title} rango ${count}`);
    const icon = document.createElement('img');
    const label = document.createElement('b');
    icon.src = meta.icon;
    icon.alt = '';
    label.textContent = `x${count}`;
    item.append(icon, label);
    panel.append(item);
  }*/
}
$('chat-toggle').onclick = () => setChatOpen(!chatOpen);
$('chat-close').onclick = () => setChatOpen(false);
$<HTMLInputElement>('chat-input').onfocus = () => {
  arena.controls.clear();
};
$('chat-form').onsubmit = (event) => {
  event.preventDefault();
  const input = $<HTMLInputElement>('chat-input'),
    text = input.value;
  if (!room || !online || !chatEnabled || !text.trim()) return;
  room.send('chat', text);
  input.value = '';
};
function showUpgradeOffer(offer: UpgradeOffer | null) {
  currentOffer = offer;
  const panel = $('pve-rewards'),
    cards = $('reward-cards');
  cards.replaceChildren();
  panel.hidden = !offer;
  if (!offer) return;
  $('reward-wave').textContent = `OLEADA ${offer.wave} SUPERADA`;
  for (const choice of offer.choices) {
    const card = document.createElement('article');
    card.className = `reward-card ${choice.rarity}`;
    const icon = document.createElement('img'),
      rarity = document.createElement('small'),
      title = document.createElement('strong'),
      description = document.createElement('p'),
      button = document.createElement('button');
    icon.className = 'reward-icon';
    icon.src = UPGRADE_META[choice.id].icon;
    icon.alt = '';
    rarity.textContent =
      choice.rarity === 'epic' ? 'ÉPICA' : choice.rarity === 'rare' ? 'RARA' : 'COMÚN';
    title.textContent = choice.title;
    description.textContent = choice.description;
    button.textContent = 'Elegir';
    button.type = 'button';
    const send = (targetId?: string) => {
      room?.send('selectUpgrade', { offerId: offer.id, key: choice.key, targetId });
      showUpgradeOffer(null);
    };
    if (choice.id === 'reviveAlly' && choice.reviveTargets?.length) {
      const select = document.createElement('select');
      for (const target of choice.reviveTargets) select.append(new Option(target.name, target.id));
      button.onclick = () => send(select.value);
      card.append(icon, rarity, title, description, select, button);
    } else {
      button.onclick = () => send();
      card.append(icon, rarity, title, description, button);
    }
    cards.append(card);
  }
}
function bind(joined: Room) {
  joined.reconnection.minUptime = 0;
  joined.reconnection.minDelay = 300;
  joined.reconnection.maxDelay = 2000;
  joined.reconnection.maxRetries = 12;
  room = joined;
  resetChat();
  $('chat-toggle').hidden = false;
  online = true;
  current = undefined;
  showUpgradeOffer(null);
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
    latestRoomInfo = info;
    $('spectator-count').textContent = `Espectadores: ${info.spectators}/5`;
    $('entry-title').textContent = info.title;
    $('invite').setAttribute('aria-label', `Invitación a ${info.title}`);
    $('room-heading').textContent =
      `${info.title} · ${info.visibility === 'public' ? 'Pública' : 'Privada'} · ${info.modeName} · ${info.mapName}`;
    const perspective = $<HTMLSelectElement>('room-perspective');
    const value = perspective.value;
    perspective.replaceChildren(
      ...info.teams.map((team) => new Option(`${TEAM_ICONS[team]} ${TEAM_NAMES[team]}`, team)),
    );
    if (info.teams.includes(value as Team)) perspective.value = value;
  });
  room.onMessage('upgradeOffer', (offer: UpgradeOffer | null) => showUpgradeOffer(offer));
  // World: the list to choose from, the sheet, and the moment the character walks in.
  room.onMessage('characters', (list: WorldCharacterList) => showCharacters(list));
  room.onMessage('sheet', (sheet: Character) => showSheet(sheet));
  room.onMessage('system', (notice: Notice) => worldHud.notice(notice));
  room.onMessage('entered', ({ zoneId, characterId }: { zoneId: string; characterId: string }) => {
    worldCharacterId = characterId;
    $('overlay').hidden = true;
    $('world-characters').hidden = true;
    $('stage').dataset.zone = zoneId;
    $('stage').dataset.mode = 'world';
    document.body.classList.add('world-mode');
    worldHud.show();
    // In the world E, Q and Space belong to the skill slots, not to a class kit.
    if (arena.controls) arena.controls.onCast = castSlot;
  });
  room.onMessage('snapshot', (s: Snapshot) => {
    current = s;
    arena.receive(s, worldCharacterId ?? joined.sessionId);
    if (worldCharacterId) {
      const self = s.players.find((p) => p.id === worldCharacterId);
      if (self) $('stage').dataset.x = String(Math.round(self.x));
    }
    render(s);
  });
  room.onMessage('chatHistory', (history: ChatHistory) => {
    $('chat-messages').replaceChildren();
    for (const message of history.messages) appendChat(message, joined.sessionId);
    chatUnread = 0;
    updateUnread();
    renderChatStatus(history);
  });
  room.onMessage('chatMessage', (message: ChatMessage) => appendChat(message, joined.sessionId));
  room.onMessage('chatStatus', (status: ChatStatus) => renderChatStatus(status));
  room.onMessage('chatError', (message: string) => {
    $('chat-status').textContent = message;
  });
  room.onMessage('roomClosing', ({ reason }: { reason: RoomClosingReason }) => {
    chatClosedReason = reason;
    renderChatStatus({ enabled: false, connectedPlayers: 0, closing: true });
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
        chatClosedReason === 'inactive'
          ? 'La sala se cerró después de 2 minutos sin actividad.'
          : chatClosedReason === 'empty'
            ? 'La sala se cerró porque ya no quedan jugadores.'
            : 'Se perdió la conexión o el servidor se reinició. Podés crear otro duelo.';
      $('ready').hidden = true;
      $('invitation').hidden = true;
      $('announcement').hidden = true;
    }
  });
  room.onError((_code, message) => {
    setStatus(message || 'Error de conexión.', true);
  });
  arena.send = (input) => {
    if (online && current?.players.some((p) => p.id === (worldCharacterId ?? joined.sessionId)))
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
    // bind() leaves `target` pointing at the room just joined, so the world must be checked first:
    // otherwise picking a character would rejoin by id with duel options and no account.
    const joined = target && $<HTMLSelectElement>('game-mode').value !== 'world'
      ? await client.joinById(target, {
          name,
          classId: selectedClass,
          customization:
            selectedClass === 'mage' ? mageCustomization : defaultCustomization(selectedClass),
          spectator: $<HTMLInputElement>('spectator').checked,
          perspective: $<HTMLSelectElement>('spectator-perspective').value,
          password: $<HTMLInputElement>('room-password').value,
        })
      : $<HTMLSelectElement>('game-mode').value === 'world'
      ? await client.joinOrCreate('world', {
          account: $<HTMLInputElement>('world-user').value,
          password: $<HTMLInputElement>('world-pass').value,
          create: $<HTMLInputElement>('world-new').checked,
          // Without a character named, the server answers with the list to choose from.
          ...(chosenCharacter ? { characterId: chosenCharacter, classId: selectedClass, name } : {}),
          ...(chosenCreation ? { creation: chosenCreation } : {}),
        })
      : await client.create('duel', {
          name,
          classId: selectedClass,
          customization:
            selectedClass === 'mage' ? mageCustomization : defaultCustomization(selectedClass),
          title: $<HTMLInputElement>('room-title').value,
          visibility: $<HTMLSelectElement>('visibility').value,
          password: $<HTMLInputElement>('room-password').value,
          allowSpectators: $<HTMLInputElement>('allow-spectators').checked,
          mapId: selectedMap,
          mode: $<HTMLSelectElement>('game-mode').value,
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
/** The world screen: account fields, the saved characters, and the sheet once you are inside. */
interface WorldCharacterList {
  characters: { id: string; name: string; classId: string; level: number; zoneId: string }[];
  max: number;
}
let chosenCharacter: string | null = null;
/** The sparks and weapon placed in the Man-God's void, sent once with the new character. */
let chosenCreation: Creation | null = null;
/**
 * In the world the entity id is the character id, not the connection's session id. Null in a
 * match, where everything keeps finding itself by session id as before.
 */
let worldCharacterId: string | null = null;

const syncWorldFields = () => {
  const world = $<HTMLSelectElement>('game-mode').value === 'world';
  $('world-account').hidden = !world;
  // `#game-mode` lives inside `#room-options`: hiding that fieldset in world mode would take the
  // mode selector with it, and there would be no way back to a duel without reloading the page.
  $('room-options').hidden = !!target;
  $<HTMLInputElement>('world-user').required = world;
  $<HTMLInputElement>('world-pass').required = world;
  // Nothing else rewrites this button's copy, so it kept saying "duel" while entering the world.
  $('enter').textContent = world ? 'Entrar al mundo ↗' : 'Crear un duelo ↗';
};
$('game-mode').addEventListener('change', () => {
  chosenCharacter = null;
  syncWorldFields();
});
syncWorldFields();

/**
 * Coming back with an account but no character: the server sends what is saved, with the zone and
 * the level of each one, which is what tells you where you left off.
 */
function showCharacters(list: WorldCharacterList) {
  const box = $('world-characters');
  // It was born inside the entry form, and `bind()` hides that whole section the moment the
  // connection succeeds — the list would render inside a hidden container and nobody could ever
  // pick a character. Move it into the overlay card, which stays up while choosing.
  const card = document.querySelector('#overlay .overlay-card');
  if (card && box.parentElement !== card) card.append(box);
  // The account exists now. Left ticked, picking a character would ask to create it again and
  // the server would refuse the second join with "that name is taken".
  $<HTMLInputElement>('world-new').checked = false;
  box.hidden = false;
  box.replaceChildren();
  const title = document.createElement('p');
  title.className = 'world-hint';
  title.textContent = list.characters.length
    ? 'Elegí con quién volver:'
    : 'Todavía no tenés personajes. Elegí una clase arriba y creá el primero.';
  box.append(title);
  for (const character of list.characters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'world-character';
    button.dataset.character = character.id;
    button.textContent = `${character.name} · nivel ${character.level} · ${character.zoneId}`;
    button.onclick = () => {
      chosenCharacter = character.id;
      $<HTMLButtonElement>('enter').click();
    };
    box.append(button);
  }
  if (list.characters.length < list.max) {
    const crear = document.createElement('button');
    crear.type = 'button';
    crear.className = 'world-character new';
    crear.id = 'world-create';
    crear.textContent = 'Crear un personaje nuevo ↗';
    crear.onclick = () => {
      // Birth happens before the join: the server rolls fate from the sparks and weapon it gets.
      $('overlay').hidden = true;
      worldHud.openCreation((creation) => {
        chosenCreation = creation;
        chosenCharacter = `c${Date.now().toString(36)}`;
        $<HTMLButtonElement>('enter').click();
      });
    };
    box.append(crear);
  }
  // The overlay is what stays visible after `bind()`, so the choice lives there.
  $('overlay').hidden = false;
  $('overlay-kicker').textContent = 'MUNDO';
  $('overlay-title').textContent = 'Elegí tu personaje';
  $('overlay-description').textContent = list.characters.length
    ? `Tenés ${list.characters.length} de ${list.max}. El mundo te espera donde lo dejaste.`
    : 'Todavía no creaste ninguno. Dios te espera del otro lado.';
  document.body.classList.remove('joining-room');
}

function showSheet(sheet: Character) {
  worldHud.setSheet(sheet);
  arena.weapon = sheet.weapon;
  const stage = $('stage');
  stage.dataset.level = String(sheet.level);
  stage.dataset.xp = String(sheet.xp);
  stage.dataset.unspent = String(sheet.unspent);
  stage.dataset.zone = sheet.zoneId;
  stage.dataset.skillPoints = String(sheet.skillPoints);
}

$('new-instead').onclick = () => {
  target = null;
  document.body.classList.remove('joining-room');
  $('room-options').hidden = false;
  $<HTMLInputElement>('room-password').value = '';
  $('spectator-choice').hidden = true;
  $('perspective-choice').hidden = true;
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
$('pve-start').onclick = () => {
  if (current?.phase === 'finished') room?.send('continuePve');
  else room?.send('startPve');
};
$('ready').onclick = () => {
  unlockAudio();
  room?.send('ready');
};
$<HTMLSelectElement>('team-select').onchange = (event) =>
  room?.send('selectTeam', (event.target as HTMLSelectElement).value);
$<HTMLSelectElement>('room-perspective').onchange = (event) =>
  room?.send('perspective', (event.target as HTMLSelectElement).value);
$('leave').onclick = () => {
  sessionStorage.removeItem('bandera-token');
  const previous = room;
  room = undefined;
  void previous?.leave();
  location.assign(location.pathname);
};
/**
 * The match chrome says "first to 3", counts a clock down from infinity and asks for a flag. The
 * world has none of that: the top bar names the zone, and the System HUD carries the rest.
 */
function renderWorldChrome(s: Snapshot, me: Snapshot['players'][number] | undefined) {
  const zoneId = (s as Snapshot & { zoneId?: ZoneId }).zoneId;
  const here = zoneId ? zone(zoneId) : undefined;
  $('timer').textContent = here?.name ?? '';
  $('clock-note').textContent = here
    ? here.pvp === 'safe'
      ? 'SANTUARIO'
      : `ZONA SALVAJE · NV ${here.minLevel}+`
    : '';
  $('arena-label').textContent = here ? `${here.name.toUpperCase()} · MUNDO ISEKAI` : 'MUNDO ISEKAI';
  $('arena-hint').textContent = !me
    ? ''
    : me.hp <= 0
      ? `Caíste. Volvés al altar en ${Math.ceil(me.respawnLeft)} s.`
      : (here?.description ?? '');
  const guide = $('control-guide');
  if (!guide.querySelector('[data-world]'))
    guide.innerHTML =
      '<span data-world><span><kbd>WASD</kbd> Moverse</span><span><kbd>CLIC</kbd> Tu arma</span><span><kbd>E</kbd><kbd>Q</kbd><kbd>ESPACIO</kbd> Habilidades</span><span><kbd>K</kbd> Sistema</span></span>';
  $('cooldowns').hidden = true;
  $('abilities').hidden = true;
  $('overlay').hidden = true;
  if (me) worldHud.setPlayer(me);
}
function render(s: Snapshot) {
  if (!room && !practice) return;
  const me = s.players.find(
    (p) => p.id === (practice ? PRACTICE_PLAYER : (worldCharacterId ?? room!.sessionId)),
  );
  const participants = s.participants?.length ? s.participants : s.players;
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
    $(`flag-${team}`).textContent = participants.some((p) => p.team === team) ? '' : 'Fuera';
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
    ? `${MAPS[s.mapId].name.toUpperCase()} · JUGÁS PARA ${TEAM_ICONS[me.team]} ${TEAM_NAMES[me.team]}`
    : `${MAPS[s.mapId].name.toUpperCase()} · ESPECTADOR ${s.perspective ? `· ${TEAM_ICONS[s.perspective]} ${TEAM_NAMES[s.perspective]}` : ''}`;
  const pve = s.mode === 'pve' && s.pve ? s.pve : null;
  $('pve-hud').hidden = !pve;
  $('boss-hud').hidden = !pve?.bossActive;
  renderPveUpgrades(me, !!pve && !!me);
  if (pve) {
    $('pve-wave').textContent =
      s.phase === 'rewards'
        ? `DESCANSO · OLEADA ${pve.wave + 1} EN ${Math.ceil(pve.rewardLeft)} s`
        : `OLEADA ${pve.wave}${pve.endless ? ' · INFINITO' : ''}`;
    $('pve-enemies').textContent =
      `${pve.enemiesRemaining} enemigo${pve.enemiesRemaining === 1 ? '' : 's'}`;
    $('pve-alive').textContent =
      `${s.players.filter((p) => p.hp > 0).length}/${s.participants.length} vivos`;
    const boss = s.mobs.find((m) => m.boss);
    $<HTMLElement>('boss-health').style.width = boss
      ? `${Math.max(0, boss.hp / boss.maxHp) * 100}%`
      : '0%';
    $('reward-time').textContent = s.phase === 'rewards' ? `${Math.ceil(pve.rewardLeft)} s` : '';
  }
  $('stage').dataset.phase = s.phase;
  const overlay = s.phase === 'lobby' || s.phase === 'finished';
  if (s.phase !== 'rewards' && currentOffer) $('pve-rewards').hidden = true;
  $('overlay').hidden = !overlay;
  $('touch-controls').classList.toggle(
    'active',
    !!me && (s.phase === 'playing' || s.phase === 'rewards') && !s.paused,
  );
  $('cooldowns').hidden = !me || s.phase !== 'playing';
  $('abilities').hidden = !me || s.phase !== 'playing';
  $('room-picker').hidden = !me || !overlay;
  $('control-guide').hidden = !me;
  $('stage').dataset.role = me ? 'player' : 'spectator';
  if (me) {
    selectedClass = me.classId;
    saveClass(me.classId);
    showClassControls(me.classId);
    arena.controls.configure(
      me.classId,
      me.classId === 'mage' ? mageCustomization : defaultCustomization(me.classId),
    );
    updateAbilities(
      $('abilities'),
      me,
      me.classId === 'mage' ? activePreset(mageCustomization).bindings : undefined,
    );
    updateTouchAbilities($('touch-actions'), me);
    updateClasses($('room-classes'), me.classId, !overlay || s.paused);
    $('room-picker').hidden = !overlay;
    $('stage').dataset.class = me.classId;
    $('stage').dataset.guarding = String(me.guarding);
    $('stage').dataset.fury = String(me.furyLeft > 0);
    $('stage').dataset.magicShield = String(me.magicShieldHits);
    $('stage').dataset.frozen = String(me.frozenLeft > 0);
    $('cd-ice').textContent = `❄ ${me.iceCd > 0 ? me.iceCd.toFixed(1) + 's' : 'Listo'}`;
    $('stage').dataset.dashing = String(
      me.dashInvulnerable || (me.classId === 'guardian' && me.dashLeft > 0),
    );
    $('health').textContent = `♥ ${me.hp}/${me.maxHp}`;
    $('health').setAttribute('aria-label', `Vida: ${me.hp} de ${me.maxHp}`);
    $('mobile-player-status').hidden = false;
    $('mobile-health').textContent = `♥ ${me.hp}/${me.maxHp}`;
    const carrying = s.flags.some((flag) => flag.carrier === me.id);
    $('mobile-state').textContent = carrying
      ? '⚑ BANDERA'
      : me.stunLeft > 0
        ? `ATURDIDO ${me.stunLeft.toFixed(1)}s`
        : me.bushId
          ? me.revealLeft > 0
            ? 'REVELADO'
            : 'OCULTO'
          : me.guarding
            ? 'GUARDIA'
            : me.furyLeft > 0
              ? `FURIA ${me.furyLeft.toFixed(1)}s`
              : '';
    $('lives').textContent = `☠ ${me.deaths}`;
    $('lives').setAttribute('aria-label', `Muertes: ${me.deaths}; reapariciones ilimitadas`);
    $('stealth-state').textContent = me.bushId
      ? me.revealLeft > 0
        ? `◉ Revelado ${me.revealLeft.toFixed(1)}s`
        : '◌ Oculto'
      : '';
    $('stealth-state').className =
      me.bushId && me.revealLeft <= 0 ? 'hidden-state' : 'revealed-state';
    $('cd-guard').textContent = me.guarding
      ? `⛨ Guardia continua`
      : `⛨ ${me.guardCd > 0 ? me.guardCd.toFixed(1) + 's' : 'Lista'}`;
    if (me.classId === 'mage')
      $('cd-guard').textContent =
        me.magicShieldHits > 0
          ? `⛨ ${me.magicShieldHits}/2 golpes`
          : `⛨ ${me.magicShieldCd > 0 ? me.magicShieldCd.toFixed(1) + 's' : 'Listo · clic derecho'}`;
    $('cd-sword').textContent = `⚔ ${me.swordCd > 0 ? me.swordCd.toFixed(1) + 's' : 'Lista'}`;
    $('stage').dataset.charge = String(me.shotCharge);
    $('stage').dataset.specialCharge = String(me.specialCharge);
    $('cd-shot').textContent =
      `${me.classId === 'mage' ? '✦' : me.classId === 'necromancer' ? '✺' : '➶'} ${me.shotCd > 0 ? me.shotCd.toFixed(1) + 's' : 'Lista'}`;
    if (me.classId === 'archer' && me.shotCharge > 0)
      $('cd-shot').textContent =
        me.shotCharge >= RULES.chargeTime - 1e-8
          ? '➶ Cargada · +30 %'
          : `➶ Cargando ${Math.round((me.shotCharge / RULES.chargeTime) * 100)}%`;
    if (me.classId !== 'archer' && me.shotCharge > 0)
      $(CLASSES[me.classId].ranged ? 'cd-shot' : 'cd-sword').textContent =
        `⚡ Cargando ${Math.round(chargePower(me.shotCharge) * 100)} %`;
    $('cd-dash').textContent = `➟ ${me.dashCd > 0 ? me.dashCd.toFixed(1) + 's' : 'Listo'}`;
    if (me.specialCharge > 0 && CLASSES[me.classId].dash && me.classId !== 'guardian')
      $('cd-dash').textContent = `➟ Cargando ${Math.round(chargePower(me.specialCharge) * 100)} %`;
    $('stage').dataset.trapLeft = String(me.trapLeft);
    $('stage').dataset.traps = String(s.traps.filter((t) => t.owner === me.id).length);
    $('cd-trap').textContent =
      me.trapLeft > 0
        ? `Q Preparando ${me.trapLeft.toFixed(1)}s`
        : `Q Trampa · ${me.trapCd > 0 ? me.trapCd.toFixed(1) + 's' : 'Lista'}`;
    $('cd-volley').textContent =
      `E Triple · ${me.volleyCd > 0 ? me.volleyCd.toFixed(1) + 's' : 'Listo'}`;

    $('cd-summon').textContent =
      `☠ ${me.activeExecutions}/${RULES.zombieExecutions} · ${me.activeExecutions >= RULES.zombieExecutions ? 'Llenas' : me.summonCd > 0 ? me.summonCd.toFixed(1) + 's' : 'Listo'}`;
    if (me.specialCharge > 0 && CLASSES[me.classId].summon)
      $('cd-summon').textContent =
        me.specialCharge >= RULES.overchargeTime
          ? `☠ Aura ${Math.round(Math.min(1, me.specialCharge / RULES.raiseCharge) * 100)} % · resucitar`
          : '☠ Cargando · zombie con gorro';
  } else {
    $('mobile-player-status').hidden = true;
  }
  if (worldCharacterId) {
    renderWorldChrome(s, me);
    return;
  }
  $('arena-hint').textContent = pve
    ? me?.hp === 0
      ? 'Caíste. Esperá que un aliado pueda revivirte.'
      : `Eliminá la horda · ${pve.enemiesRemaining} enemigos restantes`
    : s.flags.some((f) => f.carrier === me?.id)
      ? '¡Tenés la bandera! Volvé a tu base.'
      : me?.eliminated
        ? 'Quedaste eliminado. Mirá cómo termina la batalla.'
        : me?.hp === 0
          ? `Reaparecés en ${Math.ceil(me.respawnLeft)} s`
          : 'Robá la bandera rival. Recuperá la tuya. Volvé a casa.';
  if (overlay) {
    $('overlay-kicker').textContent =
      s.phase === 'finished'
        ? 'LA PARTIDA TERMINÓ'
        : `SALA · ${participants.length}/${s.maxPlayers}`;
    $('overlay-title').textContent =
      s.phase === 'finished'
        ? s.winner === 'draw'
          ? 'Un duelo a la altura.'
          : s.winner === me?.team
            ? 'La gloria es tuya.'
            : participants.length > 2
              ? `Esta vez, ganó ${participants.find((p) => p.team === s.winner)?.name ?? TEAM_NAMES[s.winner as Team]}.`
              : 'Esta vez, ganó tu rival.'
        : s.mode === 'pve'
          ? `${participants.length} expedicionario${participants.length === 1 ? '' : 's'} preparado${participants.length === 1 ? '' : 's'}.`
          : participants.length < s.maxPlayers
            ? `Faltan ${s.maxPlayers - participants.length} jugadores.`
            : 'La partida está lista.';
    $('overlay-description').textContent =
      s.phase === 'finished'
        ? s.reason === 'abandono'
          ? 'Tus rivales abandonaron la partida.'
          : s.reason === 'eliminación'
            ? 'Quedó un solo guerrero en pie. ¿Otra ronda?'
            : `${s.bases.map((b) => s.score[b.team]).join(' — ')}. ¿Otra ronda?`
        : s.mode === 'pve'
          ? `Hordas cooperativas en ${MAPS[s.mapId].name}. El anfitrión inicia cuando todos los presentes estén listos.`
          : `${MODE_INFO[s.mode].name} en ${MAPS[s.mapId].name}. Compartí el link; empieza cuando estén los ${s.maxPlayers} jugadores y todos estén listos.`;
    const roster = $('roster');
    roster.replaceChildren();
    for (const p of participants) {
      const row = document.createElement('div');
      row.className = `roster-player ${p.team}`;
      const title = document.createElement('span');
      title.textContent = `${TEAM_ICONS[p.team]} ${p.name} · ${CLASSES[p.classId].name}`;
      const state = document.createElement('small');
      const entity = s.players.find((player) => player.id === p.id);
      state.textContent =
        s.mode === 'pve' && s.phase === 'finished'
          ? `${entity?.pveKills ?? 0} bajas · ${Math.round(entity?.pveDamage ?? 0)} daño · ${Object.values(entity?.pve.stacks ?? {}).reduce((sum, count) => sum + count, 0)} mejoras`
          : !p.connected
            ? 'DESCONECTADO'
            : p.ready
              ? 'LISTO ✓'
              : 'PREPARÁNDOSE';
      row.append(title, state);
      roster.append(row);
    }
    for (let i = participants.length; i < s.maxPlayers; i++) {
      const row = document.createElement('div');
      row.className = 'roster-player empty';
      row.innerHTML =
        s.mode === 'pve'
          ? '<span>⚔ Lugar opcional</span><small>PODÉS EMPEZAR SIN LLENARLO</small>'
          : '<span>⚔ Esperando jugador…</span><small>ASIENTO LIBRE</small>';
      roster.append(row);
    }
    const teamChoice = $('team-choice');
    teamChoice.hidden = !me || s.mode !== 'teams';
    if (me) $<HTMLSelectElement>('team-select').value = me.team;
    $('room-perspective-choice').hidden = !!me;
    if (!me && s.perspective) {
      const perspective = $<HTMLSelectElement>('room-perspective');
      perspective.value = s.perspective;
      perspective.disabled =
        !['lobby', 'finished'].includes(s.phase) &&
        participants.some((p) => p.team === s.perspective);
    }
    $('invitation').hidden = false;
    $('ready').hidden =
      !me ||
      (s.phase === 'finished' &&
        (s.players.some((p) => !p.connected) || (s.mode === 'pve' && s.reason === 'pveVictory')));
    $<HTMLButtonElement>('ready').disabled =
      s.paused || (s.mode !== 'pve' && participants.length !== s.maxPlayers);
    const isHost = !!me && latestRoomInfo?.hostId === me.id;
    $('pve-start').hidden = s.mode !== 'pve' || !isHost || s.phase !== 'lobby';
    $<HTMLButtonElement>('pve-start').disabled =
      s.phase === 'finished' && s.reason === 'pveVictory'
        ? false
        : !participants.length || participants.some((p) => !p.ready || !p.connected);
    $('pve-start').textContent =
      s.phase === 'finished'
        ? s.reason === 'pveVictory'
          ? 'Continuar en infinito ↗'
          : 'Comenzar nueva expedición ↗'
        : `Comenzar expedición con ${participants.length} ${participants.length === 1 ? 'jugador' : 'jugadores'} ↗`;
    if (s.mode === 'pve' && s.phase === 'finished' && isHost) $('pve-start').hidden = false;
    $('room-picker').hidden =
      s.mode === 'pve' && s.phase === 'finished' && s.reason === 'pveVictory';
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
    $('arena-label').textContent = `PRÁCTICA LOCAL · ${MAPS[s.mapId].name.toUpperCase()}`;
    $('stage').dataset.role = 'practice';
    $('practice-toolbar').dataset.dummyHp = String(
      s.players.find((p) => p.id === 'practice-dummy')?.hp ?? 0,
    );
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
  if (me?.stunLeft) $('arena-hint').textContent = `Aturdido · ${me.stunLeft.toFixed(1)} s`;
  if (pve && s.phase === 'finished') {
    $('overlay-title').textContent =
      s.reason === 'pveVictory' ? '¡La cripta ha caído!' : 'La expedición terminó';
    $('overlay-description').textContent =
      `Oleada ${pve.wave} · ${Object.values(pve.kills).reduce((a, b) => a + b, 0)} enemigos eliminados.`;
  }
  const announce = $('announcement');
  announce.hidden =
    overlay ||
    !(s.paused || s.phase === 'countdown' || s.phase === 'capture' || s.phase === 'rewards');
  if (s.paused) {
    announce.hidden = false;
    announce.textContent = `Rival desconectado · ${Math.ceil(s.reconnectLeft)} s para volver`;
  } else if (s.phase === 'countdown')
    announce.textContent = String(Math.max(1, Math.ceil(s.phaseLeft)));
  else if (s.phase === 'capture') announce.textContent = '¡BANDERA CAPTURADA!';
  else if (s.phase === 'rewards')
    announce.textContent = `SIGUIENTE OLEADA EN ${Math.ceil(s.pve?.rewardLeft ?? 0)}`;
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
  teams: Team[];
  mapId: MapId;
  mapName: string;
  mode: GameMode;
  modeName: string;
  maxPlayers: number;
  hostId: string | null;
  wave: number;
  enemies: number;
  pveCompleted: boolean;
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
      ['playing', 'capture', 'countdown', 'rewards'].includes(info.phase),
    );
    $('rooms-status').textContent = rooms.length
      ? 'Elegí una sala para jugar u observar.'
      : 'No hay salas públicas. ¡Creá la primera!';
    for (const info of rooms) {
      const live = ['playing', 'capture', 'countdown', 'rewards'].includes(info.phase);
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
      details.textContent = `${info.modeName} · ${info.mapName} · ${info.players}/${info.maxPlayers} jugadores · ${info.spectators}/5 espectadores · ${info.phase === 'lobby' ? 'Esperando jugadores' : info.phase === 'finished' ? 'Resultado' : 'En combate'}${info.mode === 'pve' && info.wave ? ` · Oleada ${info.wave}` : ''}${info.passwordRequired ? ' · Con contraseña' : ''}`;
      card.append(title, details);
      if (live) {
        const score = document.createElement('p');
        score.className = 'live-score';
        const seconds = Math.ceil(info.timeLeft);
        score.textContent = `${info.names.join(' vs ')} · ${[...new Set(info.teams)].map((team) => `${TEAM_ICONS[team]} ${info.score[team]}`).join(' — ')} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        card.append(score);
      }
      const choose = (spectator: boolean) => {
        target = info.roomId;
        history.replaceState(null, '', `?sala=${target}`);
        entryMode();
        $('entry-title').textContent = info.title;
        $<HTMLInputElement>('spectator').checked = spectator;
        $('spectator').dispatchEvent(new Event('change'));
        if (spectator && info.teams.length)
          $<HTMLSelectElement>('spectator-perspective').value = info.teams[0];
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
          : info.phase !== 'lobby' || info.playerSlots >= info.maxPlayers;
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
  resetChat();
  if (room || busy || !arena.controls) return;
  unlockAudio();
  const customization =
    selectedClass === 'mage' ? mageCustomization : defaultCustomization(selectedClass);
  practice = new Practice(
    selectedClass,
    validName(nameInput.value) || 'Vos',
    selectedMap,
    customization,
  );
  arena.controls.configure(selectedClass, customization);
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
  resetChat();
  for (const id of ['practice-toolbar', 'hud', 'overlay', 'cooldowns', 'announcement'])
    $(id).hidden = true;
  for (const id of ['intro', 'room-browser', 'guide', 'preview-tag', 'leave']) $(id).hidden = false;
  $('touch-controls').classList.remove('active');
  $('stage').dataset.role = 'preview';
  $('arena-label').textContent = 'EL PATIO DEL REY';
  $('connection-label').textContent = 'ACERO · ARCO · MAGIA';
  const preview = new Practice(
    selectedClass,
    'Vos',
    selectedMap,
    selectedClass === 'mage' ? mageCustomization : defaultCustomization(selectedClass),
  );
  preview.duel.state.phase = 'lobby';
  arena.receive(structuredClone(preview.duel.state), '');
  $('intro').scrollIntoView({ block: 'start' });
};
