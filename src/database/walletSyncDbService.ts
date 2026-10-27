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
}

export const walletSyncDbService = new WalletSyncDbService();
