import { P2PK_TREE_PREFIX, NETWORK } from "@/constants/ergo";
import { ErgoBoxCandidate, UnsignedInput } from "@/types/connector";
import { ErgoAddress, Network } from "@fleet-sdk/core";
import { isEmpty, last, uniq } from "lodash-es";
import { extractPksFromP2SErgoTree, extractPksFromRegisters } from "./sigmaSerializer";

export function extractAddressesFromInputs(inputs: UnsignedInput[]) {
  return inputs.map((input) => extractAddressesFromInput(input)).flat();
}

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

function extractAddressesFromInput(input: UnsignedInput): string[] {
  if (input.ergoTree.startsWith(P2PK_TREE_PREFIX)) {
    return [addressFromErgoTree(input.ergoTree)];
  }

  let pks = extractPksFromP2SErgoTree(input.ergoTree);
  if (input.additionalRegisters) {
    pks = pks.concat(extractPksFromRegisters(input.additionalRegisters));
  }

  if (isEmpty(pks)) {
    return [];
  }

  const addresses: string[] = [];
  for (const pk of uniq(pks)) {
    addresses.push(addressFromPk(pk));
  }

  return addresses;
}
