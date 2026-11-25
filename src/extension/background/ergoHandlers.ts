import { Box, isDefined } from "@fleet-sdk/common";
import { BoxSelector, ErgoUnsignedInput } from "@fleet-sdk/core";
import type { AssetBalance, SelectionTarget } from "@nautilus-js/eip12-types";
import { fetchBoxes, readHoldersFirst } from "@/chains/ergo/boxFetcher";
import { getBalances } from "@/chains/ergo/services/hergmesService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { addressesDbService } from "@/database/addressesDbService";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { AddressState } from "@/types/internal";
import type { AddressType } from "../connector/rpc/protocol";

export async function checkConnection(origin: string) {
  const connection = await connectedDAppsDbService.getByOrigin(origin);
  return isDefined(connection) && isDefined(connection.walletId);
}

export async function getUTxOs(walletId: number, target?: SelectionTarget): Promise<Box<string>[]> {
  const boxes = await fetchBoxes(walletId);
  const selector = new BoxSelector(boxes.map((box) => new ErgoUnsignedInput(box))).orderBy(
    (box) => box.creationHeight
  );
  const selectionTarget = {
    nanoErgs: target?.nanoErgs ? BigInt(target.nanoErgs) : undefined,
    tokens:
      target?.tokens?.map((x) => ({
        tokenId: x.tokenId,
        amount: x.amount ? BigInt(x.amount) : undefined
      })) || []
  };

  let selection!: ErgoUnsignedInput[];
  try {
    selection = selector.select(selectionTarget);
  } catch {
    selection = [];
  }

  return selection.map((box) => ({
    ...box.toPlainObject("EIP-12"),
    confirmed: boxes.find((x) => x.boxId === box.boxId)?.confirmed || false
  }));
}

export async function getBalance(
  walletId: number,
  tokenId: string
): Promise<AssetBalance[] | string> {
  const { nanoErgs, tokens } = await readHoldersFirst(
    walletId,
    getBalances,
    (balances) => balances.nanoErgs === 0n && balances.tokens.size === 0
  );

  if (tokenId === "all") {
    return [
      { tokenId: "ERG", balance: nanoErgs.toString() },
      ...[...tokens].map(([tokenId, amount]) => ({ tokenId, balance: amount.toString() }))
    ];
  } else if (tokenId === ERG_TOKEN_ID) {
    return nanoErgs.toString();
  } else {
    return (tokens.get(tokenId) ?? 0n).toString();
  }
}

export async function getAddresses(walletId: number, filter: AddressType) {
  if (filter === "change") {
    const address = await addressesDbService.getChangeAddress(walletId);
    return address?.script;
  }

  const state = filter === "used" ? AddressState.Used : AddressState.Unused;
  const addresses = await addressesDbService.getByState(walletId, state);
  return addresses.map((x) => x.script);
}
