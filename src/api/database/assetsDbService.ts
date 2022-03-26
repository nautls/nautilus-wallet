import { IDbAsset } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { differenceBy, find, groupBy, isEmpty, keys, union } from "lodash";
import { AddressAPIResponse, ExplorerV1AddressBalanceResponse } from "@/types/explorer";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { isZero } from "@/utils/bigNumbers";

class assetsDbService {
  public async getByTokenId(walletId: number, tokenId: string): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ walletId, tokenId }).toArray();
  }

  public async getAddressesByTokenId(walletId: number, tokenId: string): Promise<string[]> {
    return (await this.getByTokenId(walletId, tokenId)).map((a) => a.address);
  }

  public async getByAddress(address: string): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ address: address }).toArray();
  }

  public async getByWalletId(walletId: number): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ walletId }).toArray();
  }

  public async sync(assets: IDbAsset[], walletId: number): Promise<void> {
    const groups = groupBy(assets, (a) => a.address);
    const dbGroups = groupBy(await this.getByWalletId(walletId), (a) => a.address);
    const groupKeys = union(keys(dbGroups), keys(groups));

    for (const key of groupKeys) {
      const group = groups[key];
      const dbGroup = dbGroups[key];

      if (isEmpty(dbGroup) && isEmpty(groups)) {
        continue;
      } else if (isEmpty(group) && !isEmpty(dbGroup)) {
        await dbContext.assets.bulkDelete(this.primaryKeysFrom(dbGroup));
        continue;
      } else if (isEmpty(dbGroup)) {
        await dbContext.assets.bulkPut(group);
        continue;
      }

      const remove = this.primaryKeysFrom(differenceBy(dbGroup, group, (a) => a.tokenId));
      const put = this.newOrChanged(dbGroup, group);
      if (remove.length > 0) {
        await dbContext.assets.bulkDelete(remove);
      }
      if (put.length > 0) {
        await dbContext.assets.bulkPut(put);
      }
    }
  }

  private primaryKeysFrom(assets: IDbAsset[]): string[][] {
    return assets.map((a) => {
      return [a.tokenId, a.address];
    });
  }

  private newOrChanged(dbAssets: IDbAsset[], currentAssets: IDbAsset[]): IDbAsset[] {
    const put: IDbAsset[] = [];

    for (const asset of currentAssets) {
      const dbAsset = find(dbAssets, (a) => a.tokenId == asset.tokenId);

      if (
        dbAsset &&
        dbAsset.confirmedAmount === asset.confirmedAmount &&
        dbAsset.unconfirmedAmount === asset.unconfirmedAmount
      ) {
        continue;
      }

      put.push(asset);
    }

    return put;
  }
}

export const assestsDbService = new assetsDbService();
