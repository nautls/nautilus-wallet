import { BabelSwapPlugin } from "@fleet-sdk/babel-fees-plugin";
import { EIP12UnsignedTransaction, isEmpty } from "@fleet-sdk/common";
import {
  CherryPickSelectionStrategy,
  ErgoAddress,
  estimateMinBoxValue,
  OutputBuilder,
  TransactionBuilder
} from "@fleet-sdk/core";
import BigNumber from "bignumber.js";
import { useAppStore } from "@/stores/appStore";
import { useChainStore } from "@/stores/chainStore";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import { validateAddress } from "@/chains/ergo/addresses";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { bn, undecimalize } from "@/common/bigNumber";
import { hdKeyPool } from "@/common/objectPool";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { FeeSettings, WalletType } from "@/types/internal";
import { UnconfirmedTransactionSummary } from "@/types/transactions";
import { fetchBabelBoxes, getNanoErgsPerTokenRate, selectBestBabelBox } from "../babelFees";
import { fetchBoxes } from "../boxFetcher";

export const SAFE_MAX_CHANGE_TOKEN_LIMIT = 100;

const wallet = useWalletStore();
const app = useAppStore();
const chain = useChainStore();

export type TxAssetAmount = {
  asset: AssetBalance;
  amount?: BigNumber;
};

export type TxRecipient = {
  address: string;
  assets: TxAssetAmount[];
};

export async function createRBFCancellationTransaction(
  unconfirmedTx: UnconfirmedTransactionSummary
): Promise<EIP12UnsignedTransaction> {
  const { inputs, currentHeight } = await getContext();
  const ownBoxIds = new Set(unconfirmedTx.ownInputs.map((input) => input.boxId));
  const unsigned = new TransactionBuilder(currentHeight)
    .from(unconfirmedTx.ownInputs, { ensureInclusion: true })
    .and.from(inputs.filter((input) => !ownBoxIds.has(input.boxId)))
    .payFee(undecimalize(unconfirmedTx.fee, ERG_DECIMALS).plus(SAFE_MIN_FEE_VALUE).toString())
    .sendChangeTo(safeGetChangeAddress());

  setSelectionAndChangeStrategy(unsigned, wallet.type);

  return unsigned.build().toEIP12Object();
}

async function getContext() {
  const [inputs, currentHeight] = await Promise.all([
    fetchBoxes(wallet.id, app.settings.zeroConf),
    graphQLService.getHeight()
  ]);

  if (isEmpty(inputs)) {
    throw Error("Unable to fetch inputs, please check your connection.");
  }

  if (!currentHeight) {
    throw Error("Unable to fetch current height, please check your connection.");
  }

  return {
    inputs,
    currentHeight
  };
}

export async function createP2PTransaction({
  recipients,
  fee,
  walletType
}: {
  recipients: TxRecipient[];
  fee: FeeSettings;
  walletType: WalletType;
}): Promise<EIP12UnsignedTransaction> {
  const { inputs, currentHeight } = await getContext();
  const isBabelFee = fee.tokenId !== ERG_TOKEN_ID;

  let swapFundedNanoErgs = bn(0);
  const outputs = recipients.map((recipient) => {
    const output = buildRecipientOutput(recipient.address, recipient.assets, currentHeight);
    if (isBabelFee && getSendingNanoErgs(recipient.assets).isZero()) {
      swapFundedNanoErgs = swapFundedNanoErgs.plus(output.value.toString());
    }

    return output;
  });

  const unsigned = new TransactionBuilder(currentHeight)
    .from(inputs)
    .to(outputs)
    .sendChangeTo(safeGetChangeAddress());

  await setFee(unsigned, fee, { swapFundedNanoErgs });
  setSelectionAndChangeStrategy(unsigned, walletType);

  return unsigned.build().toEIP12Object();
}

// all P2PK ErgoTrees have the same size, so any P2PK address sizes a box the same way
const P2PK_PLACEHOLDER = ErgoAddress.fromPublicKey(
  "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
);
const MAX_CACHED_ADDRESSES = 32;
const SAFE_VALUE_PER_BYTE_PERCENT = 110n;

const decodedAddresses = new Map<string, ErgoAddress>();

/**
 * Estimates the minimum value of the box created for `recipient` when it sends no ERG. An
 * invalid address is estimated as a P2PK one.
 */
export function estimateRecipientBoxValue(recipient: TxRecipient): BigNumber {
  const height = chain.height || Number.MAX_SAFE_INTEGER;
  const output = buildRecipientOutput(decodeAddress(recipient.address), recipient.assets, height);
  return bn(output.value.toString());
}

