import { IDbAsset } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { differenceBy, find, groupBy, isEmpty, keys, union, unionBy, uniq } from "lodash";
import { AddressAPIResponse, ExplorerV1AddressBalanceResponse } from "@/types/explorer";
import { AssetStandard } from "@/types/internal";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { isZero } from "@/utils/bigNumbers";

class assetsDbService {
  public async getByTokenId(walletId: number, tokenId: string): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ walletId, tokenId }).toArray();
  }

  public async getByAddress(address: string): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ address: address }).toArray();
  }

  public async getByWalletId(walletId: number): Promise<IDbAsset[]> {
    return await dbContext.assets.where({ walletId }).toArray();
  }

  public parseAddressBalanceAPIResponse(
    apiResponse: AddressAPIResponse<ExplorerV1AddressBalanceResponse>[],
    walletId: number
  ): IDbAsset[] {
    let assets: IDbAsset[] = [];

    for (const balance of apiResponse.filter((r) => !this.isEmptyBalance(r.data))) {
      if (!balance.data) {
        continue;
      }

      assets = assets.concat(
        balance.data.confirmed.tokens.map((t) => {
          return {
            tokenId: t.tokenId,
            name: t.name,
            type: AssetStandard.EIP4,
            confirmedAmount: t.amount?.toString() || "0",
            decimals: t.decimals,
            address: balance.address,
            walletId
          };
        })
      );

      assets.push({
        tokenId: ERG_TOKEN_ID,
        name: "ERG",
        type: AssetStandard.Native,
        confirmedAmount: balance.data.confirmed.nanoErgs?.toString() || "0",
        unconfirmedAmount: balance.data.unconfirmed.nanoErgs?.toString(),
        decimals: ERG_DECIMALS,
        address: balance.address,
        walletId
      });
    }

    return assets;
  }

  public isEmptyBalance(balance: ExplorerV1AddressBalanceResponse): boolean {
    return (
      isZero(balance.confirmed.nanoErgs) &&
      isZero(balance.unconfirmed.nanoErgs) &&
      isEmpty(balance.confirmed.tokens) &&
      isEmpty(balance.unconfirmed.tokens)
    );
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
