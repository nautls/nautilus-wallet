import { P2PK_TREE_PREFIX, NETWORK } from "@/constants/ergo";
import { ErgoBoxCandidate } from "@/types/connector";
import { ErgoAddress } from "@fleet-sdk/core";
import { last } from "lodash-es";

export function getChangeAddress(
  outputs: ErgoBoxCandidate[],
  ownAddresses: string[]
): string | undefined {
  const addresses = outputs
    .filter((o) => o.ergoTree.startsWith(P2PK_TREE_PREFIX))
    .map((o) => addressFromErgoTree(o.ergoTree))
    .filter((a) => ownAddresses.includes(a));

  return last(addresses);
}

export function addressFromPk(pk: string) {
  return ErgoAddress.fromPublicKey(pk, NETWORK).toString();
}

export function addressFromErgoTree(ergoTree: string) {
  return ErgoAddress.fromErgoTree(ergoTree, NETWORK).toString();
}

export function validateAddress(address: string) {
  return ErgoAddress.validate(address) && ErgoAddress.getNetworkType(address) === NETWORK;
}
