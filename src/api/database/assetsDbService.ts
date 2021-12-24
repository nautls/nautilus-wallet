import { IDbAsset } from "@/db/dbTypes";
import { dbContext } from "@/db/dbContext";
import { differenceBy, find, groupBy } from "lodash";

class assetsDbService {
  public async getFromTokenId(tokenId: string): Promise<IDbAsset | undefined> {
    return await dbContext.assets.where("tokenId").equals(tokenId).first();
  }

  public async getAllFromAddresses(address: string): Promise<IDbAsset[] | undefined> {
    return await dbContext.assets.where("addressId").equals(address).toArray();
  }

  public async sync(assets: IDbAsset[]): Promise<void> {
    const groups = groupBy(assets, a => a.address);

    for (const key in groups) {
      const group = groups[key];
      if (group.length === 0) {
        continue;
      }

      const dbAssets = await this.getAllFromAddresses(key);
      if (!dbAssets) {
        await dbContext.assets.bulkPut(group);
        return;
      }

      const remove = differenceBy(dbAssets, group, a => a.tokenId).map(a => a.tokenId);
      const put = this.newOrChanged(dbAssets, group);
      if (remove.length > 0) {
        await dbContext.assets.bulkDelete(remove);
      }
      if (put.length > 0) {
        await dbContext.assets.bulkPut(put);
      }
    }
  }

  private newOrChanged(dbAssets: IDbAsset[], currentAssets: IDbAsset[]): IDbAsset[] {
    const put: IDbAsset[] = [];

    for (const asset of currentAssets) {
      const dbAsset = find(dbAssets, a => a.tokenId == asset.tokenId);
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
