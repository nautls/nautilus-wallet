import { BabelBox, BabelSwapPlugin, buildBabelContract } from "@fleet-sdk/babel-fees-plugin";
import { ErgoBox, SAFE_MIN_BOX_VALUE } from "@fleet-sdk/core";
import { hex } from "@fleet-sdk/crypto";
import { SGroupElement, SLong, SSigmaProp } from "@fleet-sdk/serializer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bn } from "@/common/bigNumber";
import {
  canCoverNanoErgs,
  fetchBabelBoxes,
  hasSufficientLiquidity,
  selectBestBabelBox
} from "./babelFees";

const { getBoxes } = vi.hoisted(() => ({
  getBoxes: vi.fn()
}));

vi.mock("@/chains/ergo/services/graphQlService", () => ({
  graphQLService: { getBoxes }
}));

const OWNER_PK = hex.decode("0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
const TOKEN_ID = "aa".repeat(32);

function makeBabelBox(options: {
  rate: bigint;
  value: bigint;
  creationHeight?: number;
  seed?: number;
}): BabelBox {
  const transactionId = (options.seed ?? 1).toString(16).padStart(64, "0");
  const candidate = {
    value: options.value,
    ergoTree: buildBabelContract(TOKEN_ID),
    creationHeight: options.creationHeight ?? 1_000_000,
    assets: [],
    additionalRegisters: {
      R4: SSigmaProp(SGroupElement(OWNER_PK)).toHex(),
      R5: SLong(options.rate).toHex()
    }
  };

  return {
    ...candidate,
    boxId: new ErgoBox(candidate, transactionId, 0).boxId,
    transactionId,
    index: 0,
    value: candidate.value.toString()
  };
}

describe("babelFees", () => {
  beforeEach(() => {
    getBoxes.mockReset();
  });

  describe("selectBestBabelBox", () => {
    it("sorts Babel boxes numerically by rate instead of lexicographically", () => {
      const rate2 = makeBabelBox({ rate: 2n, value: 100_000_000n, seed: 1 });
      const rate10 = makeBabelBox({ rate: 10n, value: 100_000_000n, seed: 2 });
      const rate900 = makeBabelBox({ rate: 900n, value: 100_000_000n, seed: 3 });
      const rate1000 = makeBabelBox({ rate: 1000n, value: 100_000_000n, seed: 4 });

      expect(selectBestBabelBox([rate2, rate10], bn(100))?.boxId).toBe(rate10.boxId);
      expect(selectBestBabelBox([rate900, rate1000], bn(100))?.boxId).toBe(rate1000.boxId);
    });

    it("compares 64-bit rates accurately above Number.MAX_SAFE_INTEGER", () => {
      const lower = 9_007_199_254_740_992n;
      const higher = 9_007_199_254_740_993n;
      const lowerBox = makeBabelBox({ rate: lower, value: lower + SAFE_MIN_BOX_VALUE, seed: 1 });
      const higherBox = makeBabelBox({
        rate: higher,
        value: higher + SAFE_MIN_BOX_VALUE,
        seed: 2
      });

      expect(selectBestBabelBox([lowerBox, higherBox], bn(1))?.boxId).toBe(higherBox.boxId);
    });

    it("requires remaining balance of at least SAFE_MIN_BOX_VALUE so swaps build cleanly", () => {
      const amount = bn(100);
      const exactShortfall = makeBabelBox({
        rate: 20_000n,
        value: 2_000_000n + SAFE_MIN_BOX_VALUE - 1n,
        seed: 1
      });
      const exactMinimum = makeBabelBox({
        rate: 15_000n,
        value: 1_500_000n + SAFE_MIN_BOX_VALUE,
        seed: 2
      });

      const selected = selectBestBabelBox([exactShortfall, exactMinimum], amount);

      expect(selected?.boxId).toBe(exactMinimum.boxId);
      expect(() =>
        BabelSwapPlugin(selected!, { tokenId: TOKEN_ID, amount: amount.toString() })
      ).not.toThrow();
    });

    it("skips boxes with zero or negative rates and non-positive amounts", () => {
      const zeroRate = makeBabelBox({ rate: 0n, value: 10_000_000n, seed: 1 });
      const negativeRate = makeBabelBox({ rate: -500n, value: 10_000_000n, seed: 2 });
      const validBox = makeBabelBox({ rate: 1000n, value: 10_000_000n, seed: 3 });

      expect(selectBestBabelBox([zeroRate, negativeRate], bn(10))).toBeUndefined();
      expect(selectBestBabelBox([zeroRate, negativeRate, validBox], bn(10))?.boxId).toBe(
        validBox.boxId
      );
      expect(selectBestBabelBox([validBox], bn(0))).toBeUndefined();
      expect(selectBestBabelBox([validBox], bn(-1))).toBeUndefined();
    });
  });

  describe("liquidity helpers", () => {
    it("checks exact liquidity boundaries against SAFE_MIN_BOX_VALUE", () => {
      const box = makeBabelBox({ rate: 1000n, value: 1_100_000n + SAFE_MIN_BOX_VALUE, seed: 1 });

      expect(hasSufficientLiquidity(box, bn(1100))).toBe(true);
      expect(hasSufficientLiquidity(box, bn(1101))).toBe(false);
      expect(canCoverNanoErgs(box, bn(1_100_000))).toBe(true);
      expect(canCoverNanoErgs(box, bn(1_100_001))).toBe(false);
    });

    it("rejects boxes when a single token swap exceeds available ERG", () => {
      const box = makeBabelBox({ rate: 5_000_000n, value: 3_000_000n, seed: 1 });

      expect(canCoverNanoErgs(box, bn(1_100_000))).toBe(false);
    });

    it("rejects zero and negative rates in canCoverNanoErgs", () => {
      const zeroRate = makeBabelBox({ rate: 0n, value: 10_000_000n, seed: 1 });
      const negativeRate = makeBabelBox({ rate: -100n, value: 10_000_000n, seed: 2 });

      expect(canCoverNanoErgs(zeroRate, bn(1_100_000))).toBe(false);
      expect(canCoverNanoErgs(negativeRate, bn(1_100_000))).toBe(false);
    });
  });

  describe("fetchBabelBoxes", () => {
    it("excludes non-positive rates and sorts boxes by creation height", async () => {
      const zeroRate = makeBabelBox({ rate: 0n, value: 10_000_000n, creationHeight: 10, seed: 1 });
      const negativeRate = makeBabelBox({
        rate: -1n,
        value: 10_000_000n,
        creationHeight: 11,
        seed: 2
      });
      const newer = makeBabelBox({ rate: 2000n, value: 10_000_000n, creationHeight: 30, seed: 3 });
      const older = makeBabelBox({ rate: 1000n, value: 10_000_000n, creationHeight: 20, seed: 4 });
      getBoxes.mockResolvedValue([zeroRate, negativeRate, newer, older]);

      const boxes = await fetchBabelBoxes([TOKEN_ID]);

      expect(boxes.map((b) => b.boxId)).toEqual([older.boxId, newer.boxId]);
    });
  });
});
