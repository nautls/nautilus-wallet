import Dexie, { Table } from "dexie";
import {
  IDbDAppConnection,
  IDbAddress,
  IDbAsset,
  IDbWallet,
  IDbUtxo,
  IAssetInfo
} from "@/types/database";
import { uniqBy } from "lodash";
import { ERG_TOKEN_ID, UNKNOWN_MINTING_BOX_ID } from "@/constants/ergo";

class NautilusDb extends Dexie {
  wallets!: Table<IDbWallet, number>;
  addresses!: Table<IDbAddress, string>;
  assets!: Table<IDbAsset, string[]>;
  connectedDApps!: Table<IDbDAppConnection, string>;
  utxos!: Table<IDbUtxo, string>;
  assetInfo!: Table<IAssetInfo, string>;

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
      connectedDApps: "&origin, walletId",
      addresses: "&script, type, state, index, walletId"
    });

    this.version(4).upgrade(async (t) => {
      t.table("wallets").each((obj, k) => {
        t.table("wallets").update(k.primaryKey, {
          "settings.avoidAddressReuse": false,
          "settings.hideUsedAddresses": false,
          "settings.defaultChangeIndex": 0
        });
      });
    });

    this.version(5).stores({
      utxos: "&id, spentTxId, address, walletId"
    });

    this.version(6)
      .stores({
        assetInfo: "&id, mintingBoxId, type, subtype"
      })
      .upgrade(async (t) => {
        const assets = await t.table("assets").toArray();
        if (assets.length === 0) {
          return;
        }

        const assetInfo = uniqBy(
          assets
            .filter((a) => a.tokenId !== ERG_TOKEN_ID)
            .map((a) => {
              return {
                id: a.tokenId,
                mintingBoxId: UNKNOWN_MINTING_BOX_ID,
                decimals: a.decimals,
                name: a.name
              } as IAssetInfo;
            }),
          (a) => a.id
        );
        await t.table("assetInfo").bulkAdd(assetInfo);
      });
  }
}

export const dbContext = new NautilusDb();
