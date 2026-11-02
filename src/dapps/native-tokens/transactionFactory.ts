import { EIP12UnsignedTransaction, isEmpty, TokenAmount } from "@fleet-sdk/common";
import { estimateMinBoxValue, OutputBuilder, TransactionBuilder } from "@fleet-sdk/core";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import {
  safeGetChangeAddress,
  setFee,
  setSelectionAndChangeStrategy
} from "@/chains/ergo/transaction/builder";
import { FeeSettings } from "@/types/internal";

export type NewTokenParams = {
  name: string;
  description: string;
  decimals: number;
  amount: bigint;
};

/**
 * Builds an EIP-4 compliant token minting transaction. The minted token is sent to the
 * wallet's change address.
 */
export async function createMintTransaction(
  token: NewTokenParams,
  fee: FeeSettings
): Promise<EIP12UnsignedTransaction> {
  const { inputs, height, recipient } = await getContext();

  const unsigned = new TransactionBuilder(height)
    .from(inputs)
    .to(
      new OutputBuilder(estimateMinBoxValue(), recipient, height).mintToken({
        amount: token.amount,
        name: token.name,
        decimals: token.decimals,
        description: token.description
      })
    )
    .sendChangeTo(recipient);

  return finalize(unsigned, fee);
}

/**
 * Builds a transaction that explicitly burns the given token amounts. Any remaining
 * balance is sent back to the wallet's change address.
 *
 * @param tokens amounts in the token's smallest unit
 */
export async function createBurnTransaction(
  tokens: TokenAmount<bigint>[],
  fee: FeeSettings
): Promise<EIP12UnsignedTransaction> {
  if (isEmpty(tokens)) throw Error("No tokens selected for burning.");
  const { inputs, height, recipient } = await getContext();

  const unsigned = new TransactionBuilder(height)
    .from(inputs)
    .burnTokens(tokens)
    .sendChangeTo(recipient);

  return finalize(unsigned, fee);
}

async function getContext() {
  const wallet = useWalletStore();
  const app = useAppStore();

  const [inputs, height] = await Promise.all([
    fetchBoxes(wallet.id, app.settings.zeroConf),
    graphQLService.getHeight()
  ]);

  if (isEmpty(inputs)) throw Error("Unable to fetch inputs, please check your connection.");
  if (!height) throw Error("Unable to fetch current height, please check your connection.");

  return { inputs, height, recipient: safeGetChangeAddress() };
}

async function finalize(
  builder: TransactionBuilder,
  fee: FeeSettings
): Promise<EIP12UnsignedTransaction> {
  await setFee(builder, fee);
  setSelectionAndChangeStrategy(builder, useWalletStore().type);

  return builder.build().toEIP12Object();
}
