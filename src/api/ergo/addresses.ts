import { P2PK_TREE_PREFIX } from "@/constants/ergo";
import { UnsignedInput } from "@/types/connector";
import { Address } from "@coinbarn/ergo-ts";
import { isEmpty, uniq } from "lodash";
import { extractPksFromP2SErgoTree, extractPksFromRegisters } from "./sigmaSerializer";

export function extractAddressesFromInputs(inputs: UnsignedInput[]) {
  return inputs.map((input) => extractAddressesFromInput(input)).flat();
}

export function addressFromPk(pk: string) {
  return Address.fromPk(pk).address;
}

export function addressFromErgoTree(ergoTree: string) {
  return Address.fromErgoTree(ergoTree).address;
}

export function addressFromSk(sk: string) {
  return Address.fromSk(sk).address;
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
