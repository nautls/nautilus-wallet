import { ErgoTx } from "@/types/connector";
import { explorerBoxMapper } from "@/types/explorer";
import { unionBy } from "lodash";
import { pendingBoxesDbService } from "../database/pendingBoxesDbService";
import { explorerService } from "../explorer/explorerService";

export async function submitTx(signedTx: ErgoTx, walletId: number): Promise<string> {
  const dbBoxes = (await pendingBoxesDbService.getByWalletId(walletId))
    .filter((i) => i.content)
    .map((i) => i.content!);
  const dbBoxIds = dbBoxes.map((i) => i.boxId);

  const [txResponse, explorerBoxes] = await Promise.all([
    explorerService.sendTx(signedTx),
    explorerService.getBoxes(
      signedTx.inputs.filter((i) => !dbBoxIds.includes(i.boxId)).map((i) => i.boxId)
    )
  ]);

  await pendingBoxesDbService.addFromTx(
    signedTx,
    unionBy(explorerBoxes.map(explorerBoxMapper({ asConfirmed: true })), dbBoxes, (b) => b.boxId),
    walletId
  );
  return txResponse.id;
}
