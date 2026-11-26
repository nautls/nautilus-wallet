import { buildBabelContract } from "@fleet-sdk/babel-fees-plugin";
import type { Box } from "@fleet-sdk/common";
import { ErgoTree } from "@fleet-sdk/core";
import { hex } from "@fleet-sdk/crypto";
import { SGroupElement, SLong, SSigmaProp } from "@fleet-sdk/serializer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bn } from "@/common/bigNumber";
import { fetchBabelBoxes } from "./babelFees";

const mocks = vi.hoisted(() => ({
  spendable: [] as Box<bigint>[],
  keys: [] as unknown[]
}));

vi.mock("@/stores/relayStore", () => ({
  useRelayStore: () => ({
    readBoxes: async (key: unknown) => {
      mocks.keys.push(key);
      return { spendable: mocks.spendable };
    }
  })
}));

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const OWNER = SSigmaProp(SGroupElement(new Uint8Array(33).fill(2))).toHex();

function babelBox(id: string, tokenId: string, rate: bigint, creationHeight = 100): Box<bigint> {
  return {
    boxId: id.repeat(64),
    transactionId: "f".repeat(64),
    index: 0,
    value: 1_000_000_000n,
    ergoTree: buildBabelContract(tokenId),
    creationHeight,
    assets: [],
    additionalRegisters: { R4: OWNER, R5: SLong(rate).toHex() }
  };
}

describe("fetchBabelBoxes", () => {
  beforeEach(() => {
    mocks.spendable = [];
    mocks.keys = [];
  });

  it("reads the Babel contract's template", async () => {
    await fetchBabelBoxes([TOKEN_A]);

    const template = hex.encode(new ErgoTree(buildBabelContract(TOKEN_B)).template);
    expect(mocks.keys).toEqual([{ template }]);
  });

  it("keeps the requested tokens' boxes at or above the price, oldest first", async () => {
    mocks.spendable = [
      babelBox("1", TOKEN_A, 1000n, 200),
      babelBox("2", TOKEN_B, 1000n),
      babelBox("3", TOKEN_A, 10n),
      babelBox("4", TOKEN_A, 2000n, 100),
      { ...babelBox("5", TOKEN_A, 1000n), additionalRegisters: {} }
    ];

    const boxes = await fetchBabelBoxes([TOKEN_A], bn(100));

    expect(boxes.map((b) => b.boxId[0])).toEqual(["4", "1"]);
  });
});
