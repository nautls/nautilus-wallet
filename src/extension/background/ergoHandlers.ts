import { groupBy } from "lodash-es";
import { Box, isDefined, some, utxoSum } from "@fleet-sdk/common";
import type { AssetBalance, SelectionTarget } from "@nautilus-js/eip12-types";
import { BoxSelector, ErgoUnsignedInput } from "@fleet-sdk/core";
import { getSettings } from "./settings";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState } from "@/types/internal";
import { bn, sumBy } from "@/common/bigNumber";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";

export type AddressType = "used" | "unused" | "change";

export async function checkConnection(origin: string) {
  const connection = await connectedDAppsDbService.getByOrigin(origin);
  return isDefined(connection) && isDefined(connection.walletId);
}

export async function getUTxOs(walletId: number, target?: SelectionTarget): Promise<Box<string>[]> {
  const settings = await getSettings();
  const boxes = await fetchBoxes(walletId, settings.zeroConf);
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
  const settings = await getSettings();
  return settings.zeroConf
    ? getRemoteBalance(walletId, tokenId)
    : getLocalBalance(walletId, tokenId);
}

export async function getLocalBalance(
  walletId: number,
  tokenId: string
): Promise<AssetBalance[] | string> {
  if (tokenId !== "all") {
    const assets = await assetsDbService.getByTokenId(walletId, tokenId);
    return some(assets)
      ? assets
          .map((a) => bn(a.confirmedAmount))
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
      balance: sumBy(groups[tokenId], (x) => bn(x.confirmedAmount)).toString()
    });
  }

  return balances;
}

async function getRemoteBalance(
  walletId: number,
  tokenId: string
): Promise<AssetBalance[] | string> {
  const addresses = await addressesDbService
    .getByWalletId(walletId)
    .then((addresses) => addresses.map((x) => x.script));

  const utxos = await graphQLService.getBoxes({
    where: {
      addresses,
      tokenId: tokenId === "all" || tokenId === ERG_TOKEN_ID ? undefined : tokenId
    },
    from: "blockchain+mempool"
  });
  const summary = utxoSum(utxos);

  if (tokenId === "all") {
    return [
      { tokenId: "ERG", balance: summary.nanoErgs.toString() },
      ...summary.tokens.map((x) => ({ tokenId: x.tokenId, balance: x.amount.toString() }))
    ];
  } else if (tokenId === ERG_TOKEN_ID) {
    return summary.nanoErgs.toString();
  } else {
    return summary.tokens.find((x) => x.tokenId === tokenId)?.amount.toString() || "0";
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

export async function getCurrentHeight() {
  return graphQLService.getHeight();
}
