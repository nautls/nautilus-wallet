import { IDbAsset } from "@/types/database";
import { dbContext } from "@/database/dbContext";

class AssetsDbService {
  public async getByTokenId(walletId: number, tokenId: string): Promise<IDbAsset[]> {
    return dbContext.assets.where({ walletId, tokenId }).toArray();
  }

  public async getAddressesByTokenId(walletId: number, tokenId: string): Promise<string[]> {
    return (await this.getByTokenId(walletId, tokenId)).map((a) => a.address);
  }

  public async getByAddress(address: string): Promise<IDbAsset[]> {
    return dbContext.assets.where({ address: address }).toArray();
  }

  public async getByWalletId(walletId: number): Promise<IDbAsset[]> {
    return dbContext.assets.where({ walletId }).toArray();
  }

  public async bulkPut(assets: IDbAsset[]): Promise<void> {
    if (assets.length === 0) return;
    await dbContext.assets.bulkPut(assets);
  }

  public async bulkDelete(assets: IDbAsset[]): Promise<void> {
    if (assets.length === 0) return;
    await dbContext.assets.bulkDelete(assets.map((a) => [a.tokenId, a.address]));
  }
}

export const assetsDbService = new AssetsDbService();
