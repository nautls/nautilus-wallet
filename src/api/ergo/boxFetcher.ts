import { ERG_TOKEN_ID } from "@/constants/ergo";
import { ErgoBox, Token } from "@/types/connector";
import { ExplorerUnspentBox } from "@/types/explorer";
import { difference, differenceBy, find, isEmpty, sortBy, unionBy } from "lodash";
import { addressesDbService } from "../database/addressesDbService";
import { assestsDbService } from "../database/assetsDbService";
import { pendingBoxesDbService } from "../database/pendingBoxesDbService";
import { explorerService } from "../explorer/explorerService";

export async function fetchBoxes(
  walletId: number,
  options: { tokenId?: string; useAllAddressesAsFallback: boolean; includeUnconfirmed: boolean } = {
    tokenId: ERG_TOKEN_ID,
    useAllAddressesAsFallback: true,
    includeUnconfirmed: true
  }
): Promise<ErgoBox[]> {
  const addresses = await assestsDbService.getAddressesByTokenId(
    walletId,
    options.tokenId ?? ERG_TOKEN_ID
  );
  const pendingBoxes = options.includeUnconfirmed
    ? await pendingBoxesDbService.getByWalletId(walletId)
    : [];
  let boxes = await getBoxes(addresses);

  if (
    options.useAllAddressesAsFallback &&
    isEmpty(boxes) &&
    !find(pendingBoxes, (p) => !p.locked)
  ) {
    boxes = await getBoxes(difference(await getAllAddresses(walletId), addresses));
  }

  if (!isEmpty(pendingBoxes)) {
    const lockedIds = pendingBoxes.filter((x) => x.locked).map((x) => x.boxId);
    const unconfirmed = pendingBoxes
      .filter((x) => !x.locked && x.boxContent)
      .map((x) => x.boxContent!);

    if (!isEmpty(lockedIds)) {
      console.log("locked", lockedIds);
      boxes = boxes.filter((b) => !lockedIds.includes(b.boxId));
    }

    if (!isEmpty(unconfirmed)) {
      console.log(
        "unconfirmed",
        unconfirmed.map((x) => x.boxId)
      );
      boxes = unionBy(boxes, unconfirmed, (b) => b.boxId);
    }
  }

  return sortBy(boxes, (x) => x.creationHeight).reverse();
}

function explorerBoxMapper(options: { asConfirmed: boolean }) {
  return (box: ExplorerUnspentBox) => {
    return {
      boxId: box.id,
      transactionId: box.txId,
      index: box.index,
      ergoTree: box.ergoTree,
      creationHeight: box.creationHeight,
      value: box.value.toString(),
      assets: box.assets.map((t) => {
        return {
          tokenId: t.tokenId,
          amount: t.amount.toString()
        } as Token;
      }),
      additionalRegisters: box.additionalRegisters,
      confirmed: options.asConfirmed
    } as ErgoBox;
  };
}

async function getBoxes(addresses: string[]): Promise<ErgoBox[]> {
  if (isEmpty(addresses)) {
    return [];
  }

  const boxes = await explorerService.getUnspentBoxes(addresses);
  return boxes
    .map((a) => a.data)
    .flat()
    .map(explorerBoxMapper({ asConfirmed: true }));
}

async function getAllAddresses(walletId: number): Promise<string[]> {
  const addresses = await addressesDbService.getByWalletId(walletId);
  return addresses.map((a) => a.script);
}
