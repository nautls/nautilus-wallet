import { ErgoTx } from "@/types/connector";
import { pendingBoxesDbService } from "../database/pendingBoxesDbService";
import { explorerService } from "../explorer/explorerService";

export async function submitTx(signedTx: ErgoTx, walletId: number): Promise<string> {
  const txResponse = await explorerService.sendTx(signedTx);

  await pendingBoxesDbService.addFromTx(signedTx, walletId);
  return txResponse.id;
}
