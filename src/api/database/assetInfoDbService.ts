import { IDbAssetInfo } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { difference } from "lodash";

class AssetInfoDbService {
  public async addIfNotExists(assetInfo: IDbAssetInfo[]) {
    const paramIds = assetInfo.map((x) => x.id);
    const dbIds = await dbContext.assetInfo.where("id").anyOf(paramIds).primaryKeys();
    const uncommited = difference(paramIds, dbIds);

    console.log("uncommited ids", uncommited);
    await dbContext.assetInfo.bulkAdd(assetInfo.filter((x) => uncommited.includes(x.id)));
  }
}

export const assetInfoDbService = new AssetInfoDbService();