function decodeAddress(address: string): ErgoAddress {
  let decoded = decodedAddresses.get(address);
  if (decoded) return decoded;

  decoded = address && validateAddress(address) ? ErgoAddress.decode(address) : P2PK_PLACEHOLDER;
  if (decodedAddresses.size >= MAX_CACHED_ADDRESSES) decodedAddresses.clear();
  decodedAddresses.set(address, decoded);

  return decoded;
}

/** Builds an output to `address`. Without ERG, it holds the minimum value for its size. */
function buildRecipientOutput(
  address: string | ErgoAddress,
  assets: TxAssetAmount[],
  height: number
): OutputBuilder {
  const nanoErgs = getSendingNanoErgs(assets);
  const boxValue = nanoErgs.isZero()
    ? estimateMinBoxValue(safeValuePerByte())
    : nanoErgs.toString();

  return new OutputBuilder(boxValue, address, height).addTokens(
    assets
      .filter((a) => a.asset.tokenId !== ERG_TOKEN_ID && a.amount && !a.amount.isZero())
      .map((token) => ({
        tokenId: token.asset.tokenId,
        amount: undecimalize(token.amount || bn(0), token.asset.metadata?.decimals).toString()
      }))
  );
}

/**
 * The chain's minimum value per byte plus a buffer, so a box estimated with a slightly
 * different size or height, or with a value that's outdated after a vote, still holds enough ERG.
 */
function safeValuePerByte(): bigint {
  return (chain.minValuePerByte * SAFE_VALUE_PER_BYTE_PERCENT) / 100n;
}

export function setSelectionAndChangeStrategy(
  builder: TransactionBuilder,
  walletType: WalletType
): TransactionBuilder {
  if (walletType === "ledger") {
    return builder
      .configure((settings) => settings.isolateErgOnChange().setMaxTokensPerChangeBox(1))
      .configureSelector((selector) => selector.defineStrategy(new CherryPickSelectionStrategy()));
  }

  return builder
    .configure((settings) => settings.setMaxTokensPerChangeBox(SAFE_MAX_CHANGE_TOKEN_LIMIT))
    .configureSelector((selector) => selector.orderBy((input) => input.creationHeight));
}

/**
 * @param options.swapFundedNanoErgs nanoERGs of the outputs the Babel swap pays for. As far as
 * the fee covers them, they are left out of the miner fee so the outputs can take them.
 */
export async function setFee(
  builder: TransactionBuilder,
  fee: FeeSettings,
  options?: { swapFundedNanoErgs?: BigNumber }
): Promise<TransactionBuilder> {
  const isBabelFee = fee.tokenId !== ERG_TOKEN_ID;
  let feeNanoErgs = undecimalize(fee.value, ERG_DECIMALS);
  let sendingNanoErgs = bn(builder.outputs.sum().nanoErgs.toString());

  if (isBabelFee) {
    const tokenUnits = undecimalize(fee.value, fee.assetInfo?.decimals);
    const selectedBox = selectBestBabelBox(
      await fetchBabelBoxes([fee.tokenId], fee.nanoErgsPerToken),
      tokenUnits
    );

    if (!selectedBox) {
      throw Error(
        "There is not enough liquidity in the Babel Boxes for the selected fee asset in the selected price range."
      );
    } else {
      fee.box = selectedBox;
    }

    feeNanoErgs = tokenUnits.multipliedBy(getNanoErgsPerTokenRate(selectedBox));
    if (options?.swapFundedNanoErgs) {
      const fundable = feeNanoErgs.minus(SAFE_MIN_FEE_VALUE);
      const funded = BigNumber.max(0, BigNumber.min(options.swapFundedNanoErgs, fundable));
      feeNanoErgs = feeNanoErgs.minus(funded);
    } else if (
      sendingNanoErgs.gt(0) &&
      sendingNanoErgs.lte(MIN_BOX_VALUE) &&
      sendingNanoErgs.lte(feeNanoErgs.minus(SAFE_MIN_FEE_VALUE))
    ) {
      sendingNanoErgs = bn(MIN_BOX_VALUE);
      feeNanoErgs = feeNanoErgs.minus(sendingNanoErgs);
    }

    builder.extend(
      BabelSwapPlugin(fee.box, { tokenId: fee.tokenId, amount: tokenUnits.toString() })
    );
  }

  return builder.payFee(feeNanoErgs.toString());
}

function getSendingNanoErgs(assets: TxAssetAmount[]): BigNumber {
  const erg = assets.find((a) => a.asset.tokenId === ERG_TOKEN_ID);
  return erg && erg.amount ? undecimalize(erg.amount, ERG_DECIMALS) : bn(0);
}

export function safeGetChangeAddress(): string {
  const index = wallet.changeAddress.index ?? 0;
  return hdKeyPool.get(wallet.publicKey).deriveAddress(index).script;
}
