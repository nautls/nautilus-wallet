import { omit } from "es-toolkit";
import { storage } from "webextension-polyfill";
import {
  decryptSecret,
  EncryptedSecret,
  encryptSecret,
  fromLegacyCiphertext
} from "@/common/keystore";
import { dbContext } from "@/database/dbContext";
import { IDbWallet, IDbWalletWithSecret, NotNullId } from "@/types/database";
import { WalletSettings } from "@/types/internal";

export type WalletPatch = {
  name?: string;
  settings?: WalletSettings;
  lastSynced?: number;
};

type Wallet = NotNullId<IDbWallet>;

const SCHEMA_VERSION = 1;
const WALLET_KEY_PREFIX = "wallet:";
const SECRET_KEY_PREFIX = "walletSecret:";
const NEXT_ID_KEY = "wallets:nextId";
const SCHEMA_VERSION_KEY = "wallets:schemaVersion";
const LOCK_NAME = "nautilus:wallets";

const walletKey = (id: number) => `${WALLET_KEY_PREFIX}${id}`;
const secretKey = (id: number) => `${SECRET_KEY_PREFIX}${id}`;

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(LOCK_NAME, fn) : fn();
}

class WalletsDbService {
  #migration?: Promise<void>;

  public async getById(id: number): Promise<Wallet | undefined> {
    await this.migrate();
    return readWallet(id);
  }

  public async getMnemonic(id: number, password: string) {
    await this.migrate();

    const secret = await readSecret(id);
    if (!secret) {
      throw Error("wallet doesn't have a mnemonic phrase");
    }

    return decryptSecret(secret, password);
  }

  public async changePassword(id: number, currentPassword: string, newPassword: string) {
    await this.migrate();

    const current = await readSecret(id);
    const mnemonic = await this.getMnemonic(id, currentPassword);
    const encrypted = await encryptSecret(mnemonic, newPassword);

    await withLock(async () => {
      if (!(await readWallet(id))) throw Error("wallet not found");
      if ((await readSecret(id))?.ciphertext !== current?.ciphertext) {
        throw Error("the spending password was changed meanwhile");
      }

      await storage.local.set({ [secretKey(id)]: encrypted });
      // drop the pre-migration copy, still encrypted with the old password
      await dbContext.wallets.delete(id);
    });
  }

  public async put(wallet: IDbWalletWithSecret): Promise<number> {
    await this.migrate();

    return withLock(async () => {
      const dbWallet = (await readAllWallets()).find((w) => w.publicKey === wallet.publicKey);
      const id = wallet.id ?? dbWallet?.id ?? (await allocateId());
      const record = { ...omit(wallet, ["crypto"]), id };

      if (wallet.crypto) {
        await storage.local.set({ [walletKey(id)]: record, [secretKey(id)]: wallet.crypto });
      } else {
        await storage.local.set({ [walletKey(id)]: record });
        await storage.local.remove(secretKey(id));
      }

      return id;
    });
  }

  public async updateSettings(id: number, patch: WalletPatch): Promise<number> {
    await this.migrate();

    return withLock(async () => {
      const wallet = await readWallet(id);
      if (!wallet) return 0;

      await storage.local.set({ [walletKey(id)]: { ...wallet, ...patch } });
      return 1;
    });
  }

  public async getAll(): Promise<Wallet[]> {
    await this.migrate();
    return readAllWallets();
  }

  public async delete(walletId: number): Promise<void> {
    await this.migrate();

    await Promise.all([
      dbContext.addresses.where({ walletId }).delete(),
      dbContext.assets.where({ walletId }).delete(),
      dbContext.connectedDApps.where({ walletId }).delete(),
      dbContext.utxos.where({ walletId }).delete(),
      withLock(async () => {
        await storage.local.remove([walletKey(walletId), secretKey(walletId)]);
        await dbContext.wallets.delete(walletId);
      })
    ]);
  }

