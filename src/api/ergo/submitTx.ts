import { SignedTransaction } from "@ergo-graphql/types";
import { utxosDbService } from "../database/utxosDbService";
import { graphQLService } from "../explorer/graphQlService";

export async function submitTx(signedTx: SignedTransaction, walletId: number): Promise<string> {
  const txId = await graphQLService.sendTx(signedTx);
  await utxosDbService.addFromTx(signedTx, walletId);

  return txId;
}

export async function checkTx(signedTx: SignedTransaction): Promise<string> {
  const txId = await graphQLService.checkTx(signedTx);
  return txId;
}
