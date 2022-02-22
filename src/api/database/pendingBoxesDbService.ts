import { IDbPendingBox } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { ErgoTx } from "@/types/connector";
import { addressesDbService } from "./addressesDbService";
import { addressFromErgoTree } from "../ergo/addresses";
import BigNumber from "bignumber.js";
import { stringify } from "crypto-js/enc-utf8";

class PendingBoxesDbService {
  public async getByBoxId(boxId: string): Promise<IDbPendingBox | undefined> {
    return await dbContext.pendingBoxes.where({ boxId }).first();
  }

  public async getByTxId(txId: string): Promise<IDbPendingBox[]> {
    return await dbContext.pendingBoxes.where({ transactionId: txId }).toArray();
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
              boxContent: output,
              transactionId: signedTx.id,
              address: addressFromErgoTree(output.ergoTree),
              walletId
            };
          })
      );

    for (const box of boxes) {
      if (!box.boxContent) {
        return;
      }
      box.boxContent.value = this.asString(box.boxContent.value);
      for (const token of box.boxContent.assets) {
        token.amount = this.asString(token.amount);
      }
    }

    await dbContext.pendingBoxes.bulkPut(boxes);
  }

  asString(value?: string | BigInt | BigNumber | number): string {
    if (!value) {
      return "";
    } else if (typeof value == "string") {
      return value;
    } else {
      return value.toString();
    }
  }

  public async getAll(): Promise<IDbPendingBox[]> {
    return await dbContext.pendingBoxes.toArray();
  }
}

export const pendingBoxesDbService = new PendingBoxesDbService();
