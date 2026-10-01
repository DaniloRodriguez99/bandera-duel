import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { healthUrl, normalizeServer, roomCode } from './mobile-connection';
import { visualSettings } from './visual-effects';
import { chooseFullscreen, fullscreenSupported, homeScreenHint, isFullscreen, touchScreen } from './fullscreen';

export const native = Capacitor.isNativePlatform();
const storageKey = 'bandera-mobile-server';
export function savedServer() {
  if (!native) return null;
  const value = localStorage.getItem(storageKey);
  if (!value) return null;
  try { return normalizeServer(value, import.meta.env.VITE_ANDROID_DEBUG === 'true'); }
  catch { return null; }
}
export function initialServer(): string | undefined {
  const value = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (!native || !value) return value;
  try { return normalizeServer(value, import.meta.env.VITE_ANDROID_DEBUG === 'true'); }
  catch { return undefined; }
}
export function installPlatform(hooks: {
  connected: () => boolean;
  leave: () => void;
  activity: (active: boolean) => void;
  closePanel: () => boolean;
  setServer: (endpoint: string) => void;
  joinCode: (code: string) => void;
}) {
  const bar = document.createElement('div'); bar.className = 'platform-settings';
  bar.innerHTML = '<button type="button" id="display-settings">Pantalla y efectos</button>' + (native ? '<button type="button" id="server-settings">Servidor</button><button type="button" id="join-code">Ingresar código</button>' : '');
  document.querySelector('#intro')?.append(bar);
  const inGame = document.createElement('button');
  inGame.type = 'button'; inGame.className = 'platform-game-settings'; inGame.textContent = '⚙';
  inGame.setAttribute('aria-label', 'Ajustes del juego');
  document.querySelector('#stage')?.append(inGame);
  const dialog = document.createElement('dialog'); dialog.className = 'platform-dialog';
  document.body.append(dialog);
  function show(content: string) {
    dialog.innerHTML = `<form method="dialog"><button class="platform-close" aria-label="Cerrar">✕</button></form>${content}`;
    if (!dialog.open) dialog.showModal();
  }
  inGame.onclick = () => {
    const screen = touchScreen() && fullscreenSupported()
      ? `<button id="game-fullscreen">${isFullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>`
      : homeScreenHint()
        ? '<p>Para jugar sin las barras de Safari, agregá el juego a tu pantalla de inicio: Compartir → Agregar a inicio, y abrilo desde ahí.</p>'
        : '';
    show('<h2>Ajustes del juego</h2><button id="game-effects">Pantalla y efectos</button>' + (native ? '<button id="game-server">Servidor</button>' : '') + screen);
    dialog.querySelector('#game-effects')!.addEventListener('click', () => (bar.querySelector('#display-settings') as HTMLButtonElement).click());
    dialog.querySelector('#game-server')?.addEventListener('click', settings);
    dialog.querySelector('#game-fullscreen')?.addEventListener('click', () => {
      dialog.close();
      chooseFullscreen(!isFullscreen());
    });
  };
  bar.querySelector('#display-settings')!.addEventListener('click', () => {
    show('<h2>Pantalla y efectos</h2><label>Calidad de efectos <select id="fx-quality"><option value="normal">Normal</option><option value="low">Baja</option></select></label><label><input type="checkbox" id="fx-shake"> Sacudidas de cámara</label><p>La reducción de movimiento del dispositivo se respeta automáticamente.</p>');
    const quality = dialog.querySelector<HTMLSelectElement>('#fx-quality')!;
    quality.value = visualSettings.low ? 'low' : 'normal';
    quality.onchange = () => { visualSettings.low = quality.value === 'low'; localStorage.setItem('bandera-fx', quality.value); };
    const shake = dialog.querySelector<HTMLInputElement>('#fx-shake')!;
    shake.checked = visualSettings.shake;
    shake.onchange = () => { visualSettings.shake = shake.checked; localStorage.setItem('bandera-shake', shake.checked ? 'on' : 'off'); };
  });
  let configured = !!(savedServer() || initialServer());
  function settings() {
    show('<h2>Servidor de juego</h2><p>Ingresá la dirección del servidor. Para jugar por Wi-Fi, usá la IP de tu PC y el puerto 2567.</p><form id="server-form"><label>Dirección <input id="server-url" type="url" placeholder="https://mi-servidor.com" required></label><button>Comprobar y guardar</button><p id="server-result" role="status"></p></form>');
    const input = dialog.querySelector<HTMLInputElement>('#server-url')!;
    input.value = savedServer() || import.meta.env.VITE_SERVER_URL || '';
    dialog.querySelector<HTMLFormElement>('#server-form')!.onsubmit = async e => {
      e.preventDefault();
      const status = dialog.querySelector<HTMLElement>('#server-result')!;
      const button = dialog.querySelector<HTMLButtonElement>('#server-form button')!;
      button.disabled = true; status.textContent = 'Comprobando conexión…';
      try {
        const endpoint = normalizeServer(input.value, import.meta.env.VITE_ANDROID_DEBUG === 'true');
        const response = await fetch(healthUrl(endpoint), { signal: AbortSignal.timeout(6000) });
        const data = await response.json();
        if (!response.ok || data.game !== 'bandera-duel' || !data.ok) throw new Error('La dirección no corresponde a un servidor Bandera Duel disponible.');
        if (hooks.connected()) {
          if (!confirm('Para cambiar de servidor tenés que salir de la partida. ¿Salir y guardar?')) return;
          localStorage.setItem(storageKey, endpoint); sessionStorage.removeItem('bandera-token'); hooks.leave(); return;
        }
        localStorage.setItem(storageKey, endpoint); sessionStorage.removeItem('bandera-token');
        hooks.setServer(endpoint); configured = true; dialog.close();
      } catch (error) {
        status.textContent = error instanceof TypeError ? 'No se pudo conectar. Revisá la dirección, Wi-Fi y los orígenes permitidos del servidor.' : error instanceof Error ? error.message : 'No se pudo conectar.';
      } finally { button.disabled = false; }
    };
  }
  if (native) {
    bar.querySelector('#server-settings')!.addEventListener('click', settings);
    bar.querySelector('#join-code')!.addEventListener('click', () => {
      show('<h2>Ingresar a una sala</h2><form id="code-form"><label>Código o enlace <input id="code" required></label><button>Continuar</button><p role="status"></p></form>');
      dialog.querySelector<HTMLFormElement>('#code-form')!.onsubmit = e => {
        e.preventDefault();
        try { const code = roomCode(dialog.querySelector<HTMLInputElement>('#code')!.value); hooks.joinCode(code); dialog.close(); }
        catch (error) { dialog.querySelector('p')!.textContent = (error as Error).message; }
      };
    });
    void App.addListener('appStateChange', ({ isActive }) => hooks.activity(isActive));
    void App.addListener('backButton', () => {
      if (dialog.open) { dialog.close(); return; }
      if (document.activeElement instanceof HTMLInputElement) { document.activeElement.blur(); return; }
      if (hooks.closePanel()) return;
      if (hooks.connected()) { if (confirm('¿Salir de la partida y volver al inicio?')) hooks.leave(); }
      else void App.minimizeApp();
    });
    if (!configured) settings();
  }
  return { ready: () => { if (native && !configured) { settings(); return false; } return true; } };
}
