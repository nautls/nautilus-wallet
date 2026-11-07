import { omit } from "es-toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDbWallet, ILegacyDbWallet } from "@/types/database";
import { WalletType } from "@/types/internal";

type ChangeListener = (changes: Record<string, unknown>, area: string) => void;

const { local, session, legacyWallets, syncRows, storageApi, alarmsSet } = vi.hoisted(() => {
  const alarmsSet = new Map<string, number>();
  const local = new Map<string, unknown>();
  const session = new Map<string, unknown>();
  const legacyWallets = new Map<number, unknown>();
  const syncRows = new Map<number, unknown>();
  const storageApi = {
    getKeysSupported: true,
    getCalls: [] as (string | string[] | null)[],
    setCalls: [] as string[][],
    listeners: new Set<ChangeListener>()
  };
  return { local, session, legacyWallets, syncRows, storageApi, alarmsSet };
});

vi.mock("webextension-polyfill", () => {
  const clone = <T>(v: T): T => structuredClone(v);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0)); // let calls interleave
  const notify = (keys: string[], area = "local", map = local) => {
    const changes = Object.fromEntries(keys.map((k) => [k, { newValue: map.get(k) }]));
    for (const listener of storageApi.listeners) listener(changes, area);
  };

  return {
    idle: undefined,
    alarms: {
      create: (name: string, info: { when: number }) => void alarmsSet.set(name, info.when),
      clear: async (name: string) => alarmsSet.delete(name)
    },
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
      session: {
        async get(keys: string | string[]) {
          await tick();
          const list = ([] as string[]).concat(keys);
          return Object.fromEntries(
            list.filter((k) => session.has(k)).map((k) => [k, clone(session.get(k))])
          );
        },
        async set(items: Record<string, unknown>) {
          await tick();
          for (const [k, v] of Object.entries(items)) session.set(k, clone(v));
          notify(Object.keys(items), "session", session);
        },
        async remove(keys: string | string[]) {
          await tick();
          const list = ([] as string[]).concat(keys);
          for (const k of list) session.delete(k);
          notify(list, "session", session);
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
    session.clear();
    alarmsSet.clear();
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

    it("keeps unlocking a v1 wallet whose password isn't in NFKC, before and after the upgrade", async () => {
      const decomposed = "café ñandú 12".normalize("NFD"); // e, n, u + combining marks
      const composed = decomposed.normalize("NFKC");
      const { default: AES } = await import("crypto-js/aes");
      legacyWallets.set(1, {
        ...legacyWallet(1),
        mnemonic: AES.encrypt(mnemonic, decomposed).toString()
      });
      const service = await freshService();

      // v1 uses the password exactly as typed, as it always has
      await expect(service.getSecret(1, composed)).rejects.toMatchObject({ name: "PasswordError" });
      expect(local.get("walletSecret:1")).toMatchObject({ version: 1 });

      expect(await service.getSecret(1, decomposed)).toBe(mnemonic);
      expect(local.get("walletSecret:1")).toMatchObject({ version: 2 });

      // the upgraded v2 record still opens with what the user typed, in either form
      expect(await service.getSecret(1, decomposed)).toBe(mnemonic);
      expect(await service.getSecret(1, composed)).toBe(mnemonic);
    });

    it("is verified without being upgraded", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();
      storageApi.setCalls = [];

      expect(await service.verifyWalletPassword(1, password)).toBe(true);
      expect(await service.verifyWalletPassword(1, "wrong password")).toBe(false);
      expect(storageApi.setCalls).toEqual([]);
      expect(local.get("walletSecret:1")).toMatchObject({ version: 1 });
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
    const unlocking = (password = masterPassword) => ({ password, create: false });
    const creating = (password = masterPassword) => ({ password, create: true });

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

    describe("management", () => {
      const own = (pwd = password) => ({ value: mnemonic, password: pwd, by: "password" as const });
      const newMaster = "new master password 456";

      it("counts the wallets that use it", async () => {
        const service = await freshService();
        await service.put(newWallet(1), own());
        await service.put(newWallet(2), withMaster());
        await service.put(newWallet(3), withMaster());
        await service.put({ ...newWallet(4), type: "readonly" });

        expect(await service.getMasterPasswordUsage()).toEqual({ used: 2, total: 3 });
      });

      it("is set up on its own, only once", async () => {
        const service = await freshService();
        await service.setUpMasterPassword(masterPassword);

        expect(await service.verifyMasterPassword(masterPassword)).toBe(true);
        await expect(service.setUpMasterPassword(newMaster)).rejects.toThrow(/already set up/);
        expect(await service.verifyMasterPassword(masterPassword)).toBe(true);
      });

      it("is set up with the chosen wallets moved to it, in one write", async () => {
        const service = await freshService();
        const a = await service.put(newWallet(1), own());
        const b = await service.put(newWallet(2), own("another password"));
        const left = await service.put(newWallet(3), own());
        storageApi.setCalls = [];

        await service.setUpMasterPassword(masterPassword, [
          { id: a, password },
          { id: b, password: "another password" }
        ]);

        expect(storageApi.setCalls).toEqual([
          [`walletSecret:${a}`, `walletSecret:${b}`, "masterKey"]
        ]);
        expect(await service.getSecret(a, masterPassword)).toBe(mnemonic);
        expect(await service.getSecret(b, masterPassword)).toBe(mnemonic);
        expect(await service.getPasswordKind(left)).toBe("password");
        expect(await service.getMasterPasswordUsage()).toEqual({ used: 2, total: 3 });
      });

      it("names every wrong wallet password and writes nothing", async () => {
        const service = await freshService();
        const a = await service.put(newWallet(1), own());
        const b = await service.put(newWallet(2), own());
        const c = await service.put(newWallet(3), own());
        storageApi.setCalls = [];

        await expect(
          service.setUpMasterPassword(masterPassword, [
            { id: a, password },
            { id: b, password: "wrong password" },
            { id: c, password: "wrong password" }
          ])
        ).rejects.toMatchObject({ name: "PasswordError", kind: "password", walletIds: [b, c] });
        expect(storageApi.setCalls).toEqual([]);
        expect(await service.hasMasterPassword()).toBe(false);
      });

      it("changes without touching the wallets that use it", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());
        const secret = local.get(`walletSecret:${id}`);
        storageApi.setCalls = [];

        await service.changeMasterPassword(masterPassword, newMaster);

        expect(storageApi.setCalls).toEqual([["masterKey"]]);
        expect(local.get(`walletSecret:${id}`)).toEqual(secret);
        expect(await service.getSecret(id, newMaster)).toBe(mnemonic);
        await expect(service.getSecret(id, masterPassword)).rejects.toMatchObject({
          name: "PasswordError"
        });
      });

      it("isn't changed with a wrong current password", async () => {
        const service = await freshService();
        await service.put(newWallet(1), withMaster());
        storageApi.setCalls = [];

        await expect(
          service.changeMasterPassword("wrong password", newMaster)
        ).rejects.toMatchObject({ name: "PasswordError" });
        expect(storageApi.setCalls).toEqual([]);
      });

      it("keeps one of two concurrent changes", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());

        const results = await Promise.allSettled([
          service.changeMasterPassword(masterPassword, newMaster),
          service.changeMasterPassword(masterPassword, "another master password")
        ]);

        expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
        const kept = [newMaster, "another master password"][
          results.findIndex((r) => r.status === "fulfilled")
        ];
        expect(await service.getSecret(id, kept)).toBe(mnemonic);
      });

      it("is reset only while no wallet uses it", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());

        await expect(service.resetMasterPassword()).rejects.toThrow(/used by a wallet/);
        expect(await service.hasMasterPassword()).toBe(true);

        await service.moveToOwnPassword(id, masterPassword, password);
        await service.resetMasterPassword();

        expect(await service.hasMasterPassword()).toBe(false);
        expect(await service.getSecret(id, password)).toBe(mnemonic);
        await service.setUpMasterPassword(newMaster);
        expect(await service.verifyMasterPassword(newMaster)).toBe(true);
      });

      it("moves a wallet from its own password to the master password", async () => {
        legacyWallets.set(1, legacyWallet(1));
        const service = await freshService();
        await service.setUpMasterPassword(masterPassword);

        await service.moveToMasterPassword(1, password, unlocking());

        expect(await service.getPasswordKind(1)).toBe("master");
        expect(await service.getSecret(1, masterPassword)).toBe(mnemonic);
        await expect(service.getSecret(1, password)).rejects.toMatchObject({
          name: "PasswordError"
        });
        // dropped, since it still opens with the old password
        expect(legacyWallets.has(1)).toBe(false);
      });

      it("sets the master password up while moving the first wallet to it", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), own());
        storageApi.setCalls = [];

        await service.moveToMasterPassword(id, password, creating());

        expect(storageApi.setCalls).toEqual([[`walletSecret:${id}`, "masterKey"]]);
        expect(await service.getSecret(id, masterPassword)).toBe(mnemonic);
      });

      it("names the wrong password when moving to the master password", async () => {
        const service = await freshService();
        await service.setUpMasterPassword(masterPassword);
        const id = await service.put(newWallet(1), own());
        storageApi.setCalls = [];

        await expect(
          service.moveToMasterPassword(id, "wrong password", unlocking())
        ).rejects.toMatchObject({ name: "PasswordError", kind: "password" });
        await expect(
          service.moveToMasterPassword(id, password, unlocking("wrong password"))
        ).rejects.toMatchObject({ name: "PasswordError", kind: "master" });
        expect(storageApi.setCalls).toEqual([]);
        expect(await service.getPasswordKind(id)).toBe("password");
      });

      it("moves a wallet from the master password to its own", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());

        await expect(
          service.moveToOwnPassword(id, "wrong password", password)
        ).rejects.toMatchObject({
          name: "PasswordError",
          kind: "master"
        });
        expect(await service.getPasswordKind(id)).toBe("master");

        await service.moveToOwnPassword(id, masterPassword, password);

        expect(await service.getPasswordKind(id)).toBe("password");
        expect(await service.getSecret(id, password)).toBe(mnemonic);
        await expect(service.getSecret(id, masterPassword)).rejects.toThrow();
        expect(await service.getMasterPasswordUsage()).toEqual({ used: 0, total: 1 });
      });

      it("notifies password kind changes of the watched wallet only", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());
        const other = await service.put(newWallet(2), withMaster());
        const listener = vi.fn();
        const unsubscribe = service.onPasswordKindChange(id, listener);

        await service.moveToOwnPassword(other, masterPassword, password);
        expect(listener).not.toHaveBeenCalled();

        await service.moveToOwnPassword(id, masterPassword, password);
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        await service.moveToMasterPassword(id, password, unlocking());
        expect(listener).toHaveBeenCalledTimes(1);
      });

      it("refuses moves to where the wallet already is", async () => {
        const service = await freshService();
        const onMaster = await service.put(newWallet(1), withMaster());
        const onOwn = await service.put(newWallet(2), own());

        await expect(
          service.moveToMasterPassword(onMaster, masterPassword, unlocking())
        ).rejects.toThrow(/already uses/);
        await expect(service.moveToOwnPassword(onOwn, masterPassword, password)).rejects.toThrow(
          /doesn't use/
        );
      });

      it("doesn't move a wallet onto a master password changed meanwhile", async () => {
        const service = await freshService();
        await service.setUpMasterPassword(masterPassword);
        const id = await service.put(newWallet(1), own());

        const [change, move] = await Promise.allSettled([
          service.changeMasterPassword(masterPassword, newMaster),
          service.moveToMasterPassword(id, password, unlocking())
        ]);

        expect(change.status).toBe("fulfilled");
        // either way, the wallet opens with a password that's still valid
        if (move.status === "fulfilled") {
          expect(await service.getSecret(id, newMaster)).toBe(mnemonic);
        } else {
          expect(move.reason).toMatchObject({
            message: expect.stringMatching(/changed meanwhile/)
          });
          expect(await service.getSecret(id, password)).toBe(mnemonic);
        }
      });

      it("doesn't set up a master password where it expected an existing one", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), own());
        storageApi.setCalls = [];

        await expect(service.moveToMasterPassword(id, password, unlocking())).rejects.toMatchObject(
          {
            name: "MasterPasswordChangedError"
          }
        );
        expect(storageApi.setCalls).toEqual([]);
        expect(await service.hasMasterPassword()).toBe(false);
      });

      it("doesn't take a new master password for one set up meanwhile", async () => {
        const service = await freshService();
        await service.setUpMasterPassword(masterPassword);
        const id = await service.put(newWallet(1), own());
        storageApi.setCalls = [];

        await expect(
          service.moveToMasterPassword(id, password, creating(masterPassword))
        ).rejects.toMatchObject({ name: "MasterPasswordChangedError" });
        expect(storageApi.setCalls).toEqual([]);
        expect(await service.getPasswordKind(id)).toBe("password");
      });
    });

    describe("unlock session", () => {
      const MASK = "unlockSession:mask";
      const MASKED = "unlockSession:masked";
      const locked = { name: "SessionLockedError" };

      async function unlocked() {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());
        await service.setUnlockTimeout("browserRestart");
        await service.getSigningSecret(id, masterPassword);
        return { service, id };
      }

      it("is on by default", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());

        expect(await service.isUnlockSessionEnabled()).toBe(true);
        await service.getSigningSecret(id, masterPassword);
        expect(await service.getSigningSecret(id)).toBe(mnemonic);
      });

      it("isn't started while turned off", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());
        await service.setUnlockTimeout("off");

        expect(await service.getSigningSecret(id, masterPassword)).toBe(mnemonic);
        expect(await service.isUnlocked()).toBe(false);
        expect(local.has(MASK) || session.has(MASKED)).toBe(false);
        await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
      });

      it("signs without the master password once it was typed", async () => {
        const { service, id } = await unlocked();

        expect(await service.isUnlocked()).toBe(true);
        expect(await service.getSigningSecret(id)).toBe(mnemonic);
      });

      it("keeps the key split between disk and memory", async () => {
        await unlocked();
        const mask = local.get(MASK) as { id: string; mask: string };
        const masked = session.get(MASKED) as { id: string; key: string };

        expect(mask.id).toBe(masked.id);
        expect(mask.mask).toMatch(/^[0-9a-f]{64}$/);
        expect(masked.key).toMatch(/^[0-9a-f]{64}$/);
        expect(mask.mask).not.toBe(masked.key);
        expect(JSON.stringify([...local.values()])).not.toContain(masked.key);
        expect(JSON.stringify([...session.values()])).not.toContain(mask.mask);
      });

      it("isn't cleared by a read between the writes of its start", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());
        await service.setUnlockTimeout("browserRestart");
        const { storage } = await import("webextension-polyfill");
        const set = storage.session.set.bind(storage.session);
        const reads: Promise<boolean>[] = [];
        vi.spyOn(storage.session, "set").mockImplementation(async (items) => {
          // the mask is written, its other half not yet
          reads.push(service.isUnlocked());
          await new Promise((resolve) => setTimeout(resolve, 50));
          return set(items);
        });

        await service.getSigningSecret(id, masterPassword);
        await Promise.all(reads);

        expect(reads).toHaveLength(1);
        expect(await service.getSigningSecret(id)).toBe(mnemonic);
      });

      it("is started and ended without signing", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());

        await expect(service.unlock("wrong password")).rejects.toMatchObject({
          name: "PasswordError"
        });
        expect(await service.isUnlocked()).toBe(false);

        await service.unlock(masterPassword);
        expect(await service.getSigningSecret(id)).toBe(mnemonic);

        await service.lock();
        expect(local.has(MASK) || session.has(MASKED)).toBe(false);
        await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
      });

      it("can be started once on and used by a wallet", async () => {
        const service = await freshService();
        expect(await service.canUnlock()).toBe(false);

        const own = await service.put(newWallet(1), { value: mnemonic, password, by: "password" });
        await service.setUpMasterPassword(masterPassword);
        expect(await service.canUnlock()).toBe(false);

        await service.moveToMasterPassword(own, password, unlocking());
        expect(await service.canUnlock()).toBe(true);

        await service.setUnlockTimeout("off");
        expect(await service.canUnlock()).toBe(false);
        await expect(service.unlock(masterPassword)).rejects.toThrow(/turned off/);
      });

      it("uses a fresh mask on every unlock", async () => {
        const { service, id } = await unlocked();
        const first = local.get(MASK);

        await service.getSigningSecret(id, masterPassword);
        expect(local.get(MASK)).not.toEqual(first);
        expect(await service.getSigningSecret(id)).toBe(mnemonic);
      });

      it("isn't started by a wrong master password", async () => {
        const service = await freshService();
        const id = await service.put(newWallet(1), withMaster());
        await service.setUnlockTimeout("browserRestart");

        await expect(service.getSigningSecret(id, "wrong password")).rejects.toMatchObject({
          name: "PasswordError"
        });
        expect(await service.isUnlocked()).toBe(false);
      });

      it("doesn't cover wallets on their own password", async () => {
        const { service } = await unlocked();
        const own = await service.put(newWallet(2), { value: mnemonic, password, by: "password" });

        await expect(service.getSigningSecret(own)).rejects.toMatchObject(locked);
        expect(await service.getSigningSecret(own, password)).toBe(mnemonic);
        expect(await service.isUnlocked()).toBe(true);
      });

      it("still asks for the password outside signing", async () => {
        const { service, id } = await unlocked();

        await expect(service.getSecret(id, "")).rejects.toMatchObject({ name: "PasswordError" });
        expect(await service.verifyMasterPassword("")).toBe(false);
      });

      it("adds wallets on the master password without it", async () => {
        const { service } = await unlocked();
        const second = await service.put(newWallet(2), { value: mnemonic, by: "master" });

        expect(await service.getSecret(second, masterPassword)).toBe(mnemonic);
      });

      it("ends when turned off", async () => {
        const { service, id } = await unlocked();

        await service.setUnlockTimeout("off");
        expect(local.has(MASK) || session.has(MASKED)).toBe(false);
        await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
      });

      it("ends when the master password changes", async () => {
        const { service, id } = await unlocked();

        await service.changeMasterPassword(masterPassword, "new master password");
        expect(local.has(MASK) || session.has(MASKED)).toBe(false);
        expect(await service.isUnlocked()).toBe(false);
        await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
      });

      it("ends for a master key re-wrapped behind its back", async () => {
        const { service, id } = await unlocked();
        const record = local.get("masterKey") as { wrappedKey: { iv: string } };
        local.set("masterKey", { ...record, wrappedKey: { ...record.wrappedKey, iv: "00" } });

        expect(await service.isUnlocked()).toBe(false);
        expect(local.has(MASK) || session.has(MASKED)).toBe(false);
        local.set("masterKey", record);
        await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
      });

      describe("timeout", () => {
        const HOUR = 60 * 60 * 1000;
        const at = (elapsed: number) => vi.spyOn(Date, "now").mockReturnValue(migratedAt + elapsed);

        it("lasts until the browser restarts by default", async () => {
          const { service, id } = await unlocked();
          expect(await service.getUnlockTimeout()).toBe("browserRestart");

          at(100 * HOUR);
          expect(await service.getSigningSecret(id)).toBe(mnemonic);
        });

        it("ends once idle for longer than the timeout", async () => {
          const { service, id } = await unlocked();
          await service.setUnlockTimeout("1h");

          at(HOUR);
          expect(await service.isUnlocked()).toBe(false);
          expect(local.has(MASK) || session.has(MASKED)).toBe(false);
          await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
        });

        it("counts minute timeouts", async () => {
          const { service, id } = await unlocked();
          await service.setUnlockTimeout("15m");

          at(14 * 60 * 1000);
          expect(await service.getSigningSecret(id)).toBe(mnemonic);
          at(29 * 60 * 1000);
          await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
        });

        it("is extended by every use", async () => {
          const { service, id } = await unlocked();
          await service.setUnlockTimeout("1h");

          expect(alarmsSet.get("unlockSession:expiry")).toBe(migratedAt + HOUR);
          at(0.75 * HOUR);
          expect(await service.getSigningSecret(id)).toBe(mnemonic);
          expect(alarmsSet.get("unlockSession:expiry")).toBe(migratedAt + 1.75 * HOUR);
          at(1.5 * HOUR);
          expect(await service.getSigningSecret(id)).toBe(mnemonic);
          at(2.5 * HOUR);
          await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
        });

        it("ends right away when set below the time already idle", async () => {
          const { service, id } = await unlocked();

          at(2 * HOUR);
          await service.setUnlockTimeout("4h");
          expect(await service.getSigningSecret(id)).toBe(mnemonic);

          at(3 * HOUR);
          await service.setUnlockTimeout("1h");
          expect(local.has(MASK) || session.has(MASKED)).toBe(false);
          await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
        });

        it("is cleared when expired", async () => {
          const { service } = await unlocked();
          await service.setUnlockTimeout("4h");

          at(3 * HOUR);
          await service.expireSession();
          expect(await service.isUnlocked()).toBe(true);

          at(4 * HOUR);
          await service.expireSession();
          expect(local.has(MASK) || session.has(MASKED)).toBe(false);
          expect(alarmsSet.size).toBe(0);
        });

        it("refuses the system lock where it can't be detected", async () => {
          const { service, id } = await unlocked();

          await expect(service.setUnlockTimeout("systemLock")).rejects.toThrow(/system lock/);
          expect(await service.getUnlockTimeout()).toBe("browserRestart");
          await service.onSystemLock();
          expect(await service.getSigningSecret(id)).toBe(mnemonic);
        });
      });

      it("ends when its halves don't belong together", async () => {
        const { service } = await unlocked();
        const masked = session.get(MASKED) as { id: string };
        session.set(MASKED, { ...masked, id: "other" });

        expect(await service.isUnlocked()).toBe(false);
        expect(local.has(MASK) || session.has(MASKED)).toBe(false);
      });

      it("ends, rather than reporting a wrong password, when its key is damaged", async () => {
        const { service, id } = await unlocked();
        const masked = session.get(MASKED) as { key: string };
        session.set(MASKED, { ...masked, key: "ff".repeat(32) });

        await expect(service.getSigningSecret(id)).rejects.toMatchObject(locked);
        await expect(
          service.put(newWallet(2), { value: mnemonic, by: "master" })
        ).rejects.toMatchObject(locked);
        expect(local.has(MASK) || session.has(MASKED)).toBe(false);
        expect(local.has("walletSecret:2")).toBe(false);
      });

      it("ends when the browser restarts, leaving no mask behind", async () => {
        await unlocked();
        session.clear();
        const { clearStaleMask } = await import("@/database/unlockSession");

        await clearStaleMask();
        expect(local.has(MASK)).toBe(false);
      });

      it("keeps a live mask on a service worker restart", async () => {
        await unlocked();
        const { clearStaleMask } = await import("@/database/unlockSession");

        await clearStaleMask();
        expect(local.has(MASK)).toBe(true);
      });
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
