import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Character, Party } from '@bandera/shared/world';

/**
 * Where characters live between sessions.
 *
 * The world keeps them in memory while people play; this is the only thing that outlives the
 * process. `MemoryStore` ships by default so development and the tests need no infrastructure,
 * `FileStore` keeps them in one JSON file for a single machine with a disk, and a Postgres driver
 * takes their place in production by implementing the same interface (see `storeFromEnv`).
 */

export type AccountId = string;
export type CharacterId = string;

/** Bumped whenever the saved shape changes; `migrate` knows how to climb from every older one. */
export const SAVE_VERSION = 1;

/** The shape written to storage. `version` lets `migrate` recognise old saves. */
export interface SavedCharacter {
  version: typeof SAVE_VERSION;
  character: Character;
  updatedAt: number;
}

export interface CharacterSummary {
  id: CharacterId;
  name: string;
  classId: Character['classId'];
  level: number;
  zoneId: Character['zoneId'];
  weapon: Character['weapon'];
  affinity: keyof Character['affinities'] | null;
}

export const MAX_CHARACTERS = 5;

export class StoreError extends Error {
  constructor(
    readonly code:
      | 'nombre-tomado'
      | 'clave-incorrecta'
      | 'limite-personajes'
      | 'no-existe'
      /** A save that fails validation. Never answered by resetting the character. */
      | 'save-invalido'
      /** A save written by a newer server than this one, typically after a rollback. */
      | 'save-futuro'
      /** The storage file exists but cannot be read or parsed; the driver refuses to start empty. */
      | 'archivo-corrupto'
      | 'store-cerrado',
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
  saveMany(characters: Character[]): Promise<void>;
  partyFor(characterId: CharacterId): Promise<Party | null>;
  saveParty(party: Party): Promise<void>;
  deleteParty(id: string): Promise<void>;
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

/** One account as a driver holds it. Characters stay raw until read, so a driver that loaded them
 * from disk can migrate and validate each one on the way out without touching the others. */
interface Account {
  id: AccountId;
  name: string;
  password: string;
  characters: Map<CharacterId, unknown>;
}

/** The serialisable form of an `AccountBook`, for drivers that write it somewhere. */
export interface BookData {
  nextId: number;
  accounts: { id: AccountId; name: string; password: string; characters: Record<CharacterId, unknown> }[];
  parties?: Party[];
}

export const envelope = (character: Character): SavedCharacter => ({
  version: SAVE_VERSION,
  // A copy, never the live object: the world keeps mutating its character between saves, and
  // sharing nested objects (stats, skills) would let unsaved progress leak into the store.
  character: structuredClone(character),
  updatedAt: Date.now(),
});

/**
 * The account and character bookkeeping every driver that keeps the data in memory shares:
 * `MemoryStore` is nothing else, and `FileStore` is this plus writing it to disk.
 */
export class AccountBook {
  private byName = new Map<string, Account>();
  private byId = new Map<AccountId, Account>();
  private nextId = 1;
  private parties = new Map<string, Party>();

  /** `read` turns a stored entry into a current save; persistent drivers pass `migrate`. */
  constructor(private readonly read: (raw: unknown) => SavedCharacter = (raw) => raw as SavedCharacter) {}

  static restore(data: BookData, read: (raw: unknown) => SavedCharacter): AccountBook {
    const book = new AccountBook(read);
    let highest = 0;
    for (const entry of data.accounts) {
      if (book.byName.has(entry.name.toLowerCase()) || book.byId.has(entry.id))
        throw new Error(`Cuenta repetida: ${entry.name}`);
      book.insert({ ...entry, characters: new Map(Object.entries(entry.characters)) });
      const n = Number(/^a(\d+)$/.exec(entry.id)?.[1] ?? 0);
      highest = Math.max(highest, n);
    }
    for (const party of data.parties ?? []) book.parties.set(party.id, structuredClone(party));
    // Never hand out an id that already exists, even if the counter in the file is stale.
    book.nextId = Math.max(data.nextId, highest + 1);
    return book;
  }

  toData(): BookData {
    return {
      nextId: this.nextId,
      accounts: [...this.byId.values()].map((a) => ({
        id: a.id,
        name: a.name,
        password: a.password,
        characters: Object.fromEntries(a.characters),
      })),
      parties: [...this.parties.values()].map((p) => structuredClone(p)),
    };
  }

  private insert(account: Account) {
    this.byName.set(account.name.toLowerCase(), account);
    this.byId.set(account.id, account);
  }

  private owner(account: AccountId): Account {
    const entry = this.byId.get(account);
    if (!entry) throw new StoreError('no-existe', 'No existe la cuenta');
    return entry;
  }

  private saved(account: Account, id: CharacterId): SavedCharacter | null {
    const raw = account.characters.get(id);
    if (raw === undefined) return null;
    const saved = this.read(raw);
    if (saved.character.id !== id || saved.character.accountId !== account.id)
      throw new StoreError('save-invalido', `El guardado de ${id} no corresponde a su cuenta`);
    return saved;
  }

  async createAccount(name: string, password: string): Promise<AccountId> {
    // Hash first, then check and insert with no await in between, so two sign-ups with the same
    // name at the same moment cannot both pass the check.
    const hash = await hashPassword(password);
    if (this.byName.has(name.toLowerCase())) throw new StoreError('nombre-tomado', 'Ese nombre ya existe');
    const id = `a${this.nextId++}`;
    this.insert({ id, name, password: hash, characters: new Map() });
    return id;
  }

  async verify(name: string, password: string): Promise<AccountId | null> {
    const account = this.byName.get(name.toLowerCase());
    // Hash anyway when the account does not exist, so a missing name and a wrong password take
    // the same time to answer and cannot be told apart.
    if (!account) {
      await hashPassword(password);
      return null;
    }
    return (await verifyPassword(password, account.password)) ? account.id : null;
  }

  listCharacters(account: AccountId): CharacterSummary[] {
    const entry = this.byId.get(account);
    if (!entry) return [];
    return [...entry.characters.keys()].map((id) => {
      const { character } = this.saved(entry, id)!;
      return {
        id: character.id,
        name: character.name,
        classId: character.classId,
        level: character.level,
        zoneId: character.zoneId,
        weapon: character.weapon,
        affinity: (Object.keys(character.affinities)[0] as keyof Character['affinities']) ?? null,
      };
    });
  }

  createCharacter(account: AccountId, character: Character): void {
    const entry = this.owner(account);
    // Counted and inserted together, so two joins at once cannot both slip past the cap.
    if (entry.characters.size >= MAX_CHARACTERS)
      throw new StoreError('limite-personajes', `Ya tenés ${MAX_CHARACTERS} personajes`);
    entry.characters.set(character.id, envelope(character));
  }

  load(account: AccountId, id: CharacterId): Character | null {
    const entry = this.byId.get(account);
    const saved = entry ? this.saved(entry, id) : null;
    return saved ? structuredClone(saved.character) : null;
  }

  save(character: Character): void {
    this.owner(character.accountId).characters.set(character.id, envelope(character));
  }

  saveMany(characters: Character[]): void {
    for (const character of characters) this.owner(character.accountId);
    for (const character of characters) this.save(character);
  }

  partyFor(characterId: CharacterId): Party | null {
    const party = [...this.parties.values()].find((p) => p.members.some((m) => m.id === characterId));
    return party ? structuredClone(party) : null;
  }

  saveParty(party: Party): void {
    this.parties.set(party.id, structuredClone(party));
  }

  deleteParty(id: string): void { this.parties.delete(id); }
}

/**
 * The default driver. Everything dies with the process, which is fine for development and for
 * the tests, and is the reason production must point `DATABASE_URL` at a real database.
 */
export class MemoryStore implements CharacterStore {
  private book = new AccountBook();

  createAccount(name: string, password: string) {
    return this.book.createAccount(name, password);
  }

  verify(name: string, password: string) {
    return this.book.verify(name, password);
  }

  async listCharacters(account: AccountId) {
    return this.book.listCharacters(account);
  }

  async createCharacter(account: AccountId, character: Character) {
    this.book.createCharacter(account, character);
  }

  async load(account: AccountId, id: CharacterId) {
    return this.book.load(account, id);
  }

  async save(character: Character) {
    this.book.save(character);
  }

  async saveMany(characters: Character[]) { this.book.saveMany(characters); }
  async partyFor(characterId: CharacterId) { return this.book.partyFor(characterId); }
  async saveParty(party: Party) { this.book.saveParty(party); }
  async deleteParty(id: string) { this.book.deleteParty(id); }

  async close(): Promise<void> {}
}
