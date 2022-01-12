import { IDbWallet } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";

class WalletsDbService {
  public async getFromId(id: number): Promise<IDbWallet | undefined> {
    return await dbContext.wallets.where("id").equals(id).first();
  }

  public async getFromPk(publicKey: string): Promise<IDbWallet | undefined> {
    return await dbContext.wallets.where("publicKey").equals(publicKey).first();
  }

  public async put(wallet: IDbWallet): Promise<number> {
    const dbWallet = await this.getFromPk(wallet.publicKey);
    if (!wallet.id) {
      wallet.id = dbWallet?.id;
    }

    return dbContext.wallets.put(wallet);
  }

  public async getSeed(walletId: number): Promise<string | undefined> {
    const wallet = await dbContext.wallets.where("id").equals(walletId).first();
    return wallet?.privateKey;
  }

  public async getAll(): Promise<IDbWallet[]> {
    return await dbContext.wallets.toArray();
  }
}

export const walletsDbService = new WalletsDbService();
