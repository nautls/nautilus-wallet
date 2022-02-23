import { ExplorerUnspentBox } from "@/types/explorer";
import { addressesDbService } from "../database/addressesDbService";
import { pendingBoxesDbService } from "../database/pendingBoxesDbService";
import { explorerService } from "../explorer/explorerService";

export async function boxFetcher(walletId: number): Promise<ExplorerUnspentBox[]> {
  const addresses = (await addressesDbService.getByWalletId(walletId)).map((a) => a.script);
  const boxes = await explorerService.getUnspentBoxes(addresses);
  const pendingBoxes = await pendingBoxesDbService.getByWalletId(walletId);
  return boxes.map((a) => a.data).flat();
}
