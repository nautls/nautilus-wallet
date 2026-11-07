import { isEqual } from "es-toolkit";
import { storage } from "webextension-polyfill";
import {
  changeMasterKeyPassword,
  createMasterKey,
  decryptSecret,
  decryptSecretWithMasterKey,
  EncryptedSecret,
  encryptSecret,
  joinMasterKeyHalves,
  MasterKey,
  MasterKeyHalves,
  MasterKeyRecord,
  needsUpgrade,
  unlockMasterKey,
  unlockSplitMasterKey
} from "@/common/keystore";
import { MasterPasswordChangedError, PasswordError, SessionLockedError } from "@/common/errors";
import { log } from "@/common/logger";
import { dbContext } from "@/database/dbContext";
import {
  clearUnlockSession,
  endUnlockSessionOnSystemLock,
  expireUnlockSession,
  getUnlockTimeout,
  isUnlockSessionChange,
  isUnlockSessionEnabled,
  isUnlockSettingChange,
  isUnlockSessionSupported,
  readUnlockSession,
  setUnlockTimeout,
  startUnlockSession,
  touchUnlockSession,
  UnlockTimeout
} from "@/database/unlockSession";
import { IDbWallet, NotNullId } from "@/types/database";
import { WalletSettings } from "@/types/internal";

export type WalletPatch = {
  name?: string;
  settings?: WalletSettings;
  needsBackup?: boolean;
};

export type PlainSecret = {
  value: string;
  /** Leave out for the master password to use the unlock session. */
  password?: string;
  by: PasswordKind;
};

export type PasswordKind = "master" | "password";

type Wallet = NotNullId<IDbWallet>;
type Move = { id: number; current: EncryptedSecret; encrypted: EncryptedSecret };
type MasterChange = { current?: MasterKeyRecord; created?: MasterKeyRecord };

const WALLET_KEY_PREFIX = "wallet:";
const SECRET_KEY_PREFIX = "walletSecret:";
export const NEXT_ID_KEY = "wallets:nextId";
export const MASTER_KEY = "masterKey";
const LOCK_NAME = "nautilus:wallets";

export const walletKey = (id: number) => `${WALLET_KEY_PREFIX}${id}`;
export const secretKey = (id: number) => `${SECRET_KEY_PREFIX}${id}`;

