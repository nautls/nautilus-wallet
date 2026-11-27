import { ErgoAddress, FEE_CONTRACT, InsufficientInputs } from "@fleet-sdk/core";
import type { MempoolTransaction } from "@hergmes/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpendableBox } from "@/chains/ergo/services/hergmesService";
import { computeBoxId } from "../boxId";
import { createRBFCancellationTransaction } from "./builder";

const ADDRESS = ErgoAddress.fromPublicKey(
  "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
);

const OTHER = ErgoAddress.fromPublicKey(
  "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5"
);

const mocks = vi.hoisted(() => ({
  boxes: [] as SpendableBox[],
  pending: undefined as MempoolTransaction | undefined
}));

vi.mock("@/stores/walletStore", () => ({
  useWalletStore: () => ({
    id: 1,
    type: "standard",
    publicKey: "pk",
    changeAddress: { index: 0 },
    get addresses() {
      return [{ script: ADDRESS.encode() }];
    }
  })
}));
vi.mock("@/stores/chainStore", () => ({ useChainStore: () => ({ height: 1000 }) }));
vi.mock("@/common/objectPool", () => ({
  hdKeyPool: { get: () => ({ deriveAddress: () => ({ script: ADDRESS.encode() }) }) }
}));
vi.mock("@/chains/ergo/services/hergmesService", () => ({
  getPendingTransaction: async () => mocks.pending
}));
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

function box(
  value: bigint,
  confirmed: boolean,
  transactionId = "1",
  ergoTree = ADDRESS.ergoTree
): SpendableBox {
  const content = {
    boxId: "",
    transactionId: transactionId.repeat(64),
    index: 0,
    value: value.toString(),
    ergoTree,
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

/** The canceled tx: spends `inputs`, pays `FEE` and sends the rest to someone else. */
function pendingTx(...inputs: SpendableBox[]): MempoolTransaction {
  const spent = inputs.reduce((sum, x) => sum + BigInt(x.value), 0n);
  return {
    id: CANCELED_TX.repeat(64),
    inputs: inputs.map((x) => ({ ...x, spendingProof: { proofBytes: "ab", extension: {} } })),
    dataInputs: [],
    outputs: [
      { ...box(spent - FEE, false, CANCELED_TX, OTHER.ergoTree), index: 0 },
      { ...box(FEE, false, CANCELED_TX, FEE_CONTRACT), index: 1 }
    ]
  };
}

const inputIds = async (tx = pendingTx(own)) => {
  mocks.pending = tx;
  return (await createRBFCancellationTransaction(tx.id)).inputs.map((i) => i.boxId);
};

beforeEach(() => {
  mocks.boxes = [];
  mocks.pending = undefined;
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
    await expect(inputIds()).rejects.toBeInstanceOf(InsufficientInputs);
  });

  it("should keep only the wallet's inputs, without their proofs", async () => {
    const foreign = box(ONE_ERG, true, "3", OTHER.ergoTree);
    mocks.boxes = [box(ONE_ERG, true, "2")];
    mocks.pending = pendingTx(own, foreign);

    const tx = await createRBFCancellationTransaction(mocks.pending.id);
    const ids = tx.inputs.map((i) => i.boxId);
    expect(ids).toContain(own.boxId);
    expect(ids).not.toContain(foreign.boxId);
    expect(tx.inputs.every((i) => !("spendingProof" in i))).toBe(true);
  });

  it("should pay more than the canceled tx's fee", async () => {
    mocks.boxes = [box(ONE_ERG, true, "2")];
    mocks.pending = pendingTx(own);

    const tx = await createRBFCancellationTransaction(mocks.pending.id);
    const fee = tx.outputs.find((x) => x.ergoTree === FEE_CONTRACT);
    expect(BigInt(fee!.value)).toBeGreaterThan(FEE);
  });

  it("should refuse a tx that is no longer pending", async () => {
    await expect(createRBFCancellationTransaction(CANCELED_TX.repeat(64))).rejects.toThrow(
      "can no longer be canceled"
    );
  });
});
