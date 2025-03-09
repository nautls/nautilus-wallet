import { EIP12UnsignedTransaction } from "@fleet-sdk/common";
import { FleetPlugin, TransactionBuilder } from "@fleet-sdk/core";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import {
  safeGetChangeAddress,
  setFee,
  setSelectionAndChangeStrategy
} from "@/chains/ergo/transaction/builder";
import { FeeSettings, StateWallet } from "@/types/internal";

export async function createExchangeTransaction(
  plugin: FleetPlugin,
  creationHeight: number,
  wallet: StateWallet,
  fee: FeeSettings
): Promise<EIP12UnsignedTransaction> {
  const inputs = await fetchBoxes(wallet.id);
  const unsigned = new TransactionBuilder(creationHeight)
    .from(inputs)
    .extend(plugin)
    .sendChangeTo(safeGetChangeAddress());

  // await setFee(unsigned, fee);
  setSelectionAndChangeStrategy(unsigned, wallet.type);

  return unsigned.build().toEIP12Object();
}
