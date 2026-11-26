import { ErgoAddress, InsufficientInputs } from "@fleet-sdk/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpendableBox } from "@/chains/ergo/services/hergmesService";
import { bn } from "@/common/bigNumber";
import type { UnconfirmedTransactionSummary } from "@/types/transactions";
import { computeBoxId } from "../boxId";
import { createRBFCancellationTransaction } from "./builder";

const ADDRESS = ErgoAddress.fromPublicKey(
  "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
);

const mocks = vi.hoisted(() => ({ boxes: [] as SpendableBox[] }));

vi.mock("@/stores/walletStore", () => ({
  useWalletStore: () => ({
    id: 1,
    type: "standard",
    publicKey: "pk",
    changeAddress: { index: 0 }
  })
}));
vi.mock("@/stores/chainStore", () => ({ useChainStore: () => ({ height: 1000 }) }));
vi.mock("@/common/objectPool", () => ({
  hdKeyPool: { get: () => ({ deriveAddress: () => ({ script: ADDRESS.encode() }) }) }
}));
vi.mock("@/chains/ergo/services/hergmesService", () => ({}));
vi.mock("@/stores/boxesStore", () => ({
  useBoxesStore: () => ({
    spendable: async () => ({
      all: mocks.boxes,
      confirmed: mocks.boxes.filter((b) => b.confirmed),
      unconfirmed: mocks.boxes.filter((b) => !b.confirmed)
    })
  })
}));
vi.mock("../babelFees", () => ({}));

function box(value: bigint, confirmed: boolean, transactionId = "1"): SpendableBox {
  const content = {
    boxId: "",
    transactionId: transactionId.repeat(64),
    index: 0,
    value: value.toString(),
    ergoTree: ADDRESS.ergoTree,
    creationHeight: 900,
    assets: [],
    additionalRegisters: {}
  };
  return { ...content, boxId: computeBoxId(content), confirmed };
}

const CANCELED_TX = "c";
const FEE = 1_100_000n;

const ONE_ERG = 1_000_000_000n;
// short of the higher fee: the original fee plus `SAFE_MIN_FEE_VALUE`
const own = box(FEE, true, "0");

function pendingTx(input = own): UnconfirmedTransactionSummary {
  return {
    transactionId: CANCELED_TX.repeat(64),
    timestamp: 0,
    fee: bn("0.0011"),
    delta: { nanoErgs: 0n, tokens: [] },
    confirmed: false,
    cancelable: true,
    ownInputs: [input]
  };
}

const inputIds = async (tx = pendingTx()) =>
  (await createRBFCancellationTransaction(tx)).inputs.map((i) => i.boxId);

beforeEach(() => {
  mocks.boxes = [];
});

describe("createRBFCancellationTransaction", () => {
  it("should pay the higher fee from the canceled tx's own inputs when they cover it", async () => {
    const rich = box(ONE_ERG, true, "0");
    mocks.boxes = [box(ONE_ERG, true), box(ONE_ERG, false)];
    expect(await inputIds(pendingTx(rich))).toEqual([rich.boxId]);
  });

  it("should add confirmed boxes before pending ones", async () => {
    const pending = box(ONE_ERG, false);
    const confirmed = box(ONE_ERG, true, "2");
    mocks.boxes = [pending, confirmed];
    expect(await inputIds()).toEqual([own.boxId, confirmed.boxId]);
  });

  it("should add pending boxes when confirmed ones can't pay the fee", async () => {
    const pending = box(ONE_ERG, false);
    mocks.boxes = [pending];
    expect(await inputIds()).toEqual([own.boxId, pending.boxId]);
  });

  it("should never spend the canceled tx's own outputs", async () => {
    mocks.boxes = [box(ONE_ERG, false, CANCELED_TX)];
    await expect(createRBFCancellationTransaction(pendingTx())).rejects.toBeInstanceOf(
      InsufficientInputs
    );
  });
});
