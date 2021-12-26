import { IDbAddress } from "@/db/dbTypes";
import { dbContext } from "@/db/dbContext";
import { find, last, maxBy } from "lodash";

class AddressesDbService {
  public async getFromScript(script: string): Promise<IDbAddress | undefined> {
    return await dbContext.addresses.where("script").equals(script).first();
  }

  public async getAllFromWalletId(walletId: number): Promise<IDbAddress[]> {
    return await dbContext.addresses.where("walletId").equals(walletId).toArray();
  }

  public async getLastFromWalletId(walletId: number): Promise<IDbAddress | undefined> {
    return maxBy(
      await dbContext.addresses.where("walletId").equals(walletId).primaryKeys(),
      x => x.index
    );
  }

  public async put(address: IDbAddress): Promise<string> {
    return dbContext.addresses.put(address);
  }

  public async bulkPut(addresses: IDbAddress[], walletId: number): Promise<void> {
    const dbAddresses = await this.getAllFromWalletId(walletId);
    const putAddresses: IDbAddress[] = [];

    for (const address of addresses) {
      const dbAddress = find(dbAddresses, a => a.script == address.script);

      if (this.isNewOrModified(address, dbAddress)) {
        address.walletId = walletId;
        putAddresses.push(address);
      }
    }

    if (putAddresses.length > 0) {
      await dbContext.addresses.bulkPut(putAddresses);
    }
  }

  private isNewOrModified(address: IDbAddress, dbAddress: IDbAddress | undefined) {
    return !dbAddress || address.state !== dbAddress.state;
  }
}

export const addressesDbService = new AddressesDbService();
