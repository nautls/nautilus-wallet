import { IDbAddress } from "@/db/dbTypes";
import { dbContext } from "@/db/dbContext";
import { find } from "lodash";

class AddressesDbService {
  public async getFromId(id: number): Promise<IDbAddress | undefined> {
    return await dbContext.addresses.where("id").equals(id).first();
  }

  public async getFromScript(script: string): Promise<IDbAddress | undefined> {
    return await dbContext.addresses.where("script").equals(script).first();
  }

  public async put(address: IDbAddress): Promise<number> {
    const dbAddress = await this.getFromScript(address.script);
    if (!address.id) {
      address.id = dbAddress?.id;
    }

    return dbContext.addresses.put(address);
  }

  public async bulkPut(addresses: IDbAddress[], walletId: number): Promise<number> {
    const dbAddresses = await this.getAllFromWalletId(walletId);
    const putAddresses: IDbAddress[] = [];

    for (const address of addresses) {
      const dbAddress = find(dbAddresses, a => a.script == address.script);

      if (this.isNewOrModified(address, dbAddress)) {
        address.walletId = walletId;
        if (!address.id) {
          address.id = dbAddress?.id;
        }

        putAddresses.push(address);
      }
    }

    if (putAddresses.length > 0) {
      return await dbContext.addresses.bulkPut(putAddresses);
    } else {
      return 0;
    }
  }

  private isNewOrModified(address: IDbAddress, dbAddress: IDbAddress | undefined) {
    return !dbAddress || address.state !== dbAddress.state;
  }

  public async getAllFromWalletId(walletId: number): Promise<IDbAddress[]> {
    return await dbContext.addresses.where("walletId").equals(walletId).toArray();
  }
}

export const addressesDbService = new AddressesDbService();
