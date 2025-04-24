import { AgeUSDExchangeAction, AgeUSDExchangePlugin, SigmaUSDBank } from "@fleet-sdk/ageusd-plugin";
import { EIP12UnsignedTransaction } from "@fleet-sdk/common";
import { TransactionBuilder } from "@fleet-sdk/core";
import { useChainStore } from "@/stores/chainStore";
import { useWalletStore } from "@/stores/walletStore";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import {
  safeGetChangeAddress,
  setSelectionAndChangeStrategy
} from "@/chains/ergo/transaction/builder";

export async function createExchangeTransaction(
  bank: SigmaUSDBank,
  action: AgeUSDExchangeAction,
  transactionFee: bigint
): Promise<EIP12UnsignedTransaction> {
  const chain = useChainStore();
  const wallet = useWalletStore();
  const recipient = safeGetChangeAddress();

  const unsigned = new TransactionBuilder(chain.height)
    .from(await fetchBoxes(wallet.id))
    .extend(AgeUSDExchangePlugin(bank, { ...action, recipient, transactionFee }))
    .sendChangeTo(recipient);

  return setSelectionAndChangeStrategy(unsigned, wallet.type).build().toEIP12Object();
}
