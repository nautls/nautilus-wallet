import { BabelSwapPlugin } from "@fleet-sdk/babel-fees-plugin";
import { CherryPickSelectionStrategy, OutputBuilder, TransactionBuilder } from "@fleet-sdk/core";
import { BigNumber } from "bignumber.js";
import { isEmpty } from "lodash-es";
import { EIP12UnsignedTransaction } from "@fleet-sdk/common";
import { fetchBabelBoxes, getNanoErgsPerTokenRate, selectBestBabelBox } from "../babelFees";
import { fetchBoxes } from "../boxFetcher";
import { graphQLService } from "@/api/explorer/graphQlService";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { ACTIONS } from "@/constants/store";
import store from "@/store";
import { AddressState, BigNumberType, FeeSettings, StateAsset, WalletType } from "@/types/internal";
import { undecimalize } from "@/common/bigNumbers";
import { hdKeyPool } from "@/common/objectPool";

const SAFE_MAX_CHANGE_TOKEN_LIMIT = 100;

export type TxAssetAmount = {
  asset: StateAsset;
  amount?: BigNumberType;
};

export async function createP2PTransaction({
  recipientAddress,
  assets,
  fee,
  walletType
}: {
  recipientAddress: string;
  assets: TxAssetAmount[];
  fee: FeeSettings;
  walletType: WalletType;
}): Promise<EIP12UnsignedTransaction> {
  const [inputs, currentHeight] = await Promise.all([
    fetchBoxes(store.state.currentWallet.id),
    graphQLService.getCurrentHeight()
  ]);

  if (isEmpty(inputs)) {
    throw Error("Unable to fetch inputs, please check your connection.");
  }
  if (!currentHeight) {
    throw Error("Unable to fetch current height, please check your connection.");
  }

  const isBabelFee = fee.tokenId !== ERG_TOKEN_ID;
  const sendingNanoErgs = getSendingNanoErgs(assets);

  const unsigned = new TransactionBuilder(currentHeight)
    .from(inputs)
    .to(
      new OutputBuilder(
        sendingNanoErgs.eq(0) && isBabelFee ? BigInt(MIN_BOX_VALUE) : sendingNanoErgs.toString(),
        recipientAddress
      ).addTokens(
        assets
          .filter((a) => a.asset.tokenId !== ERG_TOKEN_ID && a.amount && !a.amount.isZero())
          .map((token) => ({
            tokenId: token.asset.tokenId,
            amount: undecimalize(
              token.amount || BigNumber(0),
              token.asset.info?.decimals
            ).toString()
          }))
      )
    )
    .sendChangeTo(await safeGetChangeAddress(recipientAddress));

  await setFee(unsigned, fee);
  setSelectionAndChangeStrategy(unsigned, walletType);

  return unsigned.build().toEIP12Object();
}

export function setSelectionAndChangeStrategy(
  builder: TransactionBuilder,
  walletType: WalletType
): TransactionBuilder {
  if (walletType === WalletType.Ledger) {
    return builder
      .configure((settings) => settings.isolateErgOnChange().setMaxTokensPerChangeBox(1))
      .configureSelector((selector) => selector.defineStrategy(new CherryPickSelectionStrategy()));
  }

  return builder
    .configure((settings) => settings.setMaxTokensPerChangeBox(SAFE_MAX_CHANGE_TOKEN_LIMIT))
    .configureSelector((selector) => selector.orderBy((input) => input.creationHeight));
}

export async function setFee(
  builder: TransactionBuilder,
  fee: FeeSettings
): Promise<TransactionBuilder> {
  const isBabelFee = fee.tokenId !== ERG_TOKEN_ID;
  let feeNanoErgs = undecimalize(fee.value, ERG_DECIMALS);
  let sendingNanoErgs = BigNumber(builder.outputs.sum().nanoErgs.toString());

  if (isBabelFee) {
    const tokenUnits = undecimalize(fee.value, fee.assetInfo?.decimals);
    const selectedBox = selectBestBabelBox(
      await fetchBabelBoxes(fee.tokenId, fee.nanoErgsPerToken),
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
    if (
      sendingNanoErgs.gt(0) &&
      sendingNanoErgs.lte(MIN_BOX_VALUE) &&
      sendingNanoErgs.lte(feeNanoErgs.minus(SAFE_MIN_FEE_VALUE))
    ) {
      sendingNanoErgs = BigNumber(MIN_BOX_VALUE);
      feeNanoErgs = feeNanoErgs.minus(sendingNanoErgs);
    }

    builder.extend(
      BabelSwapPlugin(fee.box, { tokenId: fee.tokenId, amount: tokenUnits.toString() })
    );
  }

  builder.payFee(feeNanoErgs.toString());

  return builder;
}

function getSendingNanoErgs(assets: TxAssetAmount[]): BigNumber {
  const erg = assets.find((a) => a.asset.tokenId === ERG_TOKEN_ID);

  if (erg && erg.amount) {
    return undecimalize(erg.amount, ERG_DECIMALS);
  } else {
    return new BigNumber(0);
  }
}

export async function safeGetChangeAddress(recipientAddress = ""): Promise<string> {
  const wallet = store.state.currentWallet;
  const addresses = store.state.currentAddresses;

  if (wallet.settings.avoidAddressReuse) {
    const unused = addresses.find(
      (a) => a.state === AddressState.Unused && a.script !== recipientAddress
    );

    if (isEmpty(unused)) {
      await store.dispatch(ACTIONS.NEW_ADDRESS);
    }
  }

  const index = wallet.settings.avoidAddressReuse
    ? addresses.find((a) => a.state === AddressState.Unused && a.script !== recipientAddress)
        ?.index ?? wallet.settings.defaultChangeIndex
    : wallet.settings.defaultChangeIndex;

  return hdKeyPool.get(wallet.publicKey).deriveAddress(index || 0).script;
}
