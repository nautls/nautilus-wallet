import { IDbPendingBox } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { ErgoBox, ErgoTx } from "@/types/connector";
import { addressesDbService } from "./addressesDbService";
import { addressFromErgoTree } from "../ergo/addresses";
import BigNumber from "bignumber.js";
import { isEmpty } from "lodash";

class PendingBoxesDbService {
  public async getByBoxId(boxId: string): Promise<IDbPendingBox | undefined> {
    return await dbContext.pendingBoxes.where({ boxId }).first();
  }

  public async getByTxId(txId: string): Promise<IDbPendingBox[]> {
    return await dbContext.pendingBoxes.where({ transactionId: txId }).toArray();
  }

  public async getByWalletId(walletId: number): Promise<IDbPendingBox[]> {
    return await dbContext.pendingBoxes.where({ walletId }).toArray();
  }

  public async addFromTx(signedTx: ErgoTx, walletId: number) {
    const addresses = (await addressesDbService.getByWalletId(walletId)).map((a) => a.script);
    const boxes: IDbPendingBox[] = signedTx.inputs
      .map((input) => {
        return {
          boxId: input.boxId,
          confirmed: true,
          locked: true,
          transactionId: signedTx.id,
          walletId
        };
      })
      .concat(
        signedTx.outputs
          .filter((output) => addresses.includes(addressFromErgoTree(output.ergoTree)))
          .map((output) => {
            return {
              boxId: output.boxId,
              confirmed: false,
              locked: false,
              boxContent: { ...this.stringifyAmounts(output), confirmed: false },
              transactionId: signedTx.id,
              address: addressFromErgoTree(output.ergoTree),
              walletId
            };
          })
      );

    await dbContext.pendingBoxes.bulkPut(boxes);
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
