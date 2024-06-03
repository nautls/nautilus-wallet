import { ErgoTree } from "ergo-lib-wasm-browser";
import { Box, isEmpty, uniq } from "@fleet-sdk/common";
import { addressFromErgoTree, addressFromPk } from "./addresses";
import { Registers } from "@/types/connector";
import { P2PK_TREE_PREFIX, PK_HEX_LENGTH, SIGMA_CONSTANT_PK_MATCHER } from "@/constants/ergo";

export function extractPksFromRegisters(registers: Registers): string[] {
  const pks: string[] = [];
  for (const register of Object.values(registers)) {
    const pk = extractPkFromSigmaConstant(register);
    if (pk) pks.push(pk);
  }

  return pks;
}

export function extractPksFromP2SErgoTree(ergoTree: string): string[] {
  const pks: string[] = [];
  const tree = ErgoTree.from_base16_bytes(ergoTree);
  const len = tree.constants_len();
  for (let i = 0; i < len; i++) {
    const constant = tree.get_constant(i)?.encode_to_base16();
    const pk = extractPkFromSigmaConstant(constant);
    if (pk) pks.push(pk);
  }

  return pks;
}

export function extractPkFromSigmaConstant(constant?: string): string | undefined {
  if (!constant) return;

  const result = SIGMA_CONSTANT_PK_MATCHER.exec(constant);
  if (!result) return;

  for (let i = 0; i < result.length; i++) {
    if (result[i] && result[i].length === PK_HEX_LENGTH) {
      return result[i];
    }
  }
}

function extractAddressesFromInput(input: Box): string[] {
  if (input.ergoTree.startsWith(P2PK_TREE_PREFIX)) {
    return [addressFromErgoTree(input.ergoTree)];
  }

  let pks = extractPksFromP2SErgoTree(input.ergoTree);
  if (input.additionalRegisters) {
    pks = pks.concat(extractPksFromRegisters(input.additionalRegisters));
  }

  if (isEmpty(pks)) return [];

  const addresses: string[] = [];
  for (const pk of uniq(pks)) {
    addresses.push(addressFromPk(pk));
  }

  return addresses;
}

export function extractAddressesFromInputs(inputs: Box[]) {
  return inputs.map((input) => extractAddressesFromInput(input)).flat();
}
