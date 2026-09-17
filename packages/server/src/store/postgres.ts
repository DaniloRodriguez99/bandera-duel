import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { Character } from '@bandera/shared/world';
import {
  MAX_CHARACTERS,
  StoreError,
  envelope,
  hashPassword,
  verifyPassword,
  type AccountId,
  type CharacterId,
  type CharacterStore,
  type CharacterSummary,
} from './characters.js';
import { migrate } from './migrate.js';

/**
 * Accounts and characters in Postgres, for production (Neon, Supabase, any managed Postgres).
 *
 * A character is saved whole as the same versioned envelope the other drivers keep, in a jsonb
 * column: the world owns the shape, the database only has to keep it safe. Every read goes through
 * `migrate`, so an old or damaged row is upgraded or refused, never silently replaced.
 */

const SCHEMA = `
  create table if not exists bandera_accounts (
    id text primary key,
    name text not null,
    name_key text not null unique,
    password text not null,
    created_at timestamptz not null default now()
  );
  create table if not exists bandera_characters (
    account_id text not null references bandera_accounts(id) on delete cascade,
    id text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (account_id, id)
  );
`;

const FOREIGN_KEY_VIOLATION = '23503';

export class PostgresStore implements CharacterStore {
  private pool: pg.Pool;
  private ready: Promise<void> | null = null;
  private closing: Promise<void> | null = null;

  constructor(connectionString: string, options: { max?: number } = {}) {
    // Few connections on purpose: one process holds the whole world, and free plans cap them.
    this.pool = new pg.Pool({ connectionString, max: options.max ?? 5 });
    // An idle connection dropped by the server must not crash the process.
    this.pool.on('error', (error) => console.error(JSON.stringify({ event: 'postgres-error', error: error.message })));
  }

  /** Creates the tables the first time anything is asked. Idempotent. */
  private open() {
    if (this.closing) return Promise.reject(new StoreError('store-cerrado', 'El guardado ya se cerró'));
    this.ready ??= this.pool.query(SCHEMA).then(() => undefined);
    return this.ready;
  }

  async createAccount(name: string, password: string): Promise<AccountId> {
    await this.open();
    const hash = await hashPassword(password);
    const id = `a${randomBytes(8).toString('hex')}`;
    // The unique key does the race for us: two sign-ups with one name, only one row goes in.
    const inserted = await this.pool.query(
      'insert into bandera_accounts (id, name, name_key, password) values ($1, $2, $3, $4) on conflict (name_key) do nothing returning id',
      [id, name, name.toLowerCase(), hash],
    );
    if (!inserted.rowCount) throw new StoreError('nombre-tomado', 'Ese nombre ya existe');
    return id;
  }

  async verify(name: string, password: string): Promise<AccountId | null> {
    await this.open();
    const { rows } = await this.pool.query<{ id: string; password: string }>(
      'select id, password from bandera_accounts where name_key = $1',
      [name.toLowerCase()],
    );
    // Hash anyway for a missing name, so it answers as slowly as a wrong password.
    if (!rows[0]) {
      await hashPassword(password);
      return null;
    }
    return (await verifyPassword(password, rows[0].password)) ? rows[0].id : null;
  }

  private read(account: AccountId, id: CharacterId, raw: unknown) {
    const saved = migrate(raw);
    if (saved.character.id !== id || saved.character.accountId !== account)
      throw new StoreError('save-invalido', `El guardado de ${id} no corresponde a su cuenta`);
    return saved.character;
  }

  async listCharacters(account: AccountId): Promise<CharacterSummary[]> {
    await this.open();
    const { rows } = await this.pool.query<{ id: string; data: unknown }>(
      'select id, data from bandera_characters where account_id = $1 order by updated_at',
      [account],
    );
    return rows.map((row) => {
      const c = this.read(account, row.id, row.data);
      return { id: c.id, name: c.name, classId: c.classId, level: c.level, zoneId: c.zoneId };
    });
  }

  async createCharacter(account: AccountId, character: Character): Promise<void> {
    await this.open();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Locking the account row serialises creations for it, so two joins cannot both pass the cap.
      const owner = await client.query('select id from bandera_accounts where id = $1 for update', [account]);
      if (!owner.rowCount) throw new StoreError('no-existe', 'No existe la cuenta');
      const { rows } = await client.query<{ n: string }>('select count(*) as n from bandera_characters where account_id = $1', [account]);
      if (Number(rows[0].n) >= MAX_CHARACTERS)
        throw new StoreError('limite-personajes', `Ya tenés ${MAX_CHARACTERS} personajes`);
      await client.query('insert into bandera_characters (account_id, id, data) values ($1, $2, $3)', [
        account,
        character.id,
        JSON.stringify(envelope(character)),
      ]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async load(account: AccountId, id: CharacterId): Promise<Character | null> {
    await this.open();
    const { rows } = await this.pool.query<{ data: unknown }>(
      'select data from bandera_characters where account_id = $1 and id = $2',
      [account, id],
    );
    return rows[0] ? this.read(account, id, rows[0].data) : null;
  }

  async save(character: Character): Promise<void> {
    await this.open();
    try {
      await this.pool.query(
        `insert into bandera_characters (account_id, id, data) values ($1, $2, $3)
         on conflict (account_id, id) do update set data = excluded.data, updated_at = now()`,
        [character.accountId, character.id, JSON.stringify(envelope(character))],
      );
    } catch (error) {
      if ((error as { code?: string }).code === FOREIGN_KEY_VIOLATION)
        throw new StoreError('no-existe', 'No existe la cuenta');
      throw error;
    }
  }

  /** Waits for queries in flight, then drops the pool. Safe to call twice. */
  close(): Promise<void> {
    this.closing ??= this.pool.end();
    return this.closing;
  }
}
