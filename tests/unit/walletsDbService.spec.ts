import { omit } from "es-toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDbWallet, ILegacyDbWallet } from "@/types/database";
import { WalletType } from "@/types/internal";

type ChangeListener = (changes: Record<string, unknown>, area: string) => void;

const { local, legacyWallets, syncRows, storageApi } = vi.hoisted(() => {
  const local = new Map<string, unknown>();
  const legacyWallets = new Map<number, unknown>();
  const syncRows = new Map<number, unknown>();
  const storageApi = {
    getKeysSupported: true,
    getCalls: [] as (string | string[] | null)[],
    setCalls: [] as string[][],
    listeners: new Set<ChangeListener>()
  };
  return { local, legacyWallets, syncRows, storageApi };
});

vi.mock("webextension-polyfill", () => {
  const clone = <T>(v: T): T => structuredClone(v);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0)); // let calls interleave
  const notify = (keys: string[]) => {
    const changes = Object.fromEntries(keys.map((k) => [k, { newValue: local.get(k) }]));
    for (const listener of storageApi.listeners) listener(changes, "local");
  };

  return {
    storage: {
      local: {
        get getKeys() {
          if (!storageApi.getKeysSupported) return undefined;
          return async () => {
            await tick();
            return [...local.keys()];
          };
        },
        async get(keys: string | string[] | null) {
          storageApi.getCalls.push(keys);
          await tick();
          const list = keys === null ? [...local.keys()] : ([] as string[]).concat(keys);
          return Object.fromEntries(
            list.filter((k) => local.has(k)).map((k) => [k, clone(local.get(k))])
          );
        },
        async set(items: Record<string, unknown>) {
          storageApi.setCalls.push(Object.keys(items));
          await tick();
          for (const [k, v] of Object.entries(items)) local.set(k, clone(v));
          notify(Object.keys(items));
        },
        async remove(keys: string | string[]) {
          await tick();
          const list = ([] as string[]).concat(keys);
          for (const k of list) local.delete(k);
          notify(list);
        }
      },
      onChanged: {
        addListener: (fn: ChangeListener) => storageApi.listeners.add(fn),
        removeListener: (fn: ChangeListener) => storageApi.listeners.delete(fn)
      }
    }
  };
});

vi.mock("@/database/dbContext", () => {
  const table = () => ({ where: () => ({ delete: async () => 0 }) });
  return {
    dbContext: {
      wallets: {
        toArray: async () => [...legacyWallets.values()].map((w) => structuredClone(w)),
        delete: async (id: number) => void legacyWallets.delete(id)
      },
      addresses: table(),
      assets: table(),
      connectedDApps: table(),
      utxos: table(),
      walletSync: { delete: async (id: number) => void syncRows.delete(id) }
    }
  };
});

const legacyCiphertext =
  "U2FsdGVkX18UzwO9k37iXcUw5UeCoRnx6tne+hT5Z1+CT56IOYoAu4adRris+NecYR6DzSzCRgXXu0/wSOEg2hrb/CZfJVJS29oM4T2QeMPCwg8SjJ3tdi5C5KF4idZKQMuRdym1oJEWdRbo2YDtWw==";
const mnemonic =
  "fade payment weasel market mixed armed decade shed harbor bind deal mandate pink earth second";
const password = "correct horse battery";
const migratedAt = 1_700_000_000_000;

/** Former `WalletType` enum values, by index. */
const legacyTypes: WalletType[] = ["standard", "readonly", "ledger"];

function legacyWallet(id: number, type: WalletType = "standard"): ILegacyDbWallet {
  return {
    id,
    name: `wallet ${id}`,
    network: 0,
    type: legacyTypes.indexOf(type),
    publicKey: "02" + id.toString(16).padStart(64, "0"),
    chainCode: `cc${id}`,
    mnemonic: type === "standard" ? legacyCiphertext : undefined,
    settings: { avoidAddressReuse: false, addressFilter: "all", defaultChangeIndex: 0 },
    lastSynced: 1000
  };
}

