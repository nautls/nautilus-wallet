import { Box, EIP12UnsignedTransaction } from "@fleet-sdk/common";
import { blake2b256, hex } from "@fleet-sdk/crypto";
import { serializeBox } from "@fleet-sdk/serializer";

export function computeBoxId(box: Box<string>): string {
  return hex.encode(blake2b256(serializeBox(box).toBytes()));
}

/**
 * Proofs only commit to input ids, so a box whose contents don't hash to its id lets a dApp show
 * one box to the user and get a signature that spends another.
 */
export function hasValidBoxIds(tx: EIP12UnsignedTransaction): boolean {
  try {
    return [...tx.inputs, ...tx.dataInputs].every((box) => computeBoxId(box) === box.boxId);
  } catch {
    return false;
  }
}
