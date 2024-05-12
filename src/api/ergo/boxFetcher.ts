import { ERG_TOKEN_ID } from "@/constants/ergo";
import { ErgoBox } from "@/types/connector";
import { difference, find, isEmpty, sortBy, unionBy } from "lodash-es";
import { addressesDbService } from "../database/addressesDbService";
import { assetsDbService } from "../database/assetsDbService";
import { utxosDbService } from "../database/utxosDbService";
import { graphQLService } from "../explorer/graphQlService";

export async function fetchBoxes(
  walletId: number,
  options: { tokenId?: string; useAllAddressesAsFallback: boolean; includeUnconfirmed: boolean } = {
    tokenId: ERG_TOKEN_ID,
    useAllAddressesAsFallback: true,
    includeUnconfirmed: true
  }
): Promise<ErgoBox[]> {
  const addresses = await assetsDbService.getAddressesByTokenId(
    walletId,
    options.tokenId ?? ERG_TOKEN_ID
  );
  const pendingBoxes = options.includeUnconfirmed
    ? await utxosDbService.getByWalletId(walletId)
    : [];

  let boxes = await fetchBoxesFromExplorer(addresses);

  if (
    options.useAllAddressesAsFallback &&
    isEmpty(boxes) &&
    !find(pendingBoxes, (b) => !b.locked && b.content)
  ) {
    boxes = await fetchBoxesFromExplorer(difference(await getAllAddresses(walletId), addresses));
  }
  if (!isEmpty(pendingBoxes)) {
    const lockedIds = pendingBoxes.filter((x) => x.locked).map((x) => x.id);
    const unconfirmed = pendingBoxes.filter((b) => !b.locked && b.content).map((b) => b.content!);

    if (!isEmpty(lockedIds)) {
      boxes = boxes.filter((b) => !lockedIds.includes(b.boxId));
    }
    if (!isEmpty(unconfirmed)) {
      boxes = unionBy(boxes, unconfirmed, (b) => b.boxId);
    }
  }

  return sortBy(boxes, (x) => x.creationHeight).reverse();
}

async function fetchBoxesFromExplorer(addresses: string[]): Promise<ErgoBox[]> {
  if (isEmpty(addresses)) {
    return [];
  }

  const boxes = await graphQLService.getUnspentBoxes(addresses);
  return boxes;
}

async function getAllAddresses(walletId: number): Promise<string[]> {
  const addresses = await addressesDbService.getByWalletId(walletId);
  return addresses.map((a) => a.script);
}