/** A legacy wallet as stored in extension storage once migrated. */
const migrated = (wallet: ILegacyDbWallet): IDbWallet => ({
  ...omit(wallet, ["mnemonic", "lastSynced", "network"]),
  chain: { id: "ergo", network: "mainnet" },
  type: legacyTypes[wallet.type],
  needsBackup: false,
  createdAt: migratedAt
});

/** Loads fresh modules, migrating first, as the extension does on startup. */
async function freshService({ migrate = true } = {}) {
  vi.resetModules();
  if (migrate) await (await import("@/database/migrations")).runMigrations();

  return (await import("@/database/walletsDbService")).walletsDbService;
}

describe("walletsDbService", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(migratedAt);
    local.clear();
    legacyWallets.clear();
    storageApi.getKeysSupported = true;
    storageApi.getCalls = [];
    storageApi.setCalls = [];
    storageApi.listeners.clear();
    syncRows.clear();
  });

  it("refuses to write without the Web Locks API", async () => {
    const { withLock } = await import("@/database/walletsDbService");
    vi.stubGlobal("navigator", { ...navigator, locks: undefined });
    try {
      const fn = vi.fn(async () => {});
      await expect(withLock(fn)).rejects.toThrow(/Web Locks API/);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe.each([true, false])("getAll (getKeys supported: %s)", (getKeysSupported) => {
    it("returns only wallets, sorted by id", async () => {
      storageApi.getKeysSupported = getKeysSupported;
      legacyWallets.set(2, legacyWallet(2));
      legacyWallets.set(1, legacyWallet(1));
      local.set("ergoTokensBlacklist", "{}");
      const service = await freshService();
      await service.getAll();
      storageApi.getCalls = [];

      expect((await service.getAll()).map((w) => w.id)).toEqual([1, 2]);
      expect(storageApi.getCalls).toHaveLength(1);
      const [keys] = storageApi.getCalls;
      if (getKeysSupported)
        expect([...(keys as string[])].sort()).toEqual(["wallet:1", "wallet:2"]);
      else expect(keys).toBeNull();
    });
  });

  describe("migration", () => {
    it("copies every field and keeps ids", async () => {
      const standard = legacyWallet(1);
      const readOnly = legacyWallet(4, "readonly");
      const ledger = legacyWallet(5, "ledger");
      legacyWallets.set(1, standard);
      legacyWallets.set(4, readOnly);
      legacyWallets.set(5, ledger);

      const service = await freshService();
      await service.getAll();

      expect(local.get("wallet:1")).toEqual(migrated(standard));
      expect(local.get("wallet:1")).not.toHaveProperty("lastSynced");
      expect(local.get("walletSecret:1")).toEqual({ version: 1, ciphertext: legacyCiphertext });
      expect(local.get("wallet:4")).toEqual(migrated(readOnly));
      expect(local.has("walletSecret:4")).toBe(false);
      expect(local.get("wallet:5")).toEqual(migrated(ledger));
      expect(local.get("wallet:5")).toHaveProperty("type", "ledger");
      expect(local.get("wallets:nextId")).toBe(6);
      expect(local.get("wallets:schemaVersion")).toBe(1);
      expect(await service.getSecret(1, password)).toBe(mnemonic);
    });

    it("leaves the IndexedDB table untouched", async () => {
      legacyWallets.set(1, legacyWallet(1));
      await (await freshService()).getAll();

      expect(legacyWallets.get(1)).toEqual(legacyWallet(1));
    });

    it("is idempotent and doesn't overwrite migrated wallets", async () => {
      legacyWallets.set(1, legacyWallet(1));

      let service = await freshService();
      await service.updateSettings(1, { name: "renamed" });
      legacyWallets.set(1, legacyWallet(1)); // simulate a stale IndexedDB copy

      local.delete("wallets:schemaVersion"); // force a second run
      service = await freshService();

      expect((await service.getById(1))?.name).toBe("renamed");
      expect(local.get("wallets:nextId")).toBe(2);
    });

    it("ignores IndexedDB once migrated", async () => {
      legacyWallets.set(1, legacyWallet(1));
      await (await freshService()).getAll();

      legacyWallets.set(2, legacyWallet(2));
      expect((await (await freshService()).getAll()).map((w) => w.id)).toEqual([1]);
    });

    it("doesn't mark an empty IndexedDB as migrated", async () => {
      expect(await (await freshService()).getAll()).toEqual([]);
      expect(local.has("wallets:schemaVersion")).toBe(false);

      legacyWallets.set(1, legacyWallet(1));
      expect((await (await freshService()).getAll()).map((w) => w.id)).toEqual([1]);
    });

    it("marks as migrated once extension storage has a wallet", async () => {
      const service = await freshService();
      await service.put({ ...migrated(legacyWallet(1)), id: undefined });
      expect(local.has("wallets:schemaVersion")).toBe(false);

      await (await freshService()).getAll();
      expect(local.get("wallets:schemaVersion")).toBe(1);

      legacyWallets.set(5, legacyWallet(5)); // no longer read
      expect((await (await freshService()).getAll()).map((w) => w.id)).toEqual([1]);
    });

    it("runs once when called concurrently", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService({ migrate: false });
      const { runMigrations } = await import("@/database/migrations");

      await Promise.all([runMigrations(), runMigrations(), runMigrations()]);

      const schemaWrites = storageApi.setCalls.filter((keys) =>
        keys.includes("wallets:schemaVersion")
      );
      expect(schemaWrites).toHaveLength(1);
      expect((await service.getAll()).map((w) => w.id)).toEqual([1]);
    });

    it("retries after a failed migration", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService({ migrate: false });
      const { runMigrations } = await import("@/database/migrations");
      const { dbContext } = await import("@/database/dbContext");
      const toArray = vi
        .spyOn(dbContext.wallets, "toArray")
        .mockRejectedValueOnce(new Error("IndexedDB unavailable"));

      await expect(runMigrations()).rejects.toThrow("IndexedDB unavailable");
      expect(local.has("wallet:1")).toBe(false);

      await runMigrations();
      expect((await service.getAll()).map((w) => w.id)).toEqual([1]);
      toArray.mockRestore();
    });
  });

  it("never returns the encrypted mnemonic", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();

    const reads = [...(await service.getAll()), await service.getById(1)];

    expect(reads).toHaveLength(2);
    for (const wallet of reads) {
      expect(wallet).toEqual(migrated(legacyWallet(1)));
      expect(wallet).not.toHaveProperty("crypto");
    }
    expect(await service.getSecret(1, password)).toBe(mnemonic);
  });

  describe("encrypted mnemonic key", () => {
    const secret = { value: mnemonic, password, by: "password" as const };
    const newWallet = () => ({ ...migrated(legacyWallet(1)), id: undefined });

    it("is stored apart from the wallet, in the same write", async () => {
      const service = await freshService();
      const id = await service.put(newWallet(), secret);

      expect(local.get(`wallet:${id}`)).not.toHaveProperty("crypto");
      expect(local.get(`walletSecret:${id}`)).toMatchObject({ version: 2 });
      expect(await service.getSecret(id, password)).toBe(mnemonic);
      expect(storageApi.setCalls).toContainEqual([`wallet:${id}`, `walletSecret:${id}`]);
    });

    it("isn't read nor written by metadata reads and updates", async () => {
      const service = await freshService();
      const id = await service.put(newWallet(), secret);
      const stored = local.get(`walletSecret:${id}`);
      storageApi.getCalls = [];
      storageApi.setCalls = [];

      await service.updateSettings(id, { name: "renamed" });
      await service.getAll();
      await service.getById(id);

      const touched = [...storageApi.getCalls, ...storageApi.setCalls].flat();
      expect(touched.some((k) => k?.startsWith("walletSecret:"))).toBe(false);
      expect(local.get(`walletSecret:${id}`)).toEqual(stored);
    });

    it("is written once on password change, with no separate upgrade", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();
      await service.getAll();
      storageApi.setCalls = [];

      await service.changePassword(1, password, "new password 123");

      expect(storageApi.setCalls).toEqual([["walletSecret:1"]]);
      expect(local.get("walletSecret:1")).toMatchObject({ version: 2 });
    });

    it("is upgraded from v1 once, on the first successful unlock", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();
      expect(local.get("walletSecret:1")).toMatchObject({ version: 1 });

      await expect(service.getSecret(1, "wrong password")).rejects.toMatchObject({
        name: "PasswordError"
      });
      expect(local.get("walletSecret:1")).toMatchObject({ version: 1 });

      storageApi.setCalls = [];
      expect(await service.getSecret(1, password)).toBe(mnemonic);
      expect(storageApi.setCalls).toEqual([["walletSecret:1"]]);
      expect(local.get("walletSecret:1")).toMatchObject({ version: 2 });

      storageApi.setCalls = [];
      expect(await service.getSecret(1, password)).toBe(mnemonic);
      expect(storageApi.setCalls).toEqual([]);
    });

    it("still returns the secret when the upgrade fails", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();
      const { storage } = await import("webextension-polyfill");
      const set = vi.spyOn(storage.local, "set").mockRejectedValueOnce(Error("quota"));

      expect(await service.getSecret(1, password)).toBe(mnemonic);
      expect(local.get("walletSecret:1")).toMatchObject({ version: 1 });
      set.mockRestore();
    });

    describe("upgrade", () => {
      /** Calls `getSecret` on a v1 wallet, and runs `meanwhile` before its upgrade is written. */
      async function upgradeWhile(meanwhile: () => void) {
        legacyWallets.set(1, legacyWallet(1));
        const service = await freshService();

        let release!: () => void;
        let acquired!: () => void;
        const isHeld = new Promise<void>((resolve) => (acquired = resolve));
        const lock = navigator.locks.request("nautilus:wallets", async () => {
          acquired();
          await new Promise<void>((resolve) => (release = resolve));
        });
        await isHeld;

        const unlock = service.getSecret(1, password);
        await vi.waitFor(async () => {
          expect((await navigator.locks.query()).pending).toHaveLength(1);
        });

        meanwhile();
        release();
        await lock;

        expect(await unlock).toBe(mnemonic);
      }

      it("isn't written for a wallet deleted meanwhile", async () => {
        await upgradeWhile(() => {
          local.delete("wallet:1");
          local.delete("walletSecret:1");
        });

        expect(local.has("walletSecret:1")).toBe(false);
      });

      it("doesn't overwrite a record changed meanwhile", async () => {
        const changed = { version: 1, ciphertext: "changed elsewhere" };
        await upgradeWhile(() => local.set("walletSecret:1", changed));

        expect(local.get("walletSecret:1")).toEqual(changed);
      });
    });

    it("is removed when the wallet is deleted", async () => {
      const service = await freshService();
      const id = await service.put(newWallet(), secret);

      await service.delete(id);

      expect(local.has(`walletSecret:${id}`)).toBe(false);
    });

    it("is removed when re-imported as read-only", async () => {
      const service = await freshService();
      const id = await service.put(newWallet(), secret);

      await service.put({ ...newWallet(), type: "readonly" });

      expect(local.has(`walletSecret:${id}`)).toBe(false);
    });

    it("isn't written for a wallet deleted during a password change", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();
      await service.getAll();

      // hold the lock until the password change is waiting for it
      let release!: () => void;
      let acquired!: () => void;
      const isHeld = new Promise<void>((resolve) => (acquired = resolve));
      const lock = navigator.locks.request("nautilus:wallets", async () => {
        acquired();
        await new Promise<void>((resolve) => (release = resolve));
      });
      await isHeld;

      const change = service.changePassword(1, password, "new password 123");
      await vi.waitFor(async () => {
        expect((await navigator.locks.query()).pending).toHaveLength(1);
      });

      // deleted from another extension context meanwhile
      local.delete("wallet:1");
      local.delete("walletSecret:1");
      release();
      await lock;

      await expect(change).rejects.toThrow("wallet not found");
      expect(local.has("walletSecret:1")).toBe(false);
    });
  });

  describe("master password", () => {
    const masterPassword = "master password 123";
    const newWallet = (id: number) => ({ ...migrated(legacyWallet(id)), id: undefined });
    const withMaster = (password = masterPassword) => ({
      value: mnemonic,
      password,
      by: "master" as const
    });

    it("is set up by the first wallet that uses it, in the same write", async () => {
      const service = await freshService();
      expect(await service.hasMasterPassword()).toBe(false);

      const id = await service.put(newWallet(1), withMaster());

      expect(storageApi.setCalls).toContainEqual([
        `wallet:${id}`,
        `walletSecret:${id}`,
        "masterKey"
      ]);
      expect(await service.hasMasterPassword()).toBe(true);
      expect(await service.getPasswordKind(id)).toBe("master");
      expect(await service.getSecret(id, masterPassword)).toBe(mnemonic);
      await expect(service.getSecret(id, "wrong password")).rejects.toMatchObject({
        name: "PasswordError"
      });
    });

    it("protects later wallets with the same master key", async () => {
      const service = await freshService();
      const first = await service.put(newWallet(1), withMaster());
      const record = local.get("masterKey");
      storageApi.setCalls = [];

      const second = await service.put(newWallet(2), withMaster());

      expect(storageApi.setCalls).toContainEqual([`wallet:${second}`, `walletSecret:${second}`]);
      expect(storageApi.setCalls.flat()).not.toContain("masterKey");
      expect(local.get("masterKey")).toEqual(record);
      expect(await service.getSecret(first, masterPassword)).toBe(mnemonic);
      expect(await service.getSecret(second, masterPassword)).toBe(mnemonic);
    });

    it("rejects a wrong master password without writing anything", async () => {
      const service = await freshService();
      await service.put(newWallet(1), withMaster());
      storageApi.setCalls = [];

      await expect(service.put(newWallet(2), withMaster("wrong password"))).rejects.toMatchObject({
        name: "PasswordError"
      });
      expect(storageApi.setCalls).toEqual([]);
      expect(await service.getAll()).toHaveLength(1);
    });

    it("verifies the master password", async () => {
      const service = await freshService();
      expect(await service.verifyMasterPassword(masterPassword)).toBe(false);

      await service.put(newWallet(1), withMaster());

      expect(await service.verifyMasterPassword(masterPassword)).toBe(true);
      expect(await service.verifyMasterPassword("wrong password")).toBe(false);
    });

    it("coexists with wallets on their own password", async () => {
      const service = await freshService();
      const own = await service.put(newWallet(1), { value: mnemonic, password, by: "password" });
      const master = await service.put(newWallet(2), withMaster());

      expect(await service.getPasswordKind(own)).toBe("password");
      expect(await service.getPasswordKind(master)).toBe("master");
      expect(await service.getSecret(own, password)).toBe(mnemonic);
      await expect(service.getSecret(own, masterPassword)).rejects.toThrow();
      expect(await service.getSecret(master, masterPassword)).toBe(mnemonic);
      await expect(service.getSecret(master, password)).rejects.toThrow();
    });

    it("reports legacy wallets as on their own password", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();

      expect(await service.getPasswordKind(1)).toBe("password");
      expect(await service.getPasswordKind(99)).toBeUndefined();
    });

    it("isn't upgraded nor rewritten on unlock", async () => {
      const service = await freshService();
      const id = await service.put(newWallet(1), withMaster());
      storageApi.setCalls = [];

      await service.getSecret(id, masterPassword);

      expect(storageApi.setCalls).toEqual([]);
    });

    it("can't be changed through a wallet's password change", async () => {
      const service = await freshService();
      const id = await service.put(newWallet(1), withMaster());

      await expect(service.changePassword(id, masterPassword, "new password 123")).rejects.toThrow(
        /master password/
      );
      expect(await service.getSecret(id, masterPassword)).toBe(mnemonic);
    });

    it("outlives the wallets that use it", async () => {
      const service = await freshService();
      const id = await service.put(newWallet(1), withMaster());

      await service.delete(id);

      expect(await service.verifyMasterPassword(masterPassword)).toBe(true);
    });

    it("is set up only once when two wallets set it up concurrently", async () => {
      const service = await freshService();

      const results = await Promise.allSettled([
        service.put(newWallet(1), withMaster()),
        service.put(newWallet(2), withMaster("another master password"))
      ]);

      expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(results.find((r) => r.status === "rejected")?.reason).toMatchObject({
        message: expect.stringMatching(/changed meanwhile/)
      });
      // the master password is the one of the wallet that got stored
      const passwords = [masterPassword, "another master password"];
      const stored = passwords[results.findIndex((r) => r.status === "fulfilled")];
      const [wallet] = await service.getAll();
      expect(await service.getSecret(wallet.id, stored)).toBe(mnemonic);
    });
  });

  it("allocates new ids after migrated ones and dedupes by public key", async () => {
    legacyWallets.set(3, legacyWallet(3));
    const service = await freshService();

    const wallet = { ...migrated(legacyWallet(10)), id: undefined };
    expect(await service.put(wallet)).toBe(4);
    expect(await service.put({ ...wallet, name: "again" })).toBe(4);
    expect((await service.getAll()).map((w) => [w.id, w.name])).toEqual([
      [3, "wallet 3"],
      [4, "again"]
    ]);
  });

  it("allocates distinct ids for concurrent puts", async () => {
    const service = await freshService();
    const ids = await Promise.all(
      [1, 2, 3].map((i) => service.put({ ...migrated(legacyWallet(i)), id: undefined }))
    );

    expect(new Set(ids).size).toBe(3);
  });

  it("doesn't write to IndexedDB", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();

    await service.updateSettings(1, { name: "renamed" });
    await service.put({ ...migrated(legacyWallet(2)), id: undefined });

    expect([...legacyWallets.values()]).toEqual([legacyWallet(1)]);
  });

  it("changes password and drops the IndexedDB copy", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();

    await service.changePassword(1, password, "new password 123");

    expect(await service.getSecret(1, "new password 123")).toBe(mnemonic);
    await expect(service.getSecret(1, password)).rejects.toThrow();
    expect(legacyWallets.has(1)).toBe(false);
  });

  it("doesn't lose a password change to a concurrent settings update", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();
    await service.getAll();

    await Promise.all([
      service.changePassword(1, password, "new password 123"),
      service.updateSettings(1, {
        settings: { ...legacyWallet(1).settings, defaultChangeIndex: 2 }
      }),
      service.updateSettings(1, { name: "renamed" })
    ]);

    const wallet = await service.getById(1);
    expect(wallet?.settings.defaultChangeIndex).toBe(2);
    expect(wallet?.name).toBe("renamed");
    expect(await service.getSecret(1, "new password 123")).toBe(mnemonic);
  });

  it("doesn't recreate a deleted wallet on a concurrent update", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();
    await service.getAll();

    await Promise.all([service.updateSettings(1, { name: "renamed" }), service.delete(1)]);

    expect(await service.getAll()).toEqual([]);
    expect(legacyWallets.has(1)).toBe(false);
  });

  it("deletes from both storages, along with its sync state", async () => {
    legacyWallets.set(1, legacyWallet(1));
    syncRows.set(1, { walletId: 1, lastSynced: 1000 });
    const service = await freshService();

    await service.delete(1);

    expect(await service.getAll()).toEqual([]);
    expect(legacyWallets.has(1)).toBe(false);
    expect(syncRows.has(1)).toBe(false);
  });

  describe("change listener", () => {
    it("is called when wallets are added, updated or deleted", async () => {
      const service = await freshService();
      const listener = vi.fn();
      service.onChange(listener);

      const id = await service.put(migrated(legacyWallet(1)));
      await service.updateSettings(id, { name: "renamed" });
      await service.delete(id);

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it("ignores secret-only and unrelated changes", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();
      const listener = vi.fn();
      service.onChange(listener);

      await service.changePassword(1, password, "new password 123");
      for (const fn of storageApi.listeners) fn({ "wallet:1": {} }, "session");
      for (const fn of storageApi.listeners) fn({ settings: {} }, "local");

      expect(listener).not.toHaveBeenCalled();
    });

    it("stops when unsubscribed", async () => {
      const service = await freshService();
      const listener = vi.fn();
      const unsubscribe = service.onChange(listener);

      unsubscribe();
      await service.put(migrated(legacyWallet(1)));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
