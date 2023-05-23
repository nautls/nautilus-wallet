import {
  safeGetChangeAddress,
  setFee,
  setSelectionAndChangeStrategy
} from "@/api/ergo/transaction/txBuilder";
import { ErgoBox, UnsignedTx } from "@/types/connector";
import { WalletType, FeeSettings } from "@/types/internal";
import { TransactionBuilder } from "@fleet-sdk/core";

export async function createConsolidationTransaction(
  boxes: ErgoBox[],
  creationHeight: number,
  walletType: WalletType,
  fee: FeeSettings
): Promise<UnsignedTx> {
  const unsigned = new TransactionBuilder(creationHeight)
    .from(boxes)
    .configureSelector((x) => x.ensureInclusion((input) => input.value > 0n))
    .sendChangeTo(await safeGetChangeAddress());

  await setFee(unsigned, fee);
  setSelectionAndChangeStrategy(unsigned, walletType);

  return unsigned.build().toEIP12Object() as UnsignedTx;
}
