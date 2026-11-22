import { EIP12UnsignedInput, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { ErgoTree } from "@fleet-sdk/core";
import { blake2b256, hex } from "@fleet-sdk/crypto";
import { serializeBox, serializeTransaction } from "@fleet-sdk/serializer";
import { ErgoHDKey, generateProof } from "@fleet-sdk/wallet";

const MIN_UNSUPPORTED_ERGOTREE_VERSION = 3;

/** ergo-lib-wasm can't parse ErgoTree v3 or later. */
export function isV3ErgoTree(ergoTree: string): boolean {
  return new ErgoTree(ergoTree).version >= MIN_UNSUPPORTED_ERGOTREE_VERSION;
}

export function hasV3ErgoTree(tx: EIP12UnsignedTransaction): boolean {
  return [...tx.inputs, ...tx.dataInputs, ...tx.outputs].some((box) => isV3ErgoTree(box.ergoTree));
}

/**
 * Signs without reducing input scripts: each input gets a Schnorr proof from the key returned by
 * `keyFor`, or an empty proof when it returns nothing. Validity is unknown until the transaction
 * is checked by a node.
 */
export function signWithoutReduction(
  tx: EIP12UnsignedTransaction,
  keyFor: (input: EIP12UnsignedInput) => ErgoHDKey | undefined
): SignedTransaction {
  const bytes = serializeTransaction(tx).toBytes();
  const id = hex.encode(blake2b256(bytes));

  return {
    id,
    inputs: tx.inputs.map((input) => {
      const key = keyFor(input);
      return {
        boxId: input.boxId,
        spendingProof: {
          extension: input.extension,
          proofBytes: key ? hex.encode(generateProof(bytes, key)) : ""
        }
      };
    }),
    dataInputs: tx.dataInputs.map((x) => ({ boxId: x.boxId })),
    outputs: tx.outputs.map((output, index) => {
      const box = { ...output, boxId: "", transactionId: id, index };
      box.boxId = hex.encode(blake2b256(serializeBox(box).toBytes()));
      return box;
    })
  };
}
