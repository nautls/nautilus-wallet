import { IDbUtxo } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { ErgoBox, ErgoTx } from "@/types/connector";
import { addressesDbService } from "./addressesDbService";
import { addressFromErgoTree } from "../ergo/addresses";
import BigNumber from "bignumber.js";
import { find } from "lodash";

class PendingBoxesDbService {
  public async getByBoxId(boxId: string): Promise<IDbUtxo | undefined> {
    return await dbContext.utxos.where({ boxId }).first();
  }

  public async getByTxId(txId: string): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where({ transactionId: txId }).toArray();
  }

  public async getByWalletId(walletId: number): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where({ walletId }).toArray();
  }

  public async addFromTx(signedTx: ErgoTx, walletId: number) {
    const addresses = (await addressesDbService.getByWalletId(walletId)).map((a) => a.script);

    const boxes = signedTx.inputs
      .map((input) => {
        return {
          id: input.boxId,
          confirmed: true,
          spent: true,
          transactionId: signedTx.id,
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
              spent: false,
              content: { ...this.stringifyAmounts(output), confirmed: false },
              transactionId: signedTx.id,
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

export const pendingBoxesDbService = new PendingBoxesDbService();
