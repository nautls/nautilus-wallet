import { EIP12UnsignedInput, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { ErgoTree } from "@fleet-sdk/core";
import { blake2b256, hex } from "@fleet-sdk/crypto";
import { serializeTransaction } from "@fleet-sdk/serializer";
import { ErgoHDKey, generateProof } from "@fleet-sdk/wallet";
import { P2PK_TREE_PREFIX } from "@/constants/ergo";
import { computeBoxId, hasValidBoxIds } from "../boxId";

const MIN_UNSUPPORTED_ERGOTREE_VERSION = 3;
const PK_HEX_LENGTH = 66;
const CONSTANT_PLACEHOLDER_0 = "7300";

// Temporary until sigma-rust supports ErgoTree v3.

/** ergo-lib-wasm can't parse ErgoTree v3 or later. */
export function isV3ErgoTree(ergoTree: string): boolean {
  return new ErgoTree(ergoTree).version >= MIN_UNSUPPORTED_ERGOTREE_VERSION;
}

export function hasV3ErgoTree(tx: EIP12UnsignedTransaction): boolean {
  return [...tx.inputs, ...tx.dataInputs, ...tx.outputs].some((box) => isV3ErgoTree(box.ergoTree));
}

/**
 * Returns the public key when the whole script is a single `proveDlog`, the only case where a
 * proof can be chosen without reducing it. Keys found elsewhere may be plain data, e.g. a
 * recipient stored in a register.
 */
export function proveDlogKeyOf(ergoTree: string): string | undefined {
  if (ergoTree.startsWith(P2PK_TREE_PREFIX)) {
    const pk = ergoTree.slice(P2PK_TREE_PREFIX.length);
    return pk.length === PK_HEX_LENGTH ? pk : undefined;
  }

  try {
    const tree = new ErgoTree(ergoTree);
    const constants = tree.constants;
    if (constants.length !== 1 || hex.encode(tree.template) !== CONSTANT_PLACEHOLDER_0) return;

    const { type, data } = constants[0];
    if (type.toString() !== "SSigmaProp" || !(data instanceof Uint8Array)) return;

    const pk = hex.encode(data);
    return pk.length === PK_HEX_LENGTH ? pk : undefined;
  } catch {
    return;
  }
}

/**
 * Signs without reducing input scripts: each input gets a Schnorr proof from the key returned by
 * `keyFor`, or an empty proof when it returns nothing. Validity is unknown until the transaction
 * is checked by a node.
 */
export function signWithoutReduction(
  tx: EIP12UnsignedTransaction,
  keyFor: (input: EIP12UnsignedInput, index: number) => ErgoHDKey | undefined
): SignedTransaction {
  if (!hasValidBoxIds(tx)) throw new Error("Box contents don't match their ids.");

  const bytes = serializeTransaction(tx).toBytes();
  const id = hex.encode(blake2b256(bytes));

  return {
    id,
    inputs: tx.inputs.map((input, index) => {
      const key = keyFor(input, index);
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
      box.boxId = computeBoxId(box);
      return box;
    })
  };
}
