import {
  COLL_BYTE_PREFIX,
  MIN_COLL_LENGTH,
  P2PK_TREE_PREFIX,
  PK_HEX_LENGTH,
  SIGMA_CONSTANT_PK_MATCHER
} from "@/constants/ergo";
import { Registers, UnsignedInput } from "@/types/connector";
import { ErgoTree } from "ergo-lib-wasm-browser";
import { isEmpty, uniq } from "@fleet-sdk/common";
import { addressFromErgoTree, addressFromPk } from "./addresses";

export function isColl(input: string): boolean {
  return !isEmpty(input) && input.startsWith(COLL_BYTE_PREFIX) && input.length >= MIN_COLL_LENGTH;
}

export function decodeColl(input: string, encoding: BufferEncoding = "utf8"): string | undefined {
  if (!isColl(input)) {
    return;
  }

  return decodeConst(input, COLL_BYTE_PREFIX.length, encoding);
}

function decodeConst(
  input: string,
  position: number,
  encoding: BufferEncoding
): string | undefined {
  const [start, length] = getCollSpan(input, position);
  if (!length) {
    return;
  }

  return Buffer.from(input.slice(start, start + length), "hex").toString(encoding);
}

function getCollSpan(input: string, start: number): [start: number, length: number | undefined] {
  return decodeVlq(input, start);
}

function decodeVlq(input: string, position: number): [cursor: number, value: number | undefined] {
  let len = 0;
  let readNext = true;
  do {
    const lenChunk = parseInt(input.slice(position, (position += 2)), 16);
    if (isNaN(lenChunk)) {
      return [position, undefined];
    }

    readNext = (lenChunk & 0x80) !== 0;
    len = 128 * len + (lenChunk & 0x7f);
  } while (readNext);

  return [position, len * 2];
}

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
    if (pk) {
      pks.push(pk);
    }
  }

  return pks;
}

export function extractPkFromSigmaConstant(constant?: string): string | undefined {
  if (!constant) {
    return;
  }

  const result = SIGMA_CONSTANT_PK_MATCHER.exec(constant);
  if (!result) {
    return;
  }

  for (let i = 0; i < result.length; i++) {
    if (result[i] && result[i].length === PK_HEX_LENGTH) {
      return result[i];
    }
  }
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

export function extractAddressesFromInputs(inputs: UnsignedInput[]) {
  return inputs.map((input) => extractAddressesFromInput(input)).flat();
}
