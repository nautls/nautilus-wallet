import { IDbAssetInfo } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { difference, isEmpty, uniqBy } from "lodash";

class AssetInfoDbService {
  public async addIfNotExists(assets: IDbAssetInfo[]) {
    if (isEmpty(assets)) {
      return;
    }

    assets = uniqBy(assets, (a) => a.id);
    const paramIds = assets.map((a) => a.id);
    const dbIds = await dbContext.assetInfo.where("id").anyOf(paramIds).primaryKeys();
    const uncommited = difference(paramIds, dbIds);

    if (!isEmpty(uncommited)) {
      await dbContext.assetInfo.bulkAdd(assets.filter((a) => uncommited.includes(a.id)));
    }
  }

  public async getAnyOf(ids: string[]): Promise<IDbAssetInfo[]> {
    if (isEmpty(ids)) {
      return [];
    }

    return await dbContext.assetInfo.where("id").anyOf(ids).toArray();
  }

  public async getAllExcept(ids: string[]): Promise<IDbAssetInfo[]> {
    return await dbContext.assetInfo.where("id").noneOf(ids).toArray();
  }

  public async getAll(): Promise<IDbAssetInfo[]> {
    return await dbContext.assetInfo.toArray();
  }
}

export const assetInfoDbService = new AssetInfoDbService();
