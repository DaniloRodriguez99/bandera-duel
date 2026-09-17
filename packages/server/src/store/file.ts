import { randomBytes } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { Character } from '@bandera/shared/world';
import {
  AccountBook,
  StoreError,
  type AccountId,
  type BookData,
  type CharacterId,
  type CharacterStore,
} from './characters.js';
import { migrate } from './migrate.js';

/**
 * Every account and character in one JSON file.
 *
 * Meant for one process on one machine with a real disk (a VPS, a dev box). It is not a database:
 * the whole file is rewritten on each write, which is fine for hundreds of characters and the
 * reason bursts are coalesced. Cloud Run and Render's free plan have no persistent disk, so there
 * this file would vanish on every deploy.
 */

const FORMAT = 'bandera-duel/characters';
const FILE_VERSION = 1;

interface FileData extends BookData {
  format: typeof FORMAT;
  version: typeof FILE_VERSION;
}

const TEMP_SUFFIX = '.tmp';

function corrupt(path: string, reason: string): never {
  throw new StoreError('archivo-corrupto', `No se puede usar ${path}: ${reason}`);
}

/** Only the file's skeleton is checked here; each character is validated by `migrate` when read. */
function parse(path: string, text: string): AccountBook {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    corrupt(path, 'no es JSON válido');
  }
  const d = data as Partial<FileData> | null;
  if (!d || typeof d !== 'object' || d.format !== FORMAT) corrupt(path, 'no es un archivo de personajes');
  if (d.version !== FILE_VERSION) corrupt(path, `versión de archivo desconocida (${String(d.version)})`);
  if (!Number.isInteger(d.nextId) || d.nextId! < 1 || !Array.isArray(d.accounts)) corrupt(path, 'estructura rota');
  for (const a of d.accounts) {
    const ok =
      a && typeof a === 'object' &&
      typeof a.id === 'string' && typeof a.name === 'string' && typeof a.password === 'string' &&
      a.characters !== null && typeof a.characters === 'object' && !Array.isArray(a.characters);
    if (!ok) corrupt(path, 'una cuenta está rota');
  }
  try {
    return AccountBook.restore(d as FileData, migrate);
  } catch (error) {
    corrupt(path, (error as Error).message);
  }
}

export class FileStore implements CharacterStore {
  readonly path: string;
  /** Completed writes to disk. Exposed so tests can prove bursts are coalesced. */
  writes = 0;

  private book: Promise<AccountBook> | null = null;
  /** The write that has not started yet; every change made before it starts rides along. */
  private queued: Promise<void> | null = null;
  /** The tail of the write chain, so two writes never overlap. */
  private chain: Promise<void> = Promise.resolve();
  /** Set when the last write failed, so close() knows memory is ahead of the disk. */
  private behind = false;
  private closing: Promise<void> | null = null;
  private closed = false;

  constructor(path: string) {
    this.path = resolve(path);
  }

  /**
   * Loads once, lazily. A missing file is a new world; a file that exists but cannot be read is
   * NOT: starting empty would let the next save overwrite every real account with nothing. The
   * rejected promise is kept, so every later call refuses too.
   */
  private open(): Promise<AccountBook> {
    if (this.closing) return Promise.reject(new StoreError('store-cerrado', 'El guardado ya se cerró'));
    this.book ??= this.readBook();
    return this.book;
  }

  private async readBook(): Promise<AccountBook> {
    let text: string;
    try {
      text = await readFile(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') corrupt(this.path, (error as Error).message);
      await mkdir(dirname(this.path), { recursive: true });
      return new AccountBook(migrate);
    }
    const book = parse(this.path, text);
    await this.sweepTemps();
    return book;
  }

  /** A crash mid-write leaves a temp file behind. It was never renamed in, so it is only litter. */
  private async sweepTemps() {
    const prefix = `${basename(this.path)}.`;
    try {
      for (const name of await readdir(dirname(this.path)))
        if (name.startsWith(prefix) && name.endsWith(TEMP_SUFFIX))
          await rm(join(dirname(this.path), name), { force: true });
    } catch {}
  }

  /**
   * Asks for the current state to reach the disk. Resolves once a write that includes every change
   * made before this call is durable. Calls made while a write is queued share it, so a flush that
   * saves twenty characters at once costs one write, not twenty.
   */
  private persist(book: AccountBook): Promise<void> {
    // A change that finished after close() drained the queue has nowhere to go; say so loudly.
    if (this.closed) return Promise.reject(new StoreError('store-cerrado', 'El guardado ya se cerró'));
    if (this.queued) return this.queued;
    const next = this.chain
      .catch(() => {})
      // Let the rest of the current burst land in memory before taking the snapshot.
      .then(() => new Promise<void>((r) => setImmediate(r)))
      .then(() => {
        this.queued = null;
        return this.write(book);
      });
    this.queued = next;
    this.chain = next;
    return next;
  }

  private async write(book: AccountBook) {
    const data: FileData = { format: FORMAT, version: FILE_VERSION, ...book.toData() };
    const body = JSON.stringify(data);
    // Same directory as the target, so the rename is atomic: readers see the old file or the new
    // one, never half of it.
    const temp = `${this.path}.${process.pid}.${randomBytes(4).toString('hex')}${TEMP_SUFFIX}`;
    try {
      // Owner-only: the file holds every account's password hash.
      const handle = await open(temp, 'w', 0o600);
      try {
        await handle.writeFile(body);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temp, this.path);
    } catch (error) {
      this.behind = true;
      await rm(temp, { force: true }).catch(() => {});
      throw error;
    }
    // The rename lives in the directory entry; without syncing the directory a power cut can
    // undo it. Not every platform allows fsync on a directory, and the data file is already safe.
    try {
      const dir = await open(dirname(this.path), 'r');
      try {
        await dir.sync();
      } finally {
        await dir.close();
      }
    } catch {}
    this.behind = false;
    this.writes++;
  }

  async createAccount(name: string, password: string): Promise<AccountId> {
    const book = await this.open();
    const id = await book.createAccount(name, password);
    await this.persist(book);
    return id;
  }

  async verify(name: string, password: string): Promise<AccountId | null> {
    return (await this.open()).verify(name, password);
  }

  async listCharacters(account: AccountId) {
    return (await this.open()).listCharacters(account);
  }

  async createCharacter(account: AccountId, character: Character): Promise<void> {
    const book = await this.open();
    book.createCharacter(account, character);
    await this.persist(book);
  }

  async load(account: AccountId, id: CharacterId): Promise<Character | null> {
    return (await this.open()).load(account, id);
  }

  async save(character: Character): Promise<void> {
    const book = await this.open();
    book.save(character);
    await this.persist(book);
  }

  async saveMany(characters: Character[]): Promise<void> {
    const book = await this.open();
    book.saveMany(characters);
    await this.persist(book);
  }

  async partyFor(characterId: CharacterId) { return (await this.open()).partyFor(characterId); }
  async saveParty(party: import('@bandera/shared/world').Party) {
    const book = await this.open(); book.saveParty(party); await this.persist(book);
  }
  async deleteParty(id: string) {
    const book = await this.open(); book.deleteParty(id); await this.persist(book);
  }

  /** Waits for the pending write; if the last one failed, tries once more before giving up. */
  close(): Promise<void> {
    this.closing ??= (async () => {
      // Operations already past open() may still queue a write while we wait; drain until quiet.
      let tail;
      do {
        tail = this.chain;
        await tail.catch(() => {});
      } while (tail !== this.chain);
      this.closed = true;
      if (this.behind && this.book) await this.write(await this.book);
    })();
    return this.closing;
  }
}
