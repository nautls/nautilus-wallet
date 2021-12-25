import { IDbAsset } from "@/db/dbTypes";
import { dbContext } from "@/db/dbContext";
import { differenceBy, find, groupBy, unionBy } from "lodash";
import { AddressAPIResponse, ExplorerV1AddressBalanceResponse } from "@/types/explorer";
import { AssetType } from "@/types/internal";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";

class assetsDbService {
  public async getFromTokenId(tokenId: string): Promise<IDbAsset | undefined> {
    return await dbContext.assets.where("tokenId").equals(tokenId).first();
  }

  public async getAllFromAddress(address: string): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ address: address }).toArray();
  }

  public async getAllFromWalletId(walletId: number): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ walletId }).toArray();
  }

  public parseAddressBalanceAPIResponse(
    apiResponse: AddressAPIResponse<ExplorerV1AddressBalanceResponse>[],
    walletId: number
  ): IDbAsset[] {
    let assets: IDbAsset[] = [];

    for (const balance of apiResponse) {
      if (!balance.data) {
        continue;
      }

      const confirmed = balance.data.confirmed.tokens;
      const unconfirmed = balance.data.unconfirmed.tokens;
      assets = assets.concat(
        unionBy(confirmed, unconfirmed, t => t.tokenId).map(t => {
          return {
            tokenId: t.tokenId,
            name: t.name,
            type: AssetType.EIP4,
            confirmedAmount: t.amount?.toString() || "0",
            unconfirmedAmount: find(
              unconfirmed,
              ut => ut.tokenId === t.tokenId
            )?.amount?.toString(),
            decimals: t.decimals,
            address: balance.address,
            walletId
          };
        })
      );

      assets.push({
        tokenId: ERG_TOKEN_ID,
        name: "ERG",
        type: AssetType.Native,
        confirmedAmount: balance.data.confirmed.nanoErgs?.toString() || "0",
        unconfirmedAmount: balance.data.unconfirmed.nanoErgs?.toString(),
        decimals: ERG_DECIMALS,
        address: balance.address,
        walletId
      });
    }

    return assets;
  }

  public async sync(assets: IDbAsset[]): Promise<void> {
    const groups = groupBy(assets, a => a.address);

    for (const key in groups) {
      const group = groups[key];
      if (group.length === 0) {
        continue;
      }

      const dbAssets = await this.getAllFromAddress(key);
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
