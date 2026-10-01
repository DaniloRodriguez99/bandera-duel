/**
 * On a phone or tablet a match takes the whole screen. Entering one asks the browser for
 * fullscreen, which hides its tabs and address bar, and turns the screen to landscape where the
 * browser lets a page lock it. Leaving the match gives the screen back.
 *
 * Browsers only grant fullscreen right after a tap. A match that starts without one (a reconnection,
 * a server slow to answer) asks again on the first tap inside it. A player who leaves fullscreen on
 * purpose is not dragged back: the button, or the rotate screen, brings it back when they want it.
 *
 * The Android app is already a fullscreen landscape window, and an iPhone's browser has no
 * fullscreen for pages: there the game opens without browser bars once added to the home screen,
 * through the manifest.
 */

type PrefixedDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type PrefixedElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
/** `lock` is in the spec and in Chrome for Android, but not in TypeScript's DOM types. */
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

const doc = document as PrefixedDocument;
let enabled = false;

/** Whether the game is played with fingers: a phone or a tablet. */
export const touchScreen = () => matchMedia('(pointer: coarse)').matches;
/** Whether this browser lets the page go fullscreen at all. */
export const fullscreenSupported = () => enabled && !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
export const isFullscreen = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
/** An iPhone in Safari, outside the home-screen app: the only way there to lose the browser bars. */
export const homeScreenHint = () =>
  enabled &&
  touchScreen() &&
  !fullscreenSupported() &&
  /iPhone|iPod/.test(navigator.userAgent) &&
  !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches &&
  !(navigator as Navigator & { standalone?: boolean }).standalone;

/** In a match on a touch screen. */
let playing = false;
/** The player left fullscreen during this match: taps no longer bring it back on their own. */
let declined = false;
let pending = false;
let onChange = () => {};

function lockLandscape() {
  (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => {});
}
function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Nothing was locked, or this browser cannot lock.
  }
}

/** Asks for fullscreen and landscape. Only works from a tap; anywhere else the browser says no. */
export function enterFullscreen() {
  if (!fullscreenSupported() || pending) return;
  if (isFullscreen()) return lockLandscape();
  const root = document.documentElement as PrefixedElement;
  pending = true;
  let request: Promise<void> | void | undefined;
  try {
    request = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.();
  } catch {
    request = Promise.reject();
  }
  Promise.resolve(request)
    // The tap that asked may have been the one that left the match: then the lobby keeps its screen.
    .then(() => (playing ? lockLandscape() : exitFullscreen()), () => {})
    .finally(() => {
      pending = false;
      onChange();
    });
}

/** The player's own choice, from the button, the rotate screen or the settings. */
export function chooseFullscreen(on: boolean) {
  declined = !on;
  if (on) enterFullscreen();
  else exitFullscreen();
}

export function exitFullscreen() {
  unlockOrientation();
  if (!isFullscreen()) return;
  try {
    Promise.resolve(doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.()).catch(() => {});
  } catch {
    // Already on its way out.
  }
}

/**
 * Follows the match: `body.in-room` is set while one is on screen (a room, the world or practice).
 * `stage` gets the button that brings fullscreen back; `rotate` is the screen asking to turn the
 * phone, which also brings it back when tapped.
 */
export function installFullscreen(options: { stage: HTMLElement; rotate: HTMLElement; native: boolean }) {
  enabled = !options.native;
  if (!enabled) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'platform-fullscreen';
  button.textContent = '⛶';
  button.title = 'Pantalla completa';
  button.setAttribute('aria-label', 'Pantalla completa');
  button.hidden = true;
  options.stage.append(button);

  const sync = () => {
    button.hidden = !(playing && fullscreenSupported() && !isFullscreen());
    document.body.classList.toggle('can-fullscreen', touchScreen() && fullscreenSupported());
  };
  onChange = sync;
  const ask = () => chooseFullscreen(true);
  button.addEventListener('click', ask);
  options.rotate.addEventListener('click', ask);

  const follow = () => {
    const now = document.body.classList.contains('in-room') && touchScreen();
    if (now !== playing) {
      playing = now;
      declined = false;
      if (playing) enterFullscreen();
      else exitFullscreen();
    }
    sync();
  };
  new MutationObserver(follow).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // A tap inside a match that is not fullscreen yet: the permission the first request lacked.
  window.addEventListener(
    'pointerup',
    () => {
      if (playing && !declined && !isFullscreen()) enterFullscreen();
    },
    true,
  );
  // Out of fullscreen in the middle of a match: the player swiped it away. The game only leaves it
  // itself after the match is over, or when the player asked to.
  const changed = () => {
    if (!isFullscreen() && playing) declined = true;
    sync();
  };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
  follow();
}
