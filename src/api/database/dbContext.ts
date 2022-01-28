import Dexie, { Table } from "dexie";
import { IDbDAppConnection, IDbAddress, IDbAsset, IDbWallet } from "@/types/database";

class NautilusDb extends Dexie {
  wallets!: Table<IDbWallet, number>;
  addresses!: Table<IDbAddress, string>;
  assets!: Table<IDbAsset, string[]>;
  connectedDApps!: Table<IDbDAppConnection, string>;

  constructor() {
    super("nautilusDb");
    this.version(1).stores({
      wallets: "++id, network, &publicKey",
      addresses: "&script, type, walletId",
      assets: "&[tokenId+address], &[address+tokenId], walletId"
    });

    this.version(2).stores({
      addresses: "&script, type, state, walletId"
    });

    this.version(3).stores({
      connectedDApps: "&origin, walletId"
    });
  }
}

export const dbContext = new NautilusDb();