/**
 * Runs `fn` holding the wallets lock, shared by every extension page and the service
 * worker. Writing without it could lose concurrent changes, so a missing Web Locks API
 * fails loudly instead.
 */
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (!navigator.locks) return Promise.reject(Error("the Web Locks API isn't available"));
  return navigator.locks.request(LOCK_NAME, fn);
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

  /**
   * Like {@link getSecret}, for signing: a wallet on the master password can use the
   * unlock session, and typing the master password starts one when it's enabled.
   *
   * @param password leave out to use the unlock session.
   * @throws {SessionLockedError} if `password` is left out and no session is active.
   */
  public async getSigningSecret(id: number, password?: string): Promise<string> {
    const { wallet, encrypted, master } = await readWalletWithSecret(id);
    if (!master || !usesMaster(encrypted)) {
      if (password === undefined) throw new SessionLockedError();
      return this.getSecret(id, password);
    }

    if (password === undefined) {
      const masterKey = await sessionMasterKey(master);
      try {
        return await decryptSecretWithMasterKey(encrypted, wallet.publicKey, masterKey);
      } catch (e) {
        if (!(e instanceof PasswordError)) throw e;
        await clearUnlockSession();
        throw new SessionLockedError();
      }
    }

    if (!(await isUnlockSessionEnabled())) return this.getSecret(id, password);

    const { masterKey, halves } = await unlockSplitMasterKey(master, password);
    const secret = await decryptSecretWithMasterKey(encrypted, wallet.publicKey, masterKey);
    await startSession(master, halves).catch((e) => log.error("failed to start the session", e));

    return secret;
  }

  /** Whether wallets on the master password can sign without typing it. */
  public async isUnlocked(): Promise<boolean> {
    const master = await readMasterKey();
    return !!master && (await readSession(master)) !== undefined;
  }

  /**
   * Starts a session with the master password, without signing anything.
   *
   * @throws {PasswordError} if the password is wrong.
   */
  public async unlock(password: string) {
    const master = await readMasterKey();
    if (!master) throw Error("the master password isn't set up");
    if (!(await isUnlockSessionEnabled())) throw Error("the unlock session is turned off");

    const { halves } = await unlockSplitMasterKey(master, password);
    await startSession(master, halves);
  }

  public lock(): Promise<void> {
    return withLock(clearUnlockSession);
  }

  /** Whether a session can be started: it's turned on and a wallet uses the master password. */
  public async canUnlock(): Promise<boolean> {
    if (!(await isUnlockSessionEnabled()) || !(await readMasterKey())) return false;
    return (await readAllSecrets()).some(usesMaster);
  }

  public isUnlockSessionSupported(): boolean {
    return isUnlockSessionSupported();
  }

  public isUnlockSessionEnabled(): Promise<boolean> {
    return isUnlockSessionEnabled();
  }

  public getUnlockTimeout(): Promise<UnlockTimeout> {
    return getUnlockTimeout();
  }

  /** Turning it off ends the session, and so does a timeout shorter than its idle time. */
  public setUnlockTimeout(timeout: UnlockTimeout): Promise<void> {
    return withLock(() => setUnlockTimeout(timeout));
  }

  public expireSession(): Promise<void> {
    return withLock(() => expireUnlockSession());
  }

  public onSystemLock(): Promise<void> {
    return withLock(() => endUnlockSessionOnSystemLock());
  }

  /** Calls `listener` when the session may have started or ended, in any page. */
  public onUnlockSessionChange(listener: () => void): () => void {
    return subscribe(
      (changes, area) =>
        isUnlockSessionChange(changes, area) || (area === "local" && MASTER_KEY in changes),
      listener
    );
  }

  /** Calls `listener` when {@link canUnlock} may have changed, in any page. */
  public onUnlockAvailabilityChange(listener: () => void): () => void {
    const masterChange = (key: string) => key === MASTER_KEY || isSecretKey(key);
    return subscribe(
      (changes, area) =>
        isUnlockSettingChange(changes, area) ||
        (area === "local" && Object.keys(changes).some(masterChange)),
      listener
    );
  }

  /** Calls `listener` when {@link getPasswordKind} may have changed for `id`, in any page. */
  public onPasswordKindChange(id: number, listener: () => void): () => void {
    return subscribe((changes, area) => area === "local" && secretKey(id) in changes, listener);
  }

  public async getPasswordKind(id: number): Promise<PasswordKind | undefined> {
    const encrypted = await readSecret(id);
    if (!encrypted) return;
    return usesMaster(encrypted) ? "master" : "password";
  }

  /** How many wallets use the master password, out of all wallets with a secret. */
  public async getMasterPasswordUsage(): Promise<{ used: number; total: number }> {
    const secrets = await readAllSecrets();
    return { used: secrets.filter(usesMaster).length, total: secrets.length };
  }

  /**
   * Sets up the master password and moves `wallets` to it, in a single write.
   *
   * @param wallets wallets on their own password, with that password.
   * @throws {PasswordError} with the `walletIds` whose password is wrong; nothing is written.
   */
  public async setUpMasterPassword(
    password: string,
    wallets: { id: number; password: string }[] = []
  ) {
    const { record, masterKey } = await createMasterKey(password);

    const results = await Promise.allSettled(
      wallets.map(async ({ id, password }): Promise<Move> => {
        const { wallet, encrypted: current } = await readWalletWithSecret(id);
        if (usesMaster(current)) throw Error("this wallet already uses the master password");

        const secret = await decryptSecret(current, wallet.publicKey, password);
        const encrypted = await encryptSecret(secret, wallet.publicKey, {
          by: "master",
          masterKey
        });
        return { id, current, encrypted };
      })
    );

    const wrongIds = results.flatMap((result, i) =>
      result.status === "rejected" && result.reason instanceof PasswordError ? [wallets[i].id] : []
    );
    if (wrongIds.length) throw new PasswordError(undefined, "password", wrongIds);

    const moves = results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });

    await withLock(async () => {
      if (await readMasterKey()) throw Error("the master password is already set up");
      await writeSecrets(moves, { created: record });
      await clearUnlockSession();
    });
  }

  /** @throws {PasswordError} if `currentPassword` is wrong. */
  public async changeMasterPassword(currentPassword: string, newPassword: string) {
    const current = await readMasterKey();
    if (!current) throw Error("the master password isn't set up");

    const { record } = await changeMasterKeyPassword(current, currentPassword, newPassword);
    await withLock(async () => {
      if (!isEqual(await readMasterKey(), current)) throw new MasterPasswordChangedError();
      await storage.local.set({ [MASTER_KEY]: record });
      await clearUnlockSession();
    });
  }

  /** Deletes the master password. Refused while any wallet uses it. */
  public async resetMasterPassword() {
    await withLock(async () => {
      if ((await readAllSecrets()).some(usesMaster)) {
        throw Error("the master password is used by a wallet");
      }

      await storage.local.remove(MASTER_KEY);
      await clearUnlockSession();
    });
  }

  /**
   * Moves the wallet from its own password to the master password.
   *
   * @param master.create true to set the master password up with `master.password`,
   * false to unlock the existing one with it.
   * @throws {PasswordError} whose `kind` says which password is wrong.
   * @throws {MasterPasswordChangedError} if the master password doesn't exist, or
   * already does, contrary to `master.create`.
   */
  public async moveToMasterPassword(
    id: number,
    walletPassword: string,
    master: { password: string; create: boolean }
  ) {
    const { wallet, encrypted: current, master: record } = await readWalletWithSecret(id);
    if (usesMaster(current)) throw Error("this wallet already uses the master password");
    if (!record !== master.create) throw new MasterPasswordChangedError();

    const secret = await failingAs("password", () =>
      decryptSecret(current, wallet.publicKey, walletPassword)
    );
    const { encrypted, master: change } = await failingAs("master", () =>
      protect({ value: secret, password: master.password, by: "master" }, wallet.publicKey)
    );
    if (!change?.created !== !master.create) throw new MasterPasswordChangedError();

    await replaceSecret({ id, current, encrypted }, change);
  }

  /**
   * Moves the wallet from the master password to a password of its own.
   *
   * @throws {PasswordError} if `masterPassword` is wrong.
   */
  public async moveToOwnPassword(id: number, masterPassword: string, newPassword: string) {
    const { wallet, encrypted: current, master } = await readWalletWithSecret(id);
    if (!usesMaster(current)) throw Error("this wallet doesn't use the master password");

    const secret = await failingAs("master", () =>
      decryptSecret(current, wallet.publicKey, masterPassword, master)
    );
    const encrypted = await encryptSecret(secret, wallet.publicKey, {
      by: "password",
      password: newPassword
    });

    await replaceSecret({ id, current, encrypted });
  }

  public async hasMasterPassword(): Promise<boolean> {
    return (await readMasterKey()) !== undefined;
  }

  /** Unlike {@link getSecret}, never upgrades the record. */
  public async verifyWalletPassword(id: number, password: string): Promise<boolean> {
    const { wallet, encrypted, master } = await readWalletWithSecret(id);
    return succeeds(decryptSecret(encrypted, wallet.publicKey, password, master));
  }

  /** @returns false if the password is wrong or the master password isn't set up. */
  public async verifyMasterPassword(password: string): Promise<boolean> {
    const master = await readMasterKey();
    return !!master && succeeds(unlockMasterKey(master, password));
  }

  public async changePassword(id: number, currentPassword: string, newPassword: string) {
    const { wallet, encrypted: current } = await readWalletWithSecret(id);
    if (usesMaster(current)) throw Error("this wallet uses the master password");

    const secret = await decryptSecret(current, wallet.publicKey, currentPassword);
    const encrypted = await encryptSecret(secret, wallet.publicKey, {
      by: "password",
      password: newPassword
    });

    await replaceSecret({ id, current, encrypted });
  }

  public async put(wallet: IDbWallet, secret?: PlainSecret): Promise<number> {
    const { encrypted, master } = secret
      ? await protect(secret, wallet.publicKey)
      : { encrypted: undefined, master: undefined };

    return withLock(async () => {
      if (master) await assertMasterUnchanged(master);

      const dbWallet = (await readAllWallets()).find((w) => w.publicKey === wallet.publicKey);
      const id = wallet.id ?? dbWallet?.id ?? (await allocateId());
      const record = { ...wallet, id };

      if (encrypted) {
        await storage.local.set({
          [walletKey(id)]: record,
          [secretKey(id)]: encrypted,
          // a master password set up with this wallet is stored along with it
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
    return subscribe(
      (changes, area) => area === "local" && Object.keys(changes).some(isWalletKey),
      listener
    );
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

async function protect(
  secret: PlainSecret,
  publicKey: string
): Promise<{ encrypted: EncryptedSecret; master?: MasterChange }> {
  const { password } = secret;
  if (secret.by === "password") {
    if (password === undefined) throw Error("the wallet's password is missing");
    const protection = { by: "password", password } as const;
    return { encrypted: await encryptSecret(secret.value, publicKey, protection) };
  }

  const current = await readMasterKey();
  const { masterKey, record: created } = await openMasterKey(current, password);

  return {
    encrypted: await encryptSecret(secret.value, publicKey, { by: "master", masterKey }),
    master: { current, created }
  };
}

/** Unlocks `current`, with the session when `password` is left out, or creates it. */
async function openMasterKey(
  current: MasterKeyRecord | undefined,
  password?: string
): Promise<{ masterKey: MasterKey; record?: MasterKeyRecord }> {
  if (current) {
    const masterKey =
      password === undefined
        ? await sessionMasterKey(current)
        : await unlockMasterKey(current, password);
    return { masterKey };
  }

  if (password === undefined) throw new SessionLockedError();
  return createMasterKey(password);
}

/** @throws {SessionLockedError} if no session is active. */
async function sessionMasterKey(record: MasterKeyRecord): Promise<MasterKey> {
  const halves = await readSession(record);
  if (!halves) throw new SessionLockedError();

  let masterKey: MasterKey;
  try {
    masterKey = await joinMasterKeyHalves(halves);
  } catch (e) {
    log.error(e);
    await clearUnlockSession();
    throw new SessionLockedError();
  }

  await touchUnlockSession().catch((e) => log.error("failed to extend the session", e));
  return masterKey;
}

/**
 * Clears halves found invalid only once they still are while holding the lock, since a
 * session start holds it across its two writes.
 */
async function readSession(record: MasterKeyRecord): Promise<MasterKeyHalves | undefined> {
  const halves = await readUnlockSession(record);
  if (halves === "none") return;
  if (halves !== "invalid") return halves;

  return withLock(async () => {
    const again = await readUnlockSession(record);
    if (again === "invalid") await clearUnlockSession();
    return typeof again === "string" ? undefined : again;
  });
}

/** Starts a session with fresh halves, unless the master password changed meanwhile. */
function startSession(record: MasterKeyRecord, halves: MasterKeyHalves) {
  return withLock(async () => {
    if (!isEqual(await readMasterKey(), record)) return;
    if (!(await isUnlockSessionEnabled())) return;
    await startUnlockSession(record, halves);
  });
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

function replaceSecret(move: Move, master?: MasterChange) {
  return withLock(() => writeSecrets([move], master));
}

async function writeSecrets(moves: Move[], master?: MasterChange) {
  for (const { id, current } of moves) {
    if (!(await readWallet(id))) throw Error("wallet not found");
    if (!isEqual(await readSecret(id), current)) {
      throw Error("the spending password was changed meanwhile");
    }
  }
  if (master) await assertMasterUnchanged(master);

  await storage.local.set({
    ...Object.fromEntries(moves.map((m) => [secretKey(m.id), m.encrypted])),
    ...(master?.created && { [MASTER_KEY]: master.created })
  });
  // drop the pre-migration copies, still encrypted with the old passwords
  await Promise.all(moves.map((m) => dbContext.wallets.delete(m.id)));
}

async function assertMasterUnchanged(master: MasterChange) {
  if (!isEqual(await readMasterKey(), master.current)) throw new MasterPasswordChangedError();
}

async function succeeds(operation: Promise<unknown>): Promise<boolean> {
  try {
    await operation;
    return true;
  } catch (e) {
    if (e instanceof PasswordError) return false;
    throw e;
  }
}

/** Tags a {@link PasswordError} thrown by `fn` with the password it was about. */
async function failingAs<T>(kind: PasswordKind, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PasswordError) throw new PasswordError(e.message, kind);
    throw e;
  }
}

const usesMaster = (encrypted: EncryptedSecret) =>
  encrypted.version === 2 && encrypted.wrappedKey.by === "master";

async function readSecret(id: number): Promise<EncryptedSecret | undefined> {
  const key = secretKey(id);
  const stored = await storage.local.get(key);
  return stored[key] as EncryptedSecret | undefined;
}

type StorageChangeFilter = (changes: Record<string, unknown>, area: string) => boolean;

/** @returns a function that unsubscribes. */
function subscribe(filter: StorageChangeFilter, listener: () => void): () => void {
  const handler = (changes: Record<string, unknown>, area: string) => {
    if (filter(changes, area)) listener();
  };

  storage.onChanged.addListener(handler);
  return () => storage.onChanged.removeListener(handler);
}

const isWalletKey = (key: string) => key.startsWith(WALLET_KEY_PREFIX);
const isSecretKey = (key: string) => key.startsWith(SECRET_KEY_PREFIX);

async function readAllSecrets(): Promise<EncryptedSecret[]> {
  return (await readAllMatching(isSecretKey)) as EncryptedSecret[];
}

async function readAllWallets(): Promise<Wallet[]> {
  const wallets = (await readAllMatching(isWalletKey)) as Wallet[];
  return wallets.sort((a, b) => a.id - b.id);
}

async function readAllMatching(isKey: (key: string) => boolean): Promise<unknown[]> {
  // read only the matching keys when supported (Chrome 130+, Firefox 143+), otherwise
  // everything, including large entries such as token blacklists and prices
  const stored = storage.local.getKeys
    ? await storage.local.get((await storage.local.getKeys()).filter(isKey))
    : await storage.local.get(null);

  return Object.entries(stored)
    .filter(([key]) => isKey(key))
    .map(([, value]) => value);
}

async function allocateId(): Promise<number> {
  const stored = await storage.local.get(NEXT_ID_KEY);
  const id = (stored[NEXT_ID_KEY] as number | undefined) ?? 1;
  await storage.local.set({ [NEXT_ID_KEY]: id + 1 });

  return id;
}

export const walletsDbService = new WalletsDbService();
