import { EIP12UnsignedTransaction } from "@fleet-sdk/common";
import { ErgoAddress } from "@fleet-sdk/core";
import { ErgoHDKey, Prover } from "@fleet-sdk/wallet";
import { describe, expect, it } from "vitest";
import { hex } from "@fleet-sdk/crypto";
import { hasV3ErgoTree, proveDlogKeyOf, signWithoutReduction } from "./blindSigning";

const MNEMONIC =
  "decline usual reward fine flight vintage deny slight minimum spirit hero aerobic loan peanut feel";
const V3_TREE = "1b0400d801d601b2a5730000ea02d1937201";

async function buildTx() {
  const root = await ErgoHDKey.fromMnemonic(MNEMONIC);
  const key = root.derive("m/44'/429'/0'/0/0");
  const p2pk = ErgoAddress.fromPublicKey(key.publicKey).ergoTree;

  const box = (boxId: string, ergoTree: string) => ({
    boxId,
    transactionId: "e".repeat(64),
    index: 0,
    value: "1000000000",
    ergoTree,
    creationHeight: 1_000_000,
    assets: [],
    additionalRegisters: {},
    extension: {}
  });

  const tx: EIP12UnsignedTransaction = {
    inputs: [box("a".repeat(64), p2pk), box("b".repeat(64), V3_TREE)],
    dataInputs: [],
    outputs: [
      {
        value: "1999000000",
        ergoTree: p2pk,
        creationHeight: 1_000_001,
        assets: [],
        additionalRegisters: {}
      }
    ]
  };

  return { key, p2pk, tx };
}

describe("hasV3ErgoTree", () => {
  it("detects v3 trees in inputs, data inputs and outputs", async () => {
    const { tx } = await buildTx();
    const [p2pkInput, v3Input] = tx.inputs;
    const output = tx.outputs[0];

    expect(hasV3ErgoTree({ ...tx, inputs: [p2pkInput] })).toBe(false);
    expect(hasV3ErgoTree({ ...tx, inputs: [p2pkInput, v3Input] })).toBe(true);
    expect(hasV3ErgoTree({ ...tx, inputs: [p2pkInput], dataInputs: [v3Input] })).toBe(true);
    expect(
      hasV3ErgoTree({
        ...tx,
        inputs: [p2pkInput],
        outputs: [output, { ...output, ergoTree: V3_TREE }]
      })
    ).toBe(true);
  });
});

describe("proveDlogKeyOf", () => {
  it("returns the key of P2PK and single proveDlog scripts", async () => {
    const { key, p2pk } = await buildTx();
    const pk = hex.encode(key.publicKey);

    expect(proveDlogKeyOf(p2pk)).toBe(pk);
    expect(proveDlogKeyOf(`1b260108cd${pk}7300`)).toBe(pk);
  });

  it("returns nothing for scripts that do more than prove a single key", async () => {
    const { key } = await buildTx();
    const pk = hex.encode(key.publicKey);

    expect(proveDlogKeyOf(`1b2a0108cd${pk}ea0273007300`)).toBeUndefined(); // key && key
    expect(proveDlogKeyOf(`1b2802040008cd${pk}7301`)).toBeUndefined(); // two constants
    expect(proveDlogKeyOf(V3_TREE)).toBeUndefined();
    expect(proveDlogKeyOf("1bff")).toBeUndefined();
  });
});

describe("signWithoutReduction", () => {
  it("signs owned inputs and leaves others with an empty proof", async () => {
    const { key, p2pk, tx } = await buildTx();
    const signed = signWithoutReduction(tx, (input) => (input.ergoTree === p2pk ? key : undefined));

    const [owned, contract] = signed.inputs;
    expect(new Prover().verify(signed, owned.spendingProof?.proofBytes ?? "", key)).toBe(true);
    expect(contract.spendingProof?.proofBytes).toBe("");
  });

  it("produces the same id and outputs as Fleet's prover", async () => {
    const { key, tx } = await buildTx();
    const signed = signWithoutReduction(tx, () => key);
    const reference = new Prover().signTransaction(tx, [key]);

    expect(signed.id).toBe(reference.id);
    expect(signed.outputs).toEqual(reference.outputs);
  });
});
