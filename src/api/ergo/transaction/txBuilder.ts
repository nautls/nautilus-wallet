import { graphQLService } from "@/api/explorer/graphQlService";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE } from "@/constants/ergo";
import { ACTIONS } from "@/constants/store";
import store from "@/store";
import { ErgoBox, UnsignedTx } from "@/types/connector";
import { AddressState, BigNumberType, FeeSettings, StateAsset, WalletType } from "@/types/internal";
import { undecimalize } from "@/utils/bigNumbers";
import { bip32Pool } from "@/utils/objectPool";
import {
  ErgoUnsignedInput,
  OutputBuilder,
  SByte,
  SColl,
  SConstant,
  SInt,
  TransactionBuilder
} from "@fleet-sdk/core";
import BigNumber from "bignumber.js";
import { isEmpty } from "lodash";
import { fetchBabelBoxes, getNanoErgsPerTokenRate, selectBestBabelBox } from "../babelFees";
import { fetchBoxes } from "../boxFetcher";
import { CherryPickSelectionStrategy } from "@fleet-sdk/core";

export type TxAssetAmount = {
  asset: StateAsset;
  amount?: BigNumberType;
};

export async function createConsolidationTransaction(
  boxes: ErgoBox[],
  creationHeight: number,
  walletType: WalletType
) {
  const unsigned = new TransactionBuilder(creationHeight)
    .from(boxes)
    .configureSelector((x) => x.ensureInclusion((input) => input.value > 0n))
    .sendChangeTo(await safeGetChangeAddress())
    .payMinFee();

  if (walletType === WalletType.Ledger) {
    unsigned
      .configure((settings) => settings.isolateErgOnChange().setMaxTokensPerChangeBox(1))
      .configureSelector((selector) => selector.defineStrategy(new CherryPickSelectionStrategy()));
  }

  return unsigned.build().toEIP12Object() as UnsignedTx;
}

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
}): Promise<UnsignedTx> {
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

  const isBabelFeeTransaction = fee.tokenId !== ERG_TOKEN_ID;
  const babelTokenUnitsAmount = isBabelFeeTransaction
    ? undecimalize(fee.value, fee.assetInfo?.decimals)
    : new BigNumber(0);

  let sendingNanoErgsAmount = getSendingNanoErgs(assets);
  let feeNanoErgsAmount: BigNumber;

  if (isBabelFeeTransaction) {
    const selectedBox = selectBestBabelBox(
      await fetchBabelBoxes(fee.tokenId, fee.nanoErgsPerToken),
      babelTokenUnitsAmount
    );

    if (!selectedBox) {
      throw Error(
        "There is not enough liquidity in the Babel Boxes for the selected fee asset in the selected price range."
      );
    } else {
      fee.box = selectedBox;
    }

    feeNanoErgsAmount = babelTokenUnitsAmount.multipliedBy(getNanoErgsPerTokenRate(selectedBox));
    if (sendingNanoErgsAmount.isLessThan(MIN_BOX_VALUE)) {
      sendingNanoErgsAmount = new BigNumber(MIN_BOX_VALUE);
      feeNanoErgsAmount = feeNanoErgsAmount.minus(sendingNanoErgsAmount);
    }
  } else {
    if (sendingNanoErgsAmount.isLessThan(MIN_BOX_VALUE)) {
      throw new Error("ERG not selected or less than the minimum required.");
    }
    feeNanoErgsAmount = undecimalize(fee.value, ERG_DECIMALS);
  }

  const output = new OutputBuilder(sendingNanoErgsAmount.toString(), recipientAddress).addTokens(
    assets
      .filter((a) => a.asset.tokenId !== ERG_TOKEN_ID && a.amount && !a.amount.isZero())
      .map((token) => ({
        tokenId: token.asset.tokenId,
        amount: undecimalize(
          token.amount || new BigNumber(0),
          token.asset.info?.decimals
        ).toString()
      }))
  );

  const unsignedTx = new TransactionBuilder(currentHeight)
    .from(inputs)
    .to(output)
    .payFee(feeNanoErgsAmount.toString())
    .sendChangeTo(await safeGetChangeAddress(recipientAddress));

  if (walletType === WalletType.Ledger) {
    unsignedTx
      .configure((settings) => settings.isolateErgOnChange().setMaxTokensPerChangeBox(1))
      .configureSelector((selector) => selector.defineStrategy(new CherryPickSelectionStrategy()));
  } else {
    unsignedTx.configureSelector((selector) => selector.orderBy((input) => input.creationHeight));
  }

  if (isBabelFeeTransaction && fee.box) {
    const nanoErgsChangeAmount = new BigNumber(fee.box.value).minus(
      babelTokenUnitsAmount.multipliedBy(getNanoErgsPerTokenRate(fee.box))
    );

    const babelInput = new ErgoUnsignedInput(fee.box).setContextVars({
      0: SConstant(SInt(unsignedTx.outputs.length))
    });

    unsignedTx.and
      .from(babelInput)
      .to(
        new OutputBuilder(nanoErgsChangeAmount.toString(), babelInput.ergoTree)
          .addTokens(fee.box.assets)
          .addTokens({
            tokenId: fee.tokenId,
            amount: babelTokenUnitsAmount.toString()
          })
          .setAdditionalRegisters({
            R4: babelInput.additionalRegisters.R4,
            R5: babelInput.additionalRegisters.R5,
            R6: SConstant(SColl(SByte, Buffer.from(babelInput.boxId, "hex")))
          })
      )
      .configureSelector((selector) =>
        selector.ensureInclusion((input) => input.boxId === babelInput.boxId)
      );
  }

  return unsignedTx.build().toEIP12Object() as UnsignedTx;
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

  return bip32Pool.get(wallet.publicKey).deriveAddress(index || 0).script;
}
