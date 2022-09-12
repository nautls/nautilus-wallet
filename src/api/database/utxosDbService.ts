import { IDbUtxo } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";
import { addressesDbService } from "./addressesDbService";
import { addressFromErgoTree } from "../ergo/addresses";
import { isEmpty } from "lodash";
import { SignedTransaction } from "@ergo-graphql/types";

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

  public async addFromTx(signedTx: SignedTransaction, walletId: number) {
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
              content: { ...output, confirmed: false },
              spentTxId: signedTx.id,
              spentTimestamp: Date.now(),
              address: addressFromErgoTree(output.ergoTree),
              walletId
            } as IDbUtxo;
          })
      );

    await dbContext.utxos.bulkPut(boxes);
  }
}

export const utxosDbService = new UTxOsDbService();
