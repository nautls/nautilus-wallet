import { omit } from "es-toolkit";
import { storage } from "webextension-polyfill";
import { decryptSecret, EncryptedSecret, encryptSecret } from "@/common/keystore";
import { dbContext } from "@/database/dbContext";
import { IDbWallet, IDbWalletWithSecret, NotNullId } from "@/types/database";
import { WalletSettings } from "@/types/internal";

export type WalletPatch = {
  name?: string;
  settings?: WalletSettings;
  lastSynced?: number;
};

type Wallet = NotNullId<IDbWallet>;

const WALLET_KEY_PREFIX = "wallet:";
const SECRET_KEY_PREFIX = "walletSecret:";
export const NEXT_ID_KEY = "wallets:nextId";
const LOCK_NAME = "nautilus:wallets";

export const walletKey = (id: number) => `${WALLET_KEY_PREFIX}${id}`;
export const secretKey = (id: number) => `${SECRET_KEY_PREFIX}${id}`;

export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(LOCK_NAME, fn) : fn();
}

class WalletsDbService {
  public async getById(id: number): Promise<Wallet | undefined> {
    return readWallet(id);
  }

  public async getMnemonic(id: number, password: string) {
    const secret = await readSecret(id);
    if (!secret) {
      throw Error("wallet doesn't have a mnemonic phrase");
    }

    return decryptSecret(secret, password);
  }

  public async changePassword(id: number, currentPassword: string, newPassword: string) {
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
    return withLock(async () => {
      const wallet = await readWallet(id);
      if (!wallet) return 0;

      await storage.local.set({ [walletKey(id)]: { ...wallet, ...patch } });
      return 1;
    });
  }

  public async getAll(): Promise<Wallet[]> {
    return readAllWallets();
  }

  public async delete(walletId: number): Promise<void> {
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

export const walletsDbService = new WalletsDbService();
