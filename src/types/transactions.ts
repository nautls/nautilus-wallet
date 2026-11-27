/** A tx's net change to the wallet, summed over its addresses. */
export type TransactionSummary = {
  transactionId: string;
  /** Absent while pending. */
  height?: number;
  /** The including block's time, in milliseconds; absent while pending. */
  timestamp?: number;
  /** What the tx pays the miners' fee contract, in nanoERGs. */
  fee?: bigint;
  /** Signed; tokens the tx leaves unchanged are left out. */
  delta: { nanoErgs: bigint; tokens: Map<string, bigint> };
  /** Pending, spending the wallet's boxes and paying someone else: a replace-by-fee can undo it. */
  cancelable: boolean;
};
