import { Box, isEmpty, uniq } from "@fleet-sdk/common";
import { ErgoTree } from "@fleet-sdk/core";
import { hex } from "@fleet-sdk/crypto";
import { isColl, isTuple, SCollType, STupleType, SType } from "@fleet-sdk/serializer";
import { P2PK_TREE_PREFIX } from "@/constants/ergo";
import { Registers } from "@/types/connector";
import { addressFromErgoTree, addressFromPk } from "./addresses";
import { safeSigmaDecode } from "./serialization";

const PK_BYTE_LENGTH = 33;
const P2PK_TREE_BYTE_LENGTH = P2PK_TREE_PREFIX.length / 2 + PK_BYTE_LENGTH;

export function extractPksFromRegisters(registers: Registers): string[] {
  const pks: string[] = [];
  for (const register of Object.values(registers)) {
    const constant = safeSigmaDecode(register);
    if (constant) collectPks(constant.type, constant.data, pks);
  }

  return pks;
}

export function extractPksFromP2SErgoTree(ergoTree: string): string[] {
  let constants;
  try {
    constants = new ErgoTree(ergoTree).constants;
  } catch {
    return [];
  }

  const pks: string[] = [];
  for (const { type, data } of constants) collectPks(type, data, pks);

  return pks;
}

function collectPks(type: SType, data: unknown, pks: string[]) {
  const name = type.toString();
  if (name === "SSigmaProp" || name === "SGroupElement") {
    if (data instanceof Uint8Array && data.length === PK_BYTE_LENGTH) pks.push(hex.encode(data));
  } else if (name === "SColl[SByte]") {
    if (!(data instanceof Uint8Array) || data.length !== P2PK_TREE_BYTE_LENGTH) return;
    const tree = hex.encode(data);
    if (tree.startsWith(P2PK_TREE_PREFIX)) pks.push(tree.slice(P2PK_TREE_PREFIX.length));
  } else if (isColl(type) && Array.isArray(data)) {
    for (const item of data) collectPks((type as SCollType).elementsType, item, pks);
  } else if (isTuple(type) && Array.isArray(data)) {
    const types = (type as STupleType).elementsType;
    data.forEach((item, i) => collectPks(types[i], item, pks));
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
