import { Box, EIP12UnsignedTransaction, orderBy, utxoFilter } from "@fleet-sdk/common";
import { TransactionBuilder } from "@fleet-sdk/core";
import {
  safeGetChangeAddress,
  setFee,
  setSelectionAndChangeStrategy
} from "@/chains/ergo/transaction/txBuilder";
import { FeeSettings, WalletType } from "@/types/internal";

export async function createConsolidationTransaction(
  inputs: Box[],
  creationHeight: number,
  walletType: WalletType,
  fee: FeeSettings
): Promise<EIP12UnsignedTransaction> {
  inputs = utxoFilter(
    orderBy(inputs, (input) => input.creationHeight),
    {
      max: {
        count: 200,
        aggregatedDistinctTokens: walletType === WalletType.Ledger ? 20 : undefined
      }
    }
  );

  const unsigned = new TransactionBuilder(creationHeight)
    .from(inputs)
    .configureSelector((x) => x.ensureInclusion((input) => input.value > 0n))
    .sendChangeTo(await safeGetChangeAddress());

  await setFee(unsigned, fee);
  setSelectionAndChangeStrategy(unsigned, walletType);

  return unsigned.build().toEIP12Object();
}
