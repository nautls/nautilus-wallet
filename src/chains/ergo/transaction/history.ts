import { FEE_CONTRACT } from "@fleet-sdk/core";
import type { HistoryState, MempoolTransaction } from "@hergmes/sdk";
import type { TransactionSummary } from "@/types/transactions";

export type MergedHistory = {
  items: TransactionSummary[];
  /** The confirmed items above this height are complete; older ones wait for more pages. */
  frontier: number;
  /** Every address's history reached its first tx, or failed with nothing read. */
  end: boolean;
  /** Some address's history failed its last read. */
  failed: boolean;
};

/**
 * The wallet's txs from its addresses' histories, newest first, pending ones on top, each
 * once with its deltas summed and its fee, the whole tx's, taken once.
 *
 * Each history is read page by page on its own, so a confirmed tx shows only once every
 * history still paging has read past its height: until then, another address may hold the
 * same tx, or one newer than the oldest shown, on a page not read yet. A history that failed
 * with nothing read is left out, so one address can't hold back the others.
 */
export function mergeHistories(states: readonly HistoryState[]): MergedHistory {
  const frontier = Math.max(-Infinity, ...states.map(oldestHeight));
  const merged = new Map<string, TransactionSummary>();

  for (const state of states) {
    const seen = new Set<string>();
    for (const item of state.items) {
      if (seen.has(item.txId)) continue;
      seen.add(item.txId);

      let tx = merged.get(item.txId);
      if (!tx) {
        tx = {
          transactionId: item.txId,
          delta: { nanoErgs: 0n, tokens: new Map() },
          cancelable: false
        };
        merged.set(item.txId, tx);
      }

      // a block may confirm the tx between two addresses' reads
      tx.height ??= item.height;
      tx.timestamp ??= item.timestamp;
      tx.fee ??= item.fee;
      tx.delta.nanoErgs += item.delta.nanoErgs;
      for (const [tokenId, amount] of item.delta.tokens) {
        tx.delta.tokens.set(tokenId, (tx.delta.tokens.get(tokenId) ?? 0n) + amount);
      }
    }
  }

  const items = [...merged.values()].filter(
    (tx) => (tx.height === undefined && frontier < Infinity) || (tx.height ?? -1) > frontier
  );
  for (const tx of items) {
    for (const [tokenId, amount] of tx.delta.tokens) {
      if (amount === 0n) tx.delta.tokens.delete(tokenId);
    }
    tx.cancelable = tx.height === undefined && sendsOut(tx);
  }

  return {
    items: items.sort(newestFirst),
    frontier,
    end: states.every((s) => s.end || failedEmpty(s)),
    failed: states.some((s) => !!s.error)
  };
}

/**
 * Whether a replace-by-fee can undo a pending tx: it spends a wallet's box and pays someone
 * besides the wallet and the miners. Its net change can't tell, as a tx can spend the wallet's
 * boxes and still pay it back more than they held.
 */
export function isCancelable(tx: MempoolTransaction, ownTrees: ReadonlySet<string>): boolean {
  return (
    tx.inputs.some((x) => ownTrees.has(x.ergoTree)) &&
    tx.outputs.some((x) => !ownTrees.has(x.ergoTree) && x.ergoTree !== FEE_CONTRACT)
  );
}

/**
 * The pending txs among `pending` that spend an output of `txId`, directly or down a chain of
 * them, oldest link first: canceling `txId` drops them too.
 */
export function chainedOn(txId: string, pending: readonly MempoolTransaction[]): string[] {
  const dropped = new Set([txId]);
  const chained: string[] = [];
  for (let grew = true; grew;) {
    grew = false;
    for (const tx of pending) {
      if (dropped.has(tx.id) || !tx.inputs.some((x) => dropped.has(x.transactionId))) continue;
      dropped.add(tx.id);
      chained.push(tx.id);
      grew = true;
    }
  }

  return chained;
}

/**
 * How far a history still paging is read: its oldest confirmed tx's height, or `Infinity`
 * before it has read one, as anything may come next. `-Infinity` once it is done.
 */
export function oldestHeight(state: HistoryState): number {
  if (state.end || failedEmpty(state)) return -Infinity;

  for (let i = state.items.length - 1; i >= 0; i--) {
    const height = state.items[i].height;
    if (height !== undefined) return height;
  }
  return Infinity;
}

function failedEmpty(state: HistoryState) {
  return !!state.error && state.items.length === 0;
}

/**
 * Whether the wallet pays more than the fee, or a token, to someone else: then the tx spends
 * its boxes, so a cancel can undo it. Stands in for `isCancelable` until the tx is read.
 */
function sendsOut({ delta, fee = 0n }: TransactionSummary) {
  return delta.nanoErgs + fee < 0n || [...delta.tokens.values()].some((x) => x < 0n);
}

function newestFirst(a: TransactionSummary, b: TransactionSummary) {
  if (a.height === undefined || b.height === undefined) {
    return (a.height === undefined ? 0 : 1) - (b.height === undefined ? 0 : 1);
  }
  return b.height - a.height || (b.timestamp ?? 0) - (a.timestamp ?? 0);
}
