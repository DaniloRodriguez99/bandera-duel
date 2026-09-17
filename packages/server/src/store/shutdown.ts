import type { CharacterStore } from './characters.js';

/**
 * The orderly way out, so progress made since the last periodic save is not lost on a deploy.
 *
 * Colyseus 0.18's `gracefullyShutdown()` does await every room's async `onDispose()` (it waits
 * for the matchmaker's 'no-active-rooms', emitted after each room's dispose settles), and every
 * client's `onLeave()` runs before that. It is still not enough on its own: it has no timeout
 * ("TODO: set generous timeout" in MatchMaker), it logs and swallows errors from `onDispose`, and a
 * second call returns at once without waiting. So the world is flushed explicitly first, every
 * step is bounded, and the store is closed last with time reserved for it: Cloud Run sends
 * SIGTERM and kills the container about ten seconds later.
 */

export interface ShutdownOptions {
  server: { gracefullyShutdown(exit?: boolean): Promise<unknown> };
  /** Saves every character online in every world room. */
  flush: () => Promise<unknown>;
  /** A getter, because tests and startup may swap the store after this is built. */
  store: () => CharacterStore;
  /** Total budget, in milliseconds. */
  deadline?: number;
  /** Kept back from the room steps so the store always gets a chance to finish its write. */
  closeReserve?: number;
  log?: (entry: Record<string, unknown>) => void;
}

/** Returns an idempotent shutdown: every call gets the same promise, which resolves to whether
 * every step finished cleanly and in time. It never rejects. */
export function createShutdown({
  server,
  flush,
  store,
  deadline = 8000,
  closeReserve = 2000,
  log = (entry) => console.info(JSON.stringify(entry)),
}: ShutdownOptions): () => Promise<boolean> {
  let running: Promise<boolean> | null = null;

  const bounded = async (step: string, work: () => Promise<unknown>, until: number) => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {
        log({ event: 'shutdown-timeout', step });
        resolve(false);
      }, Math.max(0, until - Date.now()));
    });
    const done = Promise.resolve()
      .then(work)
      .then(
        () => true,
        (error: unknown) => {
          log({ event: 'shutdown-error', step, error: String((error as Error)?.message ?? error) });
          return false;
        },
      );
    try {
      return await Promise.race([done, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  return () =>
    (running ??= (async () => {
      const start = Date.now();
      const end = start + deadline;
      const roomsEnd = end - Math.min(closeReserve, deadline / 2);
      log({ event: 'shutdown', deadline });
      const flushed = await bounded('flush', flush, roomsEnd);
      // Disconnects every client (each onLeave saves) and disposes the rooms (onDispose flushes).
      const rooms = await bounded('rooms', () => server.gracefullyShutdown(false), roomsEnd);
      const closed = await bounded('store', () => store().close(), end);
      const ok = flushed && rooms && closed;
      log({ event: 'shutdown-done', ok, ms: Date.now() - start });
      return ok;
    })());
}
