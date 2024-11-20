import { difference, sortBy, unionBy } from "lodash-es";
import { ChainProviderBox } from "@fleet-sdk/blockchain-providers";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { utxosDbService } from "@/database/utxosDbService";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { ERG_TOKEN_ID } from "@/constants/ergo";

export async function fetchBoxes(
  walletId: number,
  includeUnconf = true
): Promise<ChainProviderBox<string>[]> {
  let addresses = await assetsDbService.getAddressesByTokenId(walletId, ERG_TOKEN_ID);
  if (!addresses.length) addresses = await getAllAddresses(walletId);
  const localUnconfirmedBoxes = await utxosDbService.getByWalletId(walletId);

  let boxes = await graphQLService.getBoxes({
    where: { addresses },
    from: includeUnconf ? "blockchain+mempool" : "blockchain"
  });

  if (boxes.length === 0 && !localUnconfirmedBoxes.find((b) => !b.locked && b.content)) {
    boxes = await graphQLService.getBoxes({
      where: { addresses: difference(await getAllAddresses(walletId), addresses) },
      from: includeUnconf ? "blockchain+mempool" : "blockchain"
    });
  }

  if (localUnconfirmedBoxes.length > 0) {
    const lockedIds = localUnconfirmedBoxes.filter((x) => x.locked).map((x) => x.id);
    const unconfirmed = localUnconfirmedBoxes
      .filter((b) => !b.locked && b.content)
      .map((b) => b.content!);

    if (lockedIds.length > 0) boxes = boxes.filter((b) => !lockedIds.includes(b.boxId));
    if (unconfirmed.length > 0) boxes = unionBy(boxes, unconfirmed, (b) => b.boxId);
  }

  return sortBy(boxes, (x) => x.creationHeight).reverse();
}

async function getAllAddresses(walletId: number): Promise<string[]> {
  const addresses = await addressesDbService.getByWalletId(walletId);
  return addresses.map((a) => a.script);
}
