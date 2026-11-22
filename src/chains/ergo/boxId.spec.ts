import {
  EIP12UnsignedDataInput,
  EIP12UnsignedInput,
  EIP12UnsignedTransaction
} from "@fleet-sdk/common";
import { describe, expect, it } from "vitest";
import { computeBoxId, hasValidBoxIds } from "./boxId";

const P2PK = "0008cd03a621f820dbed198b42a2dca799a571911f2dabbd2e4d441c9aad558da63f084d";

function box(n: number) {
  const b = {
    boxId: "",
    transactionId: n.toString().repeat(64),
    index: 0,
    value: "1000000000",
    ergoTree: P2PK,
    creationHeight: 1_000_000,
    assets: [{ tokenId: "f".repeat(64), amount: "10" }],
    additionalRegisters: { R4: "0e0101" }
  };
  return { ...b, boxId: computeBoxId(b), extension: {} };
}

function tx(
  inputs: EIP12UnsignedInput[] = [box(1)],
  dataInputs: EIP12UnsignedDataInput[] = [box(2)]
): EIP12UnsignedTransaction {
  return { inputs, dataInputs, outputs: [] };
}

describe("hasValidBoxIds", () => {
  it("accepts boxes that match their ids", () => {
    expect(hasValidBoxIds(tx())).toBe(true);
  });

  it.each([
    ["ergoTree", { ergoTree: P2PK.replace("03a6", "02a6") }],
    ["value", { value: "1" }],
    ["assets", { assets: [] }],
    ["registers", { additionalRegisters: {} }],
    ["transaction id", { transactionId: "9".repeat(64) }],
    ["index", { index: 1 }]
  ])("rejects inputs with a forged %s", (_, change) => {
    expect(hasValidBoxIds(tx([{ ...box(1), ...change }]))).toBe(false);
  });

  it("rejects forged data inputs", () => {
    expect(hasValidBoxIds(tx([box(1)], [{ ...box(2), value: "1" }]))).toBe(false);
  });

  it("rejects boxes that can't be serialized", () => {
    expect(hasValidBoxIds(tx([{ ...box(1), ergoTree: "zz" }]))).toBe(false);
  });
});
