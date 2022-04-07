import { ErgoTx } from "@/types/connector";
import { utxosDbService } from "../database/utxosDbService";
import { explorerService } from "../explorer/explorerService";

export async function submitTx(signedTx: ErgoTx, walletId: number): Promise<string> {
  const txResponse = await explorerService.sendTx(signedTx);

  await utxosDbService.addFromTx(signedTx, walletId);
  return txResponse.id;
}
