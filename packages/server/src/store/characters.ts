import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Character } from '@bandera/shared/world';

/**
 * Where characters live between sessions.
 *
 * The world keeps them in memory while people play; this is the only thing that outlives the
 * process. `MemoryStore` ships by default so development and the tests need no infrastructure,
 * and a Postgres driver takes its place in production by implementing the same interface.
 */

export type AccountId = string;
export type CharacterId = string;

/** The shape written to storage. `version` lets a later migration recognise old saves. */
export interface SavedCharacter {
  version: 1;
  character: Character;
  updatedAt: number;
}

export interface CharacterSummary {
  id: CharacterId;
  name: string;
  classId: Character['classId'];
  level: number;
  zoneId: Character['zoneId'];
}

export const MAX_CHARACTERS = 5;

export class StoreError extends Error {
  constructor(
    readonly code: 'nombre-tomado' | 'clave-incorrecta' | 'limite-personajes' | 'no-existe',
    message: string,
  ) {
    super(message);
  }
}

export interface CharacterStore {
  /** Creates an account, or throws `nombre-tomado`. */
  createAccount(name: string, password: string): Promise<AccountId>;
  /** Returns the account id, or null when the name or the password is wrong. */
  verify(name: string, password: string): Promise<AccountId | null>;
  listCharacters(account: AccountId): Promise<CharacterSummary[]>;
  createCharacter(account: AccountId, character: Character): Promise<void>;
  load(account: AccountId, id: CharacterId): Promise<Character | null>;
  save(character: Character): Promise<void>;
  close(): Promise<void>;
}

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Hashes a password with a per-account random salt.
 *
 * Always the asynchronous scrypt: the synchronous one blocks for about 100 ms by design, which
 * on this server would freeze the 30 Hz simulation tick for everyone every time somebody logs in.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

interface Account {
  id: AccountId;
  name: string;
  password: string;
  characters: Map<CharacterId, SavedCharacter>;
}

/**
 * The default driver. Everything dies with the process, which is fine for development and for
 * the tests, and is the reason production must point `DATABASE_URL` at a real database.
 */
export class MemoryStore implements CharacterStore {
  private accounts = new Map<string, Account>();
  private nextId = 1;

  private byName(name: string) {
    return this.accounts.get(name.toLowerCase());
  }

  async createAccount(name: string, password: string): Promise<AccountId> {
    if (this.byName(name)) throw new StoreError('nombre-tomado', 'Ese nombre ya existe');
    const id = `a${this.nextId++}`;
    this.accounts.set(name.toLowerCase(), {
      id,
      name,
      password: await hashPassword(password),
      characters: new Map(),
    });
    return id;
  }

  async verify(name: string, password: string): Promise<AccountId | null> {
    const account = this.byName(name);
    // Hash anyway when the account does not exist, so a missing name and a wrong password take
    // the same time to answer and cannot be told apart.
    if (!account) {
      await hashPassword(password);
      return null;
    }
    return (await verifyPassword(password, account.password)) ? account.id : null;
  }

  private find(account: AccountId) {
    for (const entry of this.accounts.values()) if (entry.id === account) return entry;
    return undefined;
  }

  async listCharacters(account: AccountId): Promise<CharacterSummary[]> {
    const entry = this.find(account);
    if (!entry) return [];
    return [...entry.characters.values()].map(({ character }) => ({
      id: character.id,
      name: character.name,
      classId: character.classId,
      level: character.level,
      zoneId: character.zoneId,
    }));
  }

  async createCharacter(account: AccountId, character: Character): Promise<void> {
    const entry = this.find(account);
    if (!entry) throw new StoreError('no-existe', 'No existe la cuenta');
    // Counted and inserted together, so two joins at once cannot both slip past the cap.
    if (entry.characters.size >= MAX_CHARACTERS)
      throw new StoreError('limite-personajes', `Ya tenés ${MAX_CHARACTERS} personajes`);
    entry.characters.set(character.id, { version: 1, character, updatedAt: 0 });
  }

  async load(account: AccountId, id: CharacterId): Promise<Character | null> {
    const saved = this.find(account)?.characters.get(id);
    return saved ? { ...saved.character } : null;
  }

  async save(character: Character): Promise<void> {
    const entry = this.find(character.accountId);
    if (!entry) throw new StoreError('no-existe', 'No existe la cuenta');
    entry.characters.set(character.id, { version: 1, character, updatedAt: 0 });
  }

  async close(): Promise<void> {}
}
