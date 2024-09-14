import { Amount, BoxSummary, TokenAmount, utxoDiff } from "@fleet-sdk/common";
import {
  ChainProviderConfirmedTransaction,
  ChainProviderUnconfirmedTransaction
} from "@fleet-sdk/blockchain-providers";
import { FEE_CONTRACT } from "@fleet-sdk/core";
import { BigNumber } from "bignumber.js";
import { OutputAsset } from "@/chains/ergo/transaction/interpreter/outputInterpreter";
import { Token } from "@/types/connector";
import { AssetsMetadataMap } from "@/types/internal";
import { bn, decimalize } from "@/common/bigNumber";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { ConfirmedTransactionSummary, UnconfirmedTransactionSummary } from "@/types/transactions";

export const tokensToOutputAssets = (
  tokens: Token[],
  metadata: AssetsMetadataMap
): OutputAsset[] => {
  return tokens.map((t: Token) => {
    const decimals = metadata.get(t.tokenId)?.decimals ?? 0;
    return {
      tokenId: t.tokenId,
      amount: decimalize(bn(t.amount), decimals),
      name: metadata.get(t.tokenId)?.name,
      decimals: decimals
    } as OutputAsset;
  });
};

export const tokenAmountToToken = (
  tokenAmount: TokenAmount<Amount>,
  metadata: AssetsMetadataMap
): Token => {
  return {
    tokenId: tokenAmount.tokenId,
    amount: tokenAmount.amount.toString(),
    decimals: metadata.get(tokenAmount.tokenId)?.decimals,
    name: metadata.get(tokenAmount.tokenId)?.name
  };
};

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
    delta: mapDelta(utxoDiff(ownOutputs, ownInputs)),
    confirmed: transaction.confirmed,
    height: "height" in transaction ? transaction.height : undefined
  };

  return transaction.confirmed
    ? (summary as ConfirmedTransactionSummary)
    : ({ ...summary, transaction } as UnconfirmedTransactionSummary);
}

function mapDelta(utxoSummary: BoxSummary): TokenAmount<BigNumber>[] {
  const tokens = utxoSummary.tokens.map((x) => ({
    tokenId: x.tokenId,
    amount: bn(x.amount.toString())
  }));

  return utxoSummary.nanoErgs === 0n
    ? tokens
    : [{ tokenId: ERG_TOKEN_ID, amount: bn(utxoSummary.nanoErgs.toString()) }, ...tokens];
}
