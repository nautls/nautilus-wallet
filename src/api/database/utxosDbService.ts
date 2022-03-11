import { IDbUtxo } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { ErgoBox, ErgoTx } from "@/types/connector";
import { addressesDbService } from "./addressesDbService";
import { addressFromErgoTree } from "../ergo/addresses";
import BigNumber from "bignumber.js";
import { isEmpty } from "lodash";

class UTxOsDbService {
  public async getAllPending(): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where("spentTxId").notEqual("").toArray();
  }

  public async getByBoxId(boxId: string): Promise<IDbUtxo | undefined> {
    return await dbContext.utxos.where({ boxId }).first();
  }

  public async getByTxId(txId: string): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where({ spentTxId: txId }).toArray();
  }

  public async getByWalletId(walletId: number): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where({ walletId }).toArray();
  }

  public async removeByTxId(txIds: string[]): Promise<void> {
    if (isEmpty(txIds)) {
      return;
    }

    await dbContext.utxos.where("spentTxId").anyOf(txIds).delete();
  }

  public async addFromTx(signedTx: ErgoTx, walletId: number) {
    const addresses = (await addressesDbService.getByWalletId(walletId)).map((a) => a.script);

    const boxes = signedTx.inputs
      .map((input) => {
        return {
          id: input.boxId,
          confirmed: true,
          locked: true,
          spentTxId: signedTx.id,
          spentTimestamp: Date.now(),
          walletId
        } as IDbUtxo;
      })
      .concat(
        signedTx.outputs
          .filter((output) => addresses.includes(addressFromErgoTree(output.ergoTree)))
          .map((output) => {
            return {
              id: output.boxId,
              confirmed: false,
              locked: false,
              content: { ...this.stringifyAmounts(output), confirmed: false },
              spentTxId: signedTx.id,
              spentTimestamp: Date.now(),
              address: addressFromErgoTree(output.ergoTree),
              walletId
            } as IDbUtxo;
          })
      );

    await dbContext.utxos.bulkPut(boxes);
  }

  private stringifyAmounts(box: ErgoBox): ErgoBox {
    box.value = this.asString(box.value);
    for (const token of box.assets) {
      token.amount = this.asString(token.amount);
    }

    return box;
  }

  private asString(value?: string | BigInt | BigNumber | number): string {
    if (!value) {
      return "";
    } else if (typeof value == "string") {
      return value;
    } else {
      return value.toString();
    }
  }
}

export const utxosDbService = new UTxOsDbService();
