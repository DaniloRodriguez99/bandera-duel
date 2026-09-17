import { MemoryStore, type CharacterStore } from './characters.js';
import { FileStore } from './file.js';
import { PostgresStore } from './postgres.js';

/**
 * Picks the storage driver from the environment, once, at startup.
 *
 * - `DATABASE_URL` is Postgres (`PostgresStore`): what production uses, and the only choice that
 *   survives a host with no disk, like Cloud Run turning itself off when nobody plays.
 * - `STORE_FILE` is one JSON file on a local disk (`FileStore`).
 * - Nothing set means memory, which is right for development and the tests and wrong anywhere
 *   players expect to find their character tomorrow, hence the warning in production.
 */
export function storeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn,
): CharacterStore {
  if (env.DATABASE_URL) return new PostgresStore(env.DATABASE_URL);
  if (env.STORE_FILE) return new FileStore(env.STORE_FILE);
  if (env.NODE_ENV === 'production')
    warn(
      JSON.stringify({
        event: 'store-memory',
        level: 'warn',
        message: 'Sin STORE_FILE ni DATABASE_URL: las cuentas y personajes se pierden al reiniciar',
      }),
    );
  return new MemoryStore();
}
