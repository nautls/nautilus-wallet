import { IDbWallet } from "@/db/dbTypes";
import { nautilusDb } from "@/db/nautilusDb";

class WalletDbService {
  public async getFromPk(publicKey: string): Promise<IDbWallet | undefined> {
    return await nautilusDb.wallets.where("publicKey").equals(publicKey).first();
  }

  public async getFromId(id: number): Promise<IDbWallet | undefined> {
    return await nautilusDb.wallets.where("id").equals(id).first();
  }

  public async put(wallet: IDbWallet): Promise<number> {
    const dbWallet = await this.getFromPk(wallet.publicKey);
    if (!wallet.id) {
      wallet.id = dbWallet?.id;
    }
    return nautilusDb.wallets.put(wallet);
  }

  public async all(): Promise<IDbWallet[]> {
    return await nautilusDb.wallets.toArray();
  }
}

export const walletDbService = new WalletDbService();
