import { expect, test } from "../fixtures/test";

test("moves connections stored by host to their origin", async ({ context, popup }) => {
  const [worker] = context.serviceWorkers();

  // recreates the database as of Dexie version 8 (IndexedDB version 80), when connections
  // were stored by host
  await worker.evaluate(async () => {
    const done = (req: IDBRequest | IDBOpenDBRequest) =>
      new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

    // the worker's own startup migration may reopen the database meanwhile, so retry
    let db: IDBDatabase | undefined;
    for (let attempt = 0; !db; attempt++) {
      await done(indexedDB.deleteDatabase("nautilusDb"));
      const open = indexedDB.open("nautilusDb", 80);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore("connectedDApps", { keyPath: "origin" });
        store.createIndex("walletId", "walletId");
      };
      db = (await done(open).catch((e) => {
        if (attempt >= 10) throw e;
      })) as IDBDatabase | undefined;
    }

    const tx = db.transaction("connectedDApps", "readwrite");
    tx.objectStore("connectedDApps").put({ origin: "dapp.test", walletId: 1 });
    tx.objectStore("connectedDApps").put({ origin: "localhost:5173", walletId: 1 });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  });

  // opening the app opens the database, which upgrades it
  await popup.goto();

  const readConnections = () =>
    worker.evaluate(async () => {
      const open = indexedDB.open("nautilusDb");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const req = db.transaction("connectedDApps").objectStore("connectedDApps").getAllKeys();
      const keys = await new Promise((resolve) => (req.onsuccess = () => resolve(req.result)));
      const version = db.version;
      db.close();

      return { version, keys };
    });

  // the app opens the database while starting up
  await expect.poll(readConnections).toEqual({
    version: 90,
    keys: ["http://localhost:5173", "https://dapp.test"]
  });
});
