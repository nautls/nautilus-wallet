import { IDbAddress, IDbWallet } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import AES from "crypto-js/aes";
import utf8Enc from "crypto-js/enc-utf8";
import { isEmpty } from "lodash";
import { AddressState, UpdateWalletSettingsCommand } from "@/types/internal";
import { PasswordError } from "@/types/errors";
import { assestsDbService } from "./assetsDbService";

class WalletsDbService {
  public async getById(id: number): Promise<IDbWallet | undefined> {
    return await dbContext.wallets.where("id").equals(id).first();
  }

  public async getMnemonic(id: number, password: string) {
    const wallet = await this.getById(id);
    if (!wallet) {
      throw Error("wallet not found");
    }
    if (!wallet.mnemonic) {
      throw Error("wallet doesn't have a mnemonic phrase");
    }

    try {
      const mnemonic = AES.decrypt(wallet.mnemonic, password).toString(utf8Enc);
      if (isEmpty(mnemonic)) {
        throw new PasswordError();
      }

      return mnemonic;
    } catch {
      throw new PasswordError();
    }
  }

  public async getFirstUnusedAddress(walletId: number): Promise<IDbAddress | undefined> {
    return await dbContext.addresses
      .where("walletId")
      .equals(walletId)
      .and((a) => a.state === AddressState.Unused)
      .first();
  }

  public async getByPk(publicKey: string): Promise<IDbWallet | undefined> {
    return await dbContext.wallets.where("publicKey").equals(publicKey).first();
  }

  public async put(wallet: IDbWallet): Promise<number> {
    const dbWallet = await this.getByPk(wallet.publicKey);
    if (!wallet.id) {
      wallet.id = dbWallet?.id;
    }

    return dbContext.wallets.put(wallet);
  }

  public async updateSettings(
    walletId: number,
    walletName: string,
    command: UpdateWalletSettingsCommand
  ): Promise<number> {
    return await dbContext.wallets.update(walletId, {
      name: walletName.trim(),
      "settings.avoidAddressReuse": command.avoidAddressReuse,
      "settings.hideUsedAddresses": command.hideUsedAddresses
    });
  }

  public async updateChangeIndex(walletId: number, index: number) {
    return await dbContext.wallets.update(walletId, {
      "settings.defaultChangeIndex": index
    });
  }

  public async updateUsedAddressFilter(walletId: number, hide: boolean) {
    return await dbContext.wallets.update(walletId, {
      "settings.hideUsedAddresses": hide
    });
  }

  public async getAll(): Promise<IDbWallet[]> {
    return await dbContext.wallets.toArray();
  }

  public async delete(walletId: number): Promise<void> {
    await dbContext.addresses.where({ walletId }).delete();
    await dbContext.assets.where({ walletId }).delete();
    await dbContext.connectedDApps.where({ walletId }).delete();
    await dbContext.wallets.delete(walletId);
  }
}

export const walletsDbService = new WalletsDbService();
