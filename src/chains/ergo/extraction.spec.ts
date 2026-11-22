import { hex } from "@fleet-sdk/crypto";
import { ErgoHDKey } from "@fleet-sdk/wallet";
import { describe, expect, it } from "vitest";
import { extractPksFromP2SErgoTree, extractPksFromRegisters } from "./extraction";

const MNEMONIC =
  "decline usual reward fine flight vintage deny slight minimum spirit hero aerobic loan peanut feel";

async function pks() {
  const root = await ErgoHDKey.fromMnemonic(MNEMONIC);
  return [0, 1].map((i) => hex.encode(root.deriveChild(i).publicKey));
}

describe("extractPksFromP2SErgoTree", () => {
  it.each([
    ["v0", "10"],
    ["v3", "1b26"]
  ])("extracts public keys from %s trees", async (_, header) => {
    const [pk] = await pks();
    // header (+ size) + one SigmaProp constant + ConstantPlaceholder(0)
    expect(extractPksFromP2SErgoTree(`${header}0108cd${pk}7300`)).toEqual([pk]);
  });

  it("extracts public keys nested in collections", async () => {
    const [pk1, pk2] = await pks();
    expect(extractPksFromP2SErgoTree(`1b49011402cd${pk1}cd${pk2}7300`)).toEqual([pk1, pk2]);
  });

  it("returns no keys for unparseable trees", () => {
    expect(extractPksFromP2SErgoTree("1bff")).toEqual([]);
  });
});

describe("extractPksFromRegisters", () => {
  it("extracts public keys from SigmaProp and GroupElement registers", async () => {
    const [pk1, pk2] = await pks();
    expect(extractPksFromRegisters({ R4: `08cd${pk1}`, R5: `07${pk2}` })).toEqual([pk1, pk2]);
  });

  it("extracts every public key from collections and tuples", async () => {
    const [pk1, pk2] = await pks();
    const registers = {
      R4: `1402cd${pk1}cd${pk2}`, // Coll[SigmaProp]
      R5: `4405cd${pk2}00` // (SigmaProp, Long)
    };

    expect(extractPksFromRegisters(registers)).toEqual([pk1, pk2, pk2]);
  });

  it("extracts public keys from P2PK scripts stored as Coll[Byte]", async () => {
    const [pk1, pk2] = await pks();
    const registers = {
      R4: `0e240008cd${pk1}`, // Coll[Byte]
      R5: `1a01240008cd${pk2}` // Coll[Coll[Byte]]
    };

    expect(extractPksFromRegisters(registers)).toEqual([pk1, pk2]);
  });

  it("ignores key-like bytes in other types and unparseable registers", async () => {
    const [pk] = await pks();
    expect(extractPksFromRegisters({ R4: `0e2308cd${pk}`, R5: "ff" })).toEqual([]);
  });
});
