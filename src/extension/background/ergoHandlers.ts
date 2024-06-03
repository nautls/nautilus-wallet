import { groupBy } from "lodash-es";
import { BigNumber } from "bignumber.js";
import { Box, isDefined, some } from "@fleet-sdk/common";
import type { AssetBalance, SelectionTarget } from "@nautilus-js/eip12-types";
import { BoxSelector, ErgoUnsignedInput } from "@fleet-sdk/core";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState } from "@/types/internal";
import { sumBigNumberBy } from "@/common/bigNumbers";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";

export type AddressType = "used" | "unused" | "change";

export async function checkConnection(origin: string) {
  const connection = await connectedDAppsDbService.getByOrigin(origin);
  return isDefined(connection) && isDefined(connection?.walletId);
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

export async function getBalance(walletId: number, tokenId: string) {
  if (tokenId !== "all") {
    const assets = await assetsDbService.getByTokenId(walletId, tokenId);
    return some(assets)
      ? assets
          .map((a) => BigNumber(a.confirmedAmount))
          .reduce((acc, val) => acc.plus(val))
          .toString()
      : "0";
  }

  const assets = await assetsDbService.getByWalletId(walletId);
  const balances: AssetBalance[] = [];
  const groups = groupBy(assets, (x) => x.tokenId);
  for (const tokenId in groups) {
    balances.push({
      tokenId: tokenId === ERG_TOKEN_ID ? "ERG" : tokenId,
      balance: sumBigNumberBy(groups[tokenId], (x) => BigNumber(x.confirmedAmount)).toString()
    });
  }

  return balances;
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

export async function getCurrentHeight() {
  return graphQLService.getCurrentHeight();
}
