import { omit } from "es-toolkit";
import { storage } from "webextension-polyfill";
import { EncryptedSecret, fromLegacyCiphertext } from "@/common/keystore";
import { MAINNET } from "@/constants/ergo";
import { dbContext } from "@/database/dbContext";
import {
  NEXT_ID_KEY,
  secretKey,
  walletKey,
  walletsDbService,
  withLock
} from "@/database/walletsDbService";
import { IDbWallet } from "@/types/database";
import { WalletType } from "@/types/internal";

const SCHEMA_VERSION = 1;
const SCHEMA_VERSION_KEY = "wallets:schemaVersion";

/** Former `WalletType` enum values, by index. */
const LEGACY_WALLET_TYPES: WalletType[] = ["standard", "readonly", "ledger"];

export function runMigrations(): Promise<void> {
  return withLock(async () => {
    const stored = await storage.local.get(SCHEMA_VERSION_KEY);
    if (((stored[SCHEMA_VERSION_KEY] as number | undefined) ?? 0) >= SCHEMA_VERSION) return;

    if (await migrateWalletsFromIndexedDb()) {
      await storage.local.set({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
    }
  });
}

/**
 * Copies wallets from the IndexedDB `wallets` table to `browser.storage.local`, keeping
 * their ids, as other tables and settings reference wallets by id. Wallets already in
 * `browser.storage.local` are never overwritten, so it's safe to run more than once.
 *
 * @returns `false` if there was nothing to migrate yet, so it's checked again next time
 */
async function migrateWalletsFromIndexedDb(): Promise<boolean> {
  const legacyWallets = await dbContext.wallets.toArray();
  if (legacyWallets.length === 0) {
    return (await walletsDbService.getAll()).length > 0;
  }

  const keys = legacyWallets.map((w) => walletKey(w.id!));
  const existing = await storage.local.get([...keys, NEXT_ID_KEY]);

  const migratedAt = Date.now();
  const items: Record<string, unknown> = {};
  for (const wallet of legacyWallets) {
    const id = wallet.id!;
    if (existing[walletKey(id)]) continue;

    items[walletKey(id)] = {
      ...omit(wallet, ["mnemonic", "lastSynced", "network"]),
      id,
      chain: { id: "ergo", network: MAINNET ? "mainnet" : "testnet" },
      type: LEGACY_WALLET_TYPES[wallet.type] ?? "standard",
      needsBackup: false,
      createdAt: migratedAt
    };
    if (wallet.mnemonic) items[secretKey(id)] = fromLegacyCiphertext(wallet.mnemonic);
  }

  const maxId = Math.max(...legacyWallets.map((w) => w.id!));
  const nextId = Math.max((existing[NEXT_ID_KEY] as number | undefined) ?? 1, maxId + 1);
  await storage.local.set({ ...items, [NEXT_ID_KEY]: nextId });

  const written = await storage.local.get(Object.keys(items));
  for (const wallet of legacyWallets) {
    const id = wallet.id!;
    if (existing[walletKey(id)]) continue;

    const migrated = written[walletKey(id)] as IDbWallet | undefined;
    const secret = written[secretKey(id)] as EncryptedSecret | undefined;
    if (
      migrated?.publicKey !== wallet.publicKey ||
      (secret?.ciphertext || undefined) !== (wallet.mnemonic || undefined)
    ) {
      throw Error(`failed to migrate wallet ${wallet.id} to extension storage`);
    }
  }

  return true;
}
