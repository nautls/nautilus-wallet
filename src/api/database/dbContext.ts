import Dexie, { Table } from "dexie";
import { IDbAddress, IDbAsset, IDbWallet } from "@/types/database";

class NautilusDb extends Dexie {
  wallets!: Table<IDbWallet, number>;
  addresses!: Table<IDbAddress, string>;
  assets!: Table<IDbAsset, { address: string; tokenId: string }>;

  constructor() {
    super("nautilusDb");
    this.version(1).stores({
      wallets: "++id, network, &publicKey",
      addresses: "&script, type, walletId",
      assets: "&[tokenId+address], &[address+tokenId], walletId"
    });
  }
}

export const dbContext = new NautilusDb();
