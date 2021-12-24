import Dexie, { Table } from "dexie";
import { IDbAddress, IDbAsset, IDbWallet } from "./dbTypes";

class NautilusDb extends Dexie {
  wallets!: Table<IDbWallet, number>;
  addresses!: Table<IDbAddress, number>;
  assets!: Table<IDbAsset, number>;

  constructor() {
    super("nautilusDb");
    this.version(1).stores({
      wallets: "++id, network, &publicKey",
      addresses: "&script, type, walletId",
      assets: "tokenId, addressId"
    });
  }
}

export const dbContext = new NautilusDb();
