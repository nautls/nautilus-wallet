import {
  ChainProviderConfirmedTransaction,
  ChainProviderUnconfirmedTransaction
} from "@fleet-sdk/blockchain-providers";
import { utxoDiff } from "@fleet-sdk/common";
import { FEE_CONTRACT } from "@fleet-sdk/core";
import BigNumber from "bignumber.js";
import { decimalize } from "@/common/bigNumber";
import { ERG_DECIMALS } from "@/constants/ergo";
import { ConfirmedTransactionSummary, UnconfirmedTransactionSummary } from "@/types/transactions";

export function summarizeTransaction(
  transaction: ChainProviderConfirmedTransaction<string>,
  ergoTrees: Set<string>
): ConfirmedTransactionSummary;
export function summarizeTransaction(
  transaction: ChainProviderUnconfirmedTransaction<string>,
  ergoTrees: Set<string>
): UnconfirmedTransactionSummary;
export function summarizeTransaction(
  transaction:
    | ChainProviderConfirmedTransaction<string>
    | ChainProviderUnconfirmedTransaction<string>,
  ergoTrees: Set<string>
): ConfirmedTransactionSummary | UnconfirmedTransactionSummary {
  const ownInputs = transaction.inputs.filter((x) => ergoTrees.has(x.ergoTree));
  const ownOutputs = transaction.outputs.filter((x) => ergoTrees.has(x.ergoTree));

  const summary = {
    transactionId: transaction.transactionId,
    timestamp: transaction.timestamp,
    fee: decimalize(
      new BigNumber(transaction.outputs.find((x) => x.ergoTree === FEE_CONTRACT)?.value ?? 0),
      ERG_DECIMALS
    ),
    delta: utxoDiff(ownOutputs, ownInputs),
    confirmed: transaction.confirmed,
    height: "height" in transaction ? transaction.height : undefined
  };

  return transaction.confirmed
    ? (summary as ConfirmedTransactionSummary)
    : ({
        ...summary,
        ownInputs,
        cancelable: ownInputs.length > 0 && ownOutputs.length < transaction.outputs.length - 1 // -1 for fee box
      } as UnconfirmedTransactionSummary);
}
