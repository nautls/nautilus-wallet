import { IDbAddress, IDbWallet } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { find } from "lodash";
import { AddressState } from "@/types/internal";
import { walletsDbService } from "./walletsDbService";

class AddressesDbService {
  public async getByScript(script: string): Promise<IDbAddress | undefined> {
    return await dbContext.addresses.where({ script }).first();
  }

  public async getByWalletId(walletId: number): Promise<IDbAddress[]> {
    return await dbContext.addresses.where({ walletId }).toArray();
  }

  public async getByState(walletId: number, state: AddressState): Promise<IDbAddress[]> {
    const addresses = await dbContext.addresses
      .orderBy("index")
      .filter((a) => a.walletId === walletId && a.state == state)
      .toArray();

    return addresses;
  }

  public async getChangeAddress(walletId: number): Promise<IDbAddress | undefined> {
    const wallet = await walletsDbService.getById(walletId);
    if (!wallet) {
      return;
    }

    const address = await this._getChangeAddress(wallet);
    if (!address) {
      return await dbContext.addresses
        .orderBy("index")
        .filter((a) => a.walletId === walletId)
        .first();
    }

    return address;
  }

  private async _getChangeAddress(wallet: IDbWallet): Promise<IDbAddress | undefined> {
    if (wallet.settings.avoidAddressReuse) {
      return await dbContext.addresses
        .orderBy("index")
        .filter((a) => a.walletId === wallet.id && a.state === AddressState.Unused)
        .first();
    }

    return await dbContext.addresses
      .filter((a) => a.walletId === wallet.id && a.index === wallet.settings.defaultChangeIndex)
      .first();
  }

  public async put(address: IDbAddress): Promise<string> {
    return dbContext.addresses.put(address);
  }

  public async bulkPut(addresses: IDbAddress[], walletId: number): Promise<void> {
    const dbAddresses = await this.getByWalletId(walletId);
    const putAddresses: IDbAddress[] = [];

    for (const address of addresses) {
      const dbAddress = find(dbAddresses, (a) => a.script == address.script);

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
