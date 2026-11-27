import type { Box } from "@fleet-sdk/common";
import { FEE_CONTRACT } from "@fleet-sdk/core";
import type { HistoryItem, HistoryState, MempoolTransaction } from "@hergmes/sdk";
import { describe, expect, it } from "vitest";
import { chainedOn, isCancelable, mergeHistories } from "./history";

const TOKEN = "t".repeat(64);

function item(
  txId: string,
  height: number | undefined,
  nanoErgs: bigint,
  tokens: [string, bigint][] = [],
  fee?: bigint
): HistoryItem {
  return {
    txId,
    height,
    timestamp: height === undefined ? undefined : height * 1000,
    delta: { nanoErgs, tokens: new Map(tokens) },
    fee
  };
}

function state(items: HistoryItem[], extra: Partial<HistoryState> = {}): HistoryState {
  return {
    address: "a",
    items,
    end: true,
    loading: false,
    error: undefined,
    resets: 0,
    ...extra
  };
}

const ids = (states: HistoryState[]) => mergeHistories(states).items.map((x) => x.transactionId);

describe("mergeHistories", () => {
  it("should sum a tx's deltas across addresses and take its fee once", () => {
    const [tx] = mergeHistories([
      state([item("x", 10, -5n, [[TOKEN, -2n]], 1n)]),
      state([item("x", 10, 3n, [[TOKEN, 2n]], 1n)])
    ]).items;

    expect(tx.delta.nanoErgs).toBe(-2n);
    expect(tx.delta.tokens.size).toBe(0);
    expect(tx.fee).toBe(1n);
  });

  it("should list pending txs first, then confirmed ones newest first", () => {
    expect(
      ids([state([item("p", undefined, 1n), item("b", 20, 1n)]), state([item("a", 30, 1n)])])
    ).toEqual(["p", "a", "b"]);
  });

  it("should take a tx as confirmed when one address's history saw it confirmed", () => {
    const [tx] = mergeHistories([
      state([item("x", undefined, -5n)]),
      state([item("x", 12, 2n)])
    ]).items;
    expect(tx.height).toBe(12);
    expect(tx.cancelable).toBe(false);
  });

  it("should hold back confirmed txs no older than a history still paging has read", () => {
    const merged = mergeHistories([
      state([item("a", 30, 1n), item("b", 20, 1n)], { end: false }),
      state([item("c", 25, 1n), item("d", 10, 1n)])
    ]);

    expect(merged.frontier).toBe(20);
    expect(merged.items.map((x) => x.transactionId)).toEqual(["a", "c"]);
    expect(merged.end).toBe(false);
  });

  it("should show nothing until every first page is read", () => {
    const merged = mergeHistories([
      state([item("p", undefined, 1n), item("a", 30, 1n)]),
      state([], { end: false, loading: true })
    ]);
    expect(merged.items).toEqual([]);
  });

  it("should not let a history that failed with nothing read hold back the others", () => {
    const merged = mergeHistories([
      state([item("a", 30, 1n)]),
      state([], { end: false, error: { code: "node_error", message: "down" } })
    ]);

    expect(merged.items.map((x) => x.transactionId)).toEqual(["a"]);
    expect(merged.failed).toBe(true);
    expect(merged.end).toBe(true);
  });

  it("should count a tx listed twice in one history once", () => {
    const [tx] = mergeHistories([state([item("x", 10, 1n), item("x", 10, 1n)])]).items;
    expect(tx.delta.nanoErgs).toBe(1n);
  });

  it.each([
    ["sends ERG out", -1_000_000_000n, [], true],
    ["sends a token out", -1_000_000n, [[TOKEN, -1n]], true],
    ["only pays its fee", -1_000_000n, [], false],
    ["receives", 5n, [], false]
  ] as const)(
    "should tell whether a pending tx that %s can be canceled",
    (_, nanoErgs, tokens, want) => {
      const [tx] = mergeHistories([
        state([item("x", undefined, nanoErgs, [...tokens] as [string, bigint][], 1_000_000n)])
      ]).items;
      expect(tx.cancelable).toBe(want);
    }
  );
});

const OWN = "0008cd02aa";
const OTHER = "0008cd02bb";
const OWN_TREES = new Set([OWN]);

function output(ergoTree: string, transactionId = "x", index = 0): Box<string> {
  return {
    boxId: `${transactionId}${index}`,
    transactionId,
    index,
    value: "1000000000",
    ergoTree,
    creationHeight: 1,
    assets: [],
    additionalRegisters: {}
  };
}

function pendingTx(id: string, inputs: Box<string>[], outputs: string[]): MempoolTransaction {
  return {
    id,
    inputs: inputs.map((x) => ({ ...x, spendingProof: { proofBytes: "", extension: {} } })),
    dataInputs: [],
    outputs: outputs.map((tree, i) => output(tree, id, i))
  };
}

describe("isCancelable", () => {
  it.each([
    ["spends the wallet's box and pays someone else", [OWN], [OTHER, OWN, FEE_CONTRACT], true],
    ["pays the wallet back more than it spent", [OWN, OTHER], [OTHER, OWN, FEE_CONTRACT], true],
    ["only moves the wallet's boxes", [OWN], [OWN, FEE_CONTRACT], false],
    ["spends nothing of the wallet's", [OTHER], [OWN, FEE_CONTRACT], false]
  ] as const)("should tell whether a tx that %s can be canceled", (_, ins, outs, want) => {
    const tx = pendingTx(
      "x",
      ins.map((tree, i) => output(tree, "prev", i)),
      [...outs]
    );
    expect(isCancelable(tx, OWN_TREES)).toBe(want);
  });
});

describe("chainedOn", () => {
  const a = pendingTx("a", [output(OWN, "confirmed")], [OTHER, OWN]);
  const b = pendingTx("b", [output(OWN, "a", 1)], [OTHER, OWN]);
  const c = pendingTx("c", [output(OWN, "b", 1)], [OTHER]);
  const unrelated = pendingTx("d", [output(OWN, "confirmed", 1)], [OTHER]);

  it("should list the txs spending a tx's outputs, down the chain", () => {
    expect(chainedOn("a", [c, unrelated, b, a])).toEqual(["b", "c"]);
  });

  it("should list nothing for a tx no other spends from", () => {
    expect(chainedOn("c", [a, b, c, unrelated])).toEqual([]);
  });
});