  /**
   * Moves wallets from IndexedDB to `browser.storage.local`. Runs on extension install and
   * update, and lazily before any read or write, in case that one is still running or failed.
   */
  public migrate(): Promise<void> {
    if (!this.#migration) {
      this.#migration = withLock(migrateFromIndexedDb).catch((e) => {
        this.#migration = undefined; // retry on next call
        throw e;
      });
    }

    return this.#migration;
  }
}

async function readWallet(id: number): Promise<Wallet | undefined> {
  const key = walletKey(id);
  const stored = await storage.local.get(key);
  return stored[key] as Wallet | undefined;
}

async function readSecret(id: number): Promise<EncryptedSecret | undefined> {
  const key = secretKey(id);
  const stored = await storage.local.get(key);
  return stored[key] as EncryptedSecret | undefined;
}

const isWalletKey = (key: string) => key.startsWith(WALLET_KEY_PREFIX);

async function readAllWallets(): Promise<Wallet[]> {
  // read only wallet keys when supported (Chrome 130+, Firefox 143+), otherwise
  // everything, including large entries such as token blacklists and prices
  const stored = storage.local.getKeys
    ? await storage.local.get((await storage.local.getKeys()).filter(isWalletKey))
    : await storage.local.get(null);

  return Object.entries(stored)
    .filter(([key]) => isWalletKey(key))
    .map(([, wallet]) => wallet as Wallet)
    .sort((a, b) => a.id - b.id);
}

async function allocateId(): Promise<number> {
  const stored = await storage.local.get(NEXT_ID_KEY);
  const id = (stored[NEXT_ID_KEY] as number | undefined) ?? 1;
  await storage.local.set({ [NEXT_ID_KEY]: id + 1 });

  return id;
}

/**
 * Copies wallets from the IndexedDB `wallets` table to `browser.storage.local`, keeping
 * their ids, as other tables and settings reference wallets by id. Wallets already in
 * `browser.storage.local` are never overwritten, so it's safe to run more than once.
 */
async function migrateFromIndexedDb(): Promise<void> {
  const stored = await storage.local.get([SCHEMA_VERSION_KEY, NEXT_ID_KEY]);
  if (((stored[SCHEMA_VERSION_KEY] as number | undefined) ?? 0) >= SCHEMA_VERSION) return;

  const legacyWallets = await dbContext.wallets.toArray();
  if (legacyWallets.length === 0) {
    if ((await readAllWallets()).length > 0) {
      await storage.local.set({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
    }

    return;
  }

  const keys = legacyWallets.map((w) => walletKey(w.id!));
  const existing = await storage.local.get(keys);

  const items: Record<string, unknown> = {};
  for (const wallet of legacyWallets) {
    const id = wallet.id!;
    if (existing[walletKey(id)]) continue;

    const { mnemonic, ...rest } = wallet;
    items[walletKey(id)] = { ...rest, id };
    if (mnemonic) items[secretKey(id)] = fromLegacyCiphertext(mnemonic);
  }

  const maxId = Math.max(...legacyWallets.map((w) => w.id!));
  const nextId = Math.max((stored[NEXT_ID_KEY] as number | undefined) ?? 1, maxId + 1);
  await storage.local.set({ ...items, [NEXT_ID_KEY]: nextId });

  const written = await storage.local.get(Object.keys(items));
  for (const wallet of legacyWallets) {
    const id = wallet.id!;
    if (existing[walletKey(id)]) continue;

    const migrated = written[walletKey(id)] as Wallet | undefined;
    const secret = written[secretKey(id)] as EncryptedSecret | undefined;
    if (
      migrated?.publicKey !== wallet.publicKey ||
      (secret?.ciphertext || undefined) !== (wallet.mnemonic || undefined)
    ) {
      throw Error(`failed to migrate wallet ${wallet.id} to extension storage`);
    }
  }

  await storage.local.set({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
}

export const walletsDbService = new WalletsDbService();
