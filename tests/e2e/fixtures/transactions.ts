import type { EIP12UnsignedTransaction } from "@fleet-sdk/common";
import { OutputBuilder, RECOMMENDED_MIN_FEE_VALUE, TransactionBuilder } from "@fleet-sdk/core";
import type { MockBox, MockChain } from "../mocks/chain";
import { addressOf, RECIPIENT_ADDRESS, type TestWallet } from "./wallets";

type P2PTxOptions = {
  to?: string;
  /** Extra boxes that are always spent, besides the wallet's own. */
  inputs?: MockBox[];
  nanoErgs?: bigint;
  tokens?: { tokenId: string; amount: string }[];
  burn?: { tokenId: string; amount: string }[];
};

/**
 * Builds an unsigned EIP-12 transaction spending the wallet's boxes on the mock chain,
 * the way a dApp would do with the UTxOs returned by `ergo.get_utxos()`.
 */
export async function buildTransaction(
  chain: MockChain,
  wallet: TestWallet,
  opt: P2PTxOptions = {}
): Promise<EIP12UnsignedTransaction> {
  const change = await addressOf(wallet, 0);
  const inputs = [
    ...chain.boxesOf(change),
    ...chain.boxesOf(await addressOf(wallet, 1)),
    ...(opt.inputs ?? [])
  ];

  const builder = new TransactionBuilder(chain.height)
    .from(inputs)
    .to(
      new OutputBuilder(opt.nanoErgs ?? 1_000_000_000n, opt.to ?? RECIPIENT_ADDRESS).addTokens(
        opt.tokens ?? []
      )
    )
    .sendChangeTo(change)
    .payFee(RECOMMENDED_MIN_FEE_VALUE);

  if (opt.burn) builder.burnTokens(opt.burn);
  if (opt.inputs) {
    const ids = opt.inputs.map((b) => b.boxId);
    builder.configureSelector((selector) => selector.ensureInclusion(ids));
  }

  return builder.build().toEIP12Object();
}
