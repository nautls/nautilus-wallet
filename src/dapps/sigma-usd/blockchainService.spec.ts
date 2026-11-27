import { SIGMA_USD_PARAMETERS } from "@fleet-sdk/ageusd-plugin";
import type { Box } from "@fleet-sdk/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBankBox, getOracleBox } from "./blockchainService";

const { streamBoxes } = vi.hoisted(() => ({
  streamBoxes: vi.fn()
}));

vi.mock("@/chains/ergo/services/graphQlService", () => ({
  graphQLService: { streamBoxes }
}));

const MOCK_BOX = {
  boxId: "aa".repeat(32),
  transactionId: "bb".repeat(32),
  index: 0,
  value: "1000000000",
  ergoTree: SIGMA_USD_PARAMETERS.contract,
  creationHeight: 1_000_000,
  assets: [{ tokenId: SIGMA_USD_PARAMETERS.tokens.nftId, amount: "1" }],
  additionalRegisters: {}
} as unknown as Box<string>;

describe("SigmaUSD blockchainService", () => {
  beforeEach(() => {
    streamBoxes.mockReset();
  });

  it("queries the bank box by the bank singleton NFT and contract", async () => {
    streamBoxes.mockImplementation(async function* () {
      yield [MOCK_BOX];
    });

    const box = await getBankBox("blockchain+mempool");

    expect(box).toBe(MOCK_BOX);
    expect(streamBoxes).toHaveBeenCalledWith({
      where: {
        tokenId: SIGMA_USD_PARAMETERS.tokens.nftId,
        ergoTree: SIGMA_USD_PARAMETERS.contract
      },
      from: "blockchain+mempool",
      take: 1
    });
    expect(SIGMA_USD_PARAMETERS.tokens.nftId).not.toBe(SIGMA_USD_PARAMETERS.tokens.stableCoinId);
  });

  it("returns undefined when no bank box matches", async () => {
    streamBoxes.mockImplementation(async function* () {
      yield [];
    });

    const box = await getBankBox("mempool");

    expect(box).toBeUndefined();
    expect(streamBoxes).toHaveBeenCalledWith({
      where: {
        tokenId: SIGMA_USD_PARAMETERS.tokens.nftId,
        ergoTree: SIGMA_USD_PARAMETERS.contract
      },
      from: "mempool",
      take: 1
    });
  });

  it("queries the oracle box by the oracle singleton NFT from blockchain", async () => {
    streamBoxes.mockImplementation(async function* () {
      yield [MOCK_BOX];
    });

    const box = await getOracleBox();

    expect(box).toBe(MOCK_BOX);
    expect(streamBoxes).toHaveBeenCalledWith({
      where: {
        tokenId: SIGMA_USD_PARAMETERS.oracle.nftId
      },
      from: "blockchain",
      take: 1
    });
  });
});
