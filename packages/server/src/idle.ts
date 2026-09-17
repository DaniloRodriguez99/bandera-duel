/**
 * Turns the server off once nobody is connected for a while.
 *
 * Cloud Run bills an instance while it has open connections; an empty world has nothing to do,
 * so the process saves and exits, and the next player who presses "join" wakes a fresh one. Only
 * enabled where the platform restarts on demand (see IDLE_SHUTDOWN_SECONDS): on a host that
 * restarts an exited process right away, this would just loop.
 */
export interface IdleWatchOptions {
  /** Connected clients right now, across every room. */
  clients: () => number;
  /** How long the server must stay empty before it gives up. */
  idleMs: number;
  onIdle: () => void;
  everyMs?: number;
  now?: () => number;
}

export function watchIdle({ clients, idleMs, onIdle, everyMs = 5000, now = Date.now }: IdleWatchOptions) {
  let emptySince: number | null = null;
  let fired = false;
  const check = () => {
    if (fired) return;
    if (clients() > 0) {
      emptySince = null;
      return;
    }
    emptySince ??= now();
    if (now() - emptySince >= idleMs) {
      fired = true;
      onIdle();
    }
  };
  const timer = setInterval(check, everyMs);
  timer.unref();
  return { check, stop: () => clearInterval(timer) };
}
