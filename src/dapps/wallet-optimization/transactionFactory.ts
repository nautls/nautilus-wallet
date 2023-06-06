import {
  safeGetChangeAddress,
  setFee,
  setSelectionAndChangeStrategy
} from "@/api/ergo/transaction/txBuilder";
import { ErgoBox, UnsignedTx } from "@/types/connector";
import { WalletType, FeeSettings } from "@/types/internal";
import { orderBy, utxoFilter } from "@fleet-sdk/common";
import { TransactionBuilder } from "@fleet-sdk/core";

export async function createConsolidationTransaction(
  inputs: ErgoBox[],
  creationHeight: number,
  walletType: WalletType,
  fee: FeeSettings
): Promise<UnsignedTx> {
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

  return unsigned.build().toEIP12Object() as UnsignedTx;
}
