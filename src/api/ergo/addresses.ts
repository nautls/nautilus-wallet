import { P2PK_TREE_PREFIX, MAINNET } from "@/constants/ergo";
import { ErgoBoxCandidate, UnsignedInput } from "@/types/connector";
import { Address, Network } from "@coinbarn/ergo-ts";
import { isEmpty, last, uniq } from "lodash";
import { extractPksFromP2SErgoTree, extractPksFromRegisters } from "./sigmaSerializer";

const network = MAINNET ? Network.Mainnet : Network.Testnet;

export function extractAddressesFromInputs(inputs: UnsignedInput[]) {
  return inputs.map((input) => extractAddressesFromInput(input)).flat();
}

export function getChangeAddress(
  outputs: ErgoBoxCandidate[],
  ownAddresses: string[]
): string | undefined {
  const addresses = outputs
    .filter((o) => o.ergoTree.startsWith(P2PK_TREE_PREFIX))
    .map((o) => addressFromPk(o.ergoTree))
    .filter((a) => ownAddresses.includes(a));

  return last(addresses);
}

export function addressFromPk(pk: string) {
  return Address.fromPk(pk, network).address;
}

export function addressFromErgoTree(ergoTree: string) {
  return Address.fromErgoTree(ergoTree, network).address;
}

export function addressFromSk(sk: string) {
  return Address.fromSk(sk, network).address;
}

export function validateAddress(address: string) {
  const addr = new Address(address);
  return addr.isValid() && addr.getNetwork() === network;
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
