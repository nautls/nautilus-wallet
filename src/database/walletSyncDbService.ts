import { dbContext } from "@/database/dbContext";
import { IDbAddress, IDbAsset } from "@/types/database";
import { addressesDbService } from "./addressesDbService";
import { assetsDbService } from "./assetsDbService";

export type SyncResult = {
  changedAddresses: IDbAddress[];
  changedAssets: IDbAsset[];
  removedAssets: IDbAsset[];
};

class WalletSyncDbService {
  public async getLastSynced(walletId: number): Promise<number> {
    return (await dbContext.walletSync.get(walletId))?.lastSynced ?? 0;
  }

  /**
   * Persists a sync's changes along with its time, all or nothing, so `lastSynced` never
   * covers data that wasn't saved.
   */
  public async save(walletId: number, result: SyncResult, lastSynced: number): Promise<void> {
    const { addresses, assets, walletSync } = dbContext;
    await dbContext.transaction("rw", [addresses, assets, walletSync], async () => {
      await addressesDbService.bulkPut(result.changedAddresses);
      await assetsDbService.bulkPut(result.changedAssets);
      await assetsDbService.bulkDelete(result.removedAssets);
      await walletSync.put({ walletId, lastSynced });
    });
  }

  /**
   * Wipes the wallet's chain data, which can all be rebuilt by syncing it again. dApp
   * connections are kept, as they are user-granted permissions rather than chain data.
   */
  public async clear(walletId: number): Promise<void> {
    const { addresses, assets, utxos, walletSync } = dbContext;
    await dbContext.transaction("rw", [addresses, assets, utxos, walletSync], async () => {
      await addresses.where({ walletId }).delete();
      await assets.where({ walletId }).delete();
      await utxos.where({ walletId }).delete();
      await walletSync.delete(walletId);
    });
  }
}

export const walletSyncDbService = new WalletSyncDbService();
