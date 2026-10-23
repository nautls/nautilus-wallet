import { omit } from "es-toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ILegacyDbWallet } from "@/types/database";
import { Network, WalletType } from "@/types/internal";

const { local, legacyWallets, storageApi } = vi.hoisted(() => {
  const local = new Map<string, unknown>();
  const legacyWallets = new Map<number, unknown>();
  const storageApi = { getKeysSupported: true, getCalls: [] as (string | string[] | null)[] };
  return { local, legacyWallets, storageApi };
});

vi.mock("webextension-polyfill", () => {
  const clone = <T>(v: T): T => structuredClone(v);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0)); // let calls interleave

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
          await tick();
          for (const [k, v] of Object.entries(items)) local.set(k, clone(v));
        },
        async remove(keys: string | string[]) {
          await tick();
          for (const k of ([] as string[]).concat(keys)) local.delete(k);
        }
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
      utxos: table()
    }
  };
});

const legacyCiphertext =
  "U2FsdGVkX18UzwO9k37iXcUw5UeCoRnx6tne+hT5Z1+CT56IOYoAu4adRris+NecYR6DzSzCRgXXu0/wSOEg2hrb/CZfJVJS29oM4T2QeMPCwg8SjJ3tdi5C5KF4idZKQMuRdym1oJEWdRbo2YDtWw==";
const mnemonic =
  "fade payment weasel market mixed armed decade shed harbor bind deal mandate pink earth second";
const password = "correct horse battery";

function legacyWallet(id: number, type = WalletType.Standard): ILegacyDbWallet {
  return {
    id,
    name: `wallet ${id}`,
    network: Network.ErgoMainnet,
    type,
    publicKey: `pk${id}`,
    chainCode: `cc${id}`,
    mnemonic: type === WalletType.Standard ? legacyCiphertext : undefined,
    settings: { avoidAddressReuse: false, addressFilter: "all", defaultChangeIndex: 0 },
    lastSynced: 1000
  };
}

async function freshService() {
  vi.resetModules();
  return (await import("@/database/walletsDbService")).walletsDbService;
}

describe("walletsDbService", () => {
  beforeEach(() => {
    local.clear();
    legacyWallets.clear();
    storageApi.getKeysSupported = true;
    storageApi.getCalls = [];
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
      const readOnly = legacyWallet(4, WalletType.ReadOnly);
      legacyWallets.set(1, standard);
      legacyWallets.set(4, readOnly);

      const service = await freshService();
      const wallets = await service.getAll();

      expect(wallets).toEqual([
        {
          ...omit(standard, ["mnemonic"]),
          crypto: {
            version: 1,
            ciphertext: legacyCiphertext
          }
        },
        { ...readOnly, mnemonic: undefined }
      ]);
      expect(wallets[1]).not.toHaveProperty("crypto");
      expect(local.get("wallets:nextId")).toBe(5);
      expect(local.get("wallets:schemaVersion")).toBe(1);
      expect(await service.getMnemonic(1, password)).toBe(mnemonic);
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
      await service.put({ ...omit(legacyWallet(1), ["mnemonic"]), id: undefined });
      expect(local.has("wallets:schemaVersion")).toBe(false);

      await (await freshService()).getAll();
      expect(local.get("wallets:schemaVersion")).toBe(1);

      legacyWallets.set(5, legacyWallet(5)); // no longer read
      expect((await (await freshService()).getAll()).map((w) => w.id)).toEqual([1]);
    });

    it("runs once when called concurrently", async () => {
      legacyWallets.set(1, legacyWallet(1));
      const service = await freshService();

      const results = await Promise.all([service.getAll(), service.getById(1), service.getAll()]);
      expect(results[0]).toHaveLength(1);
      expect(results[1]?.id).toBe(1);
    });
  });

  it("allocates new ids after migrated ones and dedupes by public key", async () => {
    legacyWallets.set(3, legacyWallet(3));
    const service = await freshService();

    const wallet = { ...legacyWallet(10), id: undefined };
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
      [1, 2, 3].map((i) => service.put({ ...legacyWallet(i), id: undefined }))
    );

    expect(new Set(ids).size).toBe(3);
  });

  it("doesn't write to IndexedDB", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();

    await service.updateSettings(1, { name: "renamed", lastSynced: 2000 });
    await service.put({ ...omit(legacyWallet(2), ["mnemonic"]), id: undefined });

    expect([...legacyWallets.values()]).toEqual([legacyWallet(1)]);
  });

  it("changes password and drops the IndexedDB copy", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();

    await service.changePassword(1, password, "new password 123");

    expect(await service.getMnemonic(1, "new password 123")).toBe(mnemonic);
    await expect(service.getMnemonic(1, password)).rejects.toThrow();
    expect(legacyWallets.has(1)).toBe(false);
  });

  it("doesn't lose a password change to a concurrent settings update", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();
    await service.getAll();

    await Promise.all([
      service.changePassword(1, password, "new password 123"),
      service.updateSettings(1, { lastSynced: 2000 }),
      service.updateSettings(1, { name: "renamed" })
    ]);

    const wallet = await service.getById(1);
    expect(wallet?.lastSynced).toBe(2000);
    expect(wallet?.name).toBe("renamed");
    expect(await service.getMnemonic(1, "new password 123")).toBe(mnemonic);
  });

  it("doesn't recreate a deleted wallet on a concurrent update", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();
    await service.getAll();

    await Promise.all([service.updateSettings(1, { lastSynced: 2000 }), service.delete(1)]);

    expect(await service.getAll()).toEqual([]);
    expect(legacyWallets.has(1)).toBe(false);
  });

  it("deletes from both storages", async () => {
    legacyWallets.set(1, legacyWallet(1));
    const service = await freshService();

    await service.delete(1);

    expect(await service.getAll()).toEqual([]);
    expect(legacyWallets.has(1)).toBe(false);
  });
});
