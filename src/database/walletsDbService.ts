import { isEqual } from "es-toolkit";
import { storage } from "webextension-polyfill";
import {
  createMasterKey,
  decryptSecret,
  EncryptedSecret,
  encryptSecret,
  MasterKeyRecord,
  needsUpgrade,
  SecretProtection,
  unlockMasterKey
} from "@/common/keystore";
import { PasswordError } from "@/common/errors";
import { log } from "@/common/logger";
import { dbContext } from "@/database/dbContext";
import { IDbWallet, NotNullId } from "@/types/database";
import { WalletSettings } from "@/types/internal";

export type WalletPatch = {
  name?: string;
  settings?: WalletSettings;
  needsBackup?: boolean;
};

export type PlainSecret = {
  value: string;
  password: string;
  by: PasswordKind;
};

export type PasswordKind = "master" | "password";

type Wallet = NotNullId<IDbWallet>;

const WALLET_KEY_PREFIX = "wallet:";
const SECRET_KEY_PREFIX = "walletSecret:";
export const NEXT_ID_KEY = "wallets:nextId";
export const MASTER_KEY = "masterKey";
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

  /**
   * Decrypts the wallet's secret. Records on an older scheme are re-encrypted with the
   * current one on success; a failed upgrade is logged and never fails the call.
   *
   * @throws {PasswordError} if the password is wrong.
   */
  public async getSecret(id: number, password: string): Promise<string> {
    const { wallet, encrypted, master } = await readWalletWithSecret(id);
    const secret = await decryptSecret(encrypted, wallet.publicKey, password, master);

    if (needsUpgrade(encrypted)) {
      try {
        await upgradeSecret(id, encrypted, secret, password);
      } catch (e) {
        log.error("failed to upgrade the wallet's secret encryption", e);
      }
    }

    return secret;
  }

  public async getPasswordKind(id: number): Promise<PasswordKind | undefined> {
    const encrypted = await readSecret(id);
    if (!encrypted) return;
    return encrypted.version === 2 && encrypted.wrappedKey.by === "master" ? "master" : "password";
  }

  public async hasMasterPassword(): Promise<boolean> {
    return (await readMasterKey()) !== undefined;
  }

  /** @returns false if the password is wrong or the master password isn't set up. */
  public async verifyMasterPassword(password: string): Promise<boolean> {
    const master = await readMasterKey();
    if (!master) return false;

    try {
      await unlockMasterKey(master, password);
      return true;
    } catch (e) {
      if (e instanceof PasswordError) return false;
      throw e;
    }
  }

  public async changePassword(id: number, currentPassword: string, newPassword: string) {
    const { wallet, encrypted: current } = await readWalletWithSecret(id);
    if (current.version === 2 && current.wrappedKey.by === "master") {
      throw Error("this wallet uses the master password");
    }

    const secret = await decryptSecret(current, wallet.publicKey, currentPassword);
    const encrypted = await encryptSecret(secret, wallet.publicKey, {
      by: "password",
      password: newPassword
    });

    await withLock(async () => {
      if (!(await readWallet(id))) throw Error("wallet not found");
      if (!isEqual(await readSecret(id), current)) {
        throw Error("the spending password was changed meanwhile");
      }

      await storage.local.set({ [secretKey(id)]: encrypted });
      // drop the pre-migration copy, still encrypted with the old password
      await dbContext.wallets.delete(id);
    });
  }

  public async put(wallet: IDbWallet, secret?: PlainSecret): Promise<number> {
    const { encrypted, master } = secret
      ? await protect(secret, wallet.publicKey)
      : { encrypted: undefined, master: undefined };

    return withLock(async () => {
      if (master && !isEqual(await readMasterKey(), master.current)) {
        throw Error("the master password was changed meanwhile");
      }

      const dbWallet = (await readAllWallets()).find((w) => w.publicKey === wallet.publicKey);
      const id = wallet.id ?? dbWallet?.id ?? (await allocateId());
      const record = { ...wallet, id };

      if (encrypted) {
        await storage.local.set({
          [walletKey(id)]: record,
          [secretKey(id)]: encrypted,
          // a new master password is only stored along with its first wallet
          ...(master?.created && { [MASTER_KEY]: master.created })
        });
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

  public onChange(listener: () => void): () => void {
    const handler = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && Object.keys(changes).some(isWalletKey)) listener();
    };

    storage.onChanged.addListener(handler);
    return () => storage.onChanged.removeListener(handler);
  }

  public async delete(walletId: number): Promise<void> {
    await Promise.all([
      dbContext.addresses.where({ walletId }).delete(),
      dbContext.assets.where({ walletId }).delete(),
      dbContext.connectedDApps.where({ walletId }).delete(),
      dbContext.utxos.where({ walletId }).delete(),
      dbContext.walletSync.delete(walletId),
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

async function readWalletWithSecret(id: number) {
  const stored = await storage.local.get([walletKey(id), secretKey(id), MASTER_KEY]);
  const wallet = stored[walletKey(id)] as Wallet | undefined;
  const encrypted = stored[secretKey(id)] as EncryptedSecret | undefined;
  const master = stored[MASTER_KEY] as MasterKeyRecord | undefined;
  if (!wallet) throw Error("wallet not found");
  if (!encrypted) throw Error("wallet doesn't have a secret phrase");

  return { wallet, encrypted, master };
}

async function readMasterKey(): Promise<MasterKeyRecord | undefined> {
  const stored = await storage.local.get(MASTER_KEY);
  return stored[MASTER_KEY] as MasterKeyRecord | undefined;
}

async function protect(secret: PlainSecret, publicKey: string) {
  if (secret.by === "password") {
    const protection: SecretProtection = { by: "password", password: secret.password };
    return {
      encrypted: await encryptSecret(secret.value, publicKey, protection),
      master: undefined
    };
  }

  const current = await readMasterKey();
  const { masterKey, record: created } = current
    ? { masterKey: await unlockMasterKey(current, secret.password), record: undefined }
    : await createMasterKey(secret.password);

  return {
    encrypted: await encryptSecret(secret.value, publicKey, { by: "master", masterKey }),
    master: { current, created }
  };
}

/**
 * Re-encrypts `secret` with the current scheme
 */
async function upgradeSecret(
  id: number,
  current: EncryptedSecret,
  secret: string,
  password: string
) {
  const wallet = await readWallet(id);
  if (!wallet) return;
  const upgraded = await encryptSecret(secret, wallet.publicKey, { by: "password", password });

  await withLock(async () => {
    const stillWallet = await readWallet(id);
    if (!stillWallet || stillWallet.publicKey !== wallet.publicKey) return;
    if (!isEqual(await readSecret(id), current)) return;

    await storage.local.set({ [secretKey(id)]: upgraded });
  });
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
