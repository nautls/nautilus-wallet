import { SignedTransaction } from "@ergo-graphql/types";
import { addressesDbService } from "./addressesDbService";
import { addressFromErgoTree } from "@/chains/ergo/addresses";
import { IDbUtxo } from "@/types/database";
import { dbContext } from "@/database/dbContext";

class UTxOsDbService {
  async getAllPending(): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where("spentTxId").notEqual("").toArray();
  }

  async containsAtLeastOneOf(ids: string[]): Promise<boolean> {
    const result = await dbContext.utxos.where("id").anyOf(ids).first();
    return !!result;
  }

  async getByTxId(txId: string): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where({ spentTxId: txId }).toArray();
  }

  async getByWalletId(walletId: number): Promise<IDbUtxo[]> {
    return await dbContext.utxos.where({ walletId }).toArray();
  }

  async removeByTxIds(txIds: string[]): Promise<void> {
    await dbContext.utxos.where("spentTxId").anyOf(txIds).delete();
  }

  async addFromTx(signedTx: SignedTransaction, walletId: number) {
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
