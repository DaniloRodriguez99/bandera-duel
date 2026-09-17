import { MemoryStore, type CharacterStore } from './characters.js';
import { FileStore } from './file.js';

/**
 * Picks the storage driver from the environment, once, at startup.
 *
 * - `DATABASE_URL` is reserved for the Postgres driver. It does not exist yet, and a deploy that
 *   sets it clearly expects real persistence, so this fails at boot rather than quietly handing
 *   that deploy a store that forgets everything on restart.
 * - `STORE_FILE` is one JSON file on a local disk (`FileStore`).
 * - Nothing set means memory, which is right for development and the tests and wrong anywhere
 *   players expect to find their character tomorrow, hence the warning in production.
 */
export function storeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn,
): CharacterStore {
  if (env.DATABASE_URL)
    throw new Error(
      'DATABASE_URL está definida pero el driver de Postgres todavía no existe. ' +
        'Quitala para usar STORE_FILE o memoria, o implementá PostgresStore en packages/server/src/store.',
    );
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
