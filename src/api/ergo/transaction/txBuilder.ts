import {
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  MAINNET,
  MIN_BOX_VALUE,
  SAFE_MIN_FEE_VALUE
} from "@/constants/ergo";
import { ErgoBox, UnsignedInput, UnsignedTx } from "@/types/connector";
import { TxSignError } from "@/types/errors";
import { BigNumberType, FeeSettings, StateAsset } from "@/types/internal";
import { undecimalize } from "@/utils/bigNumbers";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import {
  Address,
  BoxValue,
  ErgoBoxAssetsDataList,
  ErgoBoxCandidate,
  ErgoBoxes,
  ErgoTree,
  I64,
  Tokens
} from "ergo-lib-wasm-browser";
import JSONBig from "json-bigint";
import { find, isEmpty, sortBy } from "lodash";
import { getNanoErgsPerTokenRate, isBabelErgoTree } from "../babelFees";
import Bip32 from "../bip32";

export type TxAssetAmount = {
  asset: StateAsset;
  amount?: BigNumberType;
};

export class TxBuilder {
  private _to!: string;
  private _changeIndex!: number;
  private _fee!: FeeSettings;
  private _assets!: TxAssetAmount[];
  private _inputs!: ErgoBox[];
  private _deriver!: Bip32;
  private _height!: number;

  private get hasBabelFee(): boolean {
    return this._fee?.tokenId !== ERG_TOKEN_ID;
  }

  public constructor(deriver: Bip32) {
    this._deriver = deriver;
  }

  public to(address: string): TxBuilder {
    this._to = address;
    return this;
  }

  public changeIndex(index: number): TxBuilder {
    this._changeIndex = index;
    return this;
  }

  public fee(fee: FeeSettings): TxBuilder {
    this._fee = fee;

    if (this.hasBabelFee && this._fee?.box) {
      this._inputs.push(this._fee.box);
    }
    return this;
  }

  public assets(assets: TxAssetAmount[]): TxBuilder {
    this._assets = assets;
    return this;
  }

  public inputs(inputs: ErgoBox[]): TxBuilder {
    this._inputs = inputs;

    if (this.hasBabelFee && this._fee?.box) {
      this._inputs.push(this._fee.box);
    }
    return this;
  }

  public height(height: number): TxBuilder {
    this._height = height;
    return this;
  }

  public build(): UnsignedTx {
    const sigmaRust = wasmModule.SigmaRust;
    const recipient = MAINNET
      ? sigmaRust.Address.from_mainnet_str(this._to)
      : sigmaRust.Address.from_testnet_str(this._to);
    const changeAddress = MAINNET
      ? sigmaRust.Address.from_mainnet_str(this._deriver.deriveAddress(this._changeIndex).script)
      : sigmaRust.Address.from_testnet_str(this._deriver.deriveAddress(this._changeIndex).script);

    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(this._inputs);
    const userOutputValue = sigmaRust.BoxValue.from_i64(
      this.toI64(this.getNanoErgsSendingAmount())
    );
    let userOutputTokens = this.buildTokenList();
    const userOutput = this.buildOutput(userOutputValue, userOutputTokens, recipient, this._height);

    const outputs = new sigmaRust.ErgoBoxCandidates(userOutput);

    let target = this.getNanoErgsSendingAmount();
    if (!this.hasBabelFee) {
      target = target.plus(this.getNanoErgsFee());
    } else {
      userOutputTokens.add(
        new sigmaRust.Token(
          sigmaRust.TokenId.from_str(this._fee.tokenId),
          sigmaRust.TokenAmount.from_i64(this.toI64(this.getTokenUnitsFeeValue()!))
        )
      );
    }

    if (this.hasBabelFee && this._fee.box) {
      const box = this._fee.box;
      const rate = getNanoErgsPerTokenRate(box);
      const tokenUnitsAmount = undecimalize(this._fee.value, this._fee.assetInfo?.decimals ?? 0);
      const nanoErgs = tokenUnitsAmount.multipliedBy(rate);
      const newBoxValue = new BigNumber(box.value).minus(nanoErgs);

      target = target.plus(box.value);
      if (!this.hasErgSelected()) {
        target = target.minus(MIN_BOX_VALUE);
      }

      const builder = new wasmModule.SigmaRust.ErgoBoxCandidateBuilder(
        sigmaRust.BoxValue.from_i64(this.toI64(newBoxValue)),
        wasmModule.SigmaRust.Contract.new(ErgoTree.from_base16_bytes(box.ergoTree)),
        this._height
      );

      if (isEmpty(box.assets)) {
        builder.add_token(
          sigmaRust.TokenId.from_str(this._fee.tokenId),
          sigmaRust.TokenAmount.from_i64(this.toI64(tokenUnitsAmount))
        );
      } else {
        for (const asset of box.assets) {
          builder.add_token(
            sigmaRust.TokenId.from_str(asset.tokenId),
            sigmaRust.TokenAmount.from_i64(
              this.toI64(
                asset.tokenId === this._fee.tokenId
                  ? new BigNumber(asset.amount).plus(tokenUnitsAmount)
                  : new BigNumber(asset.amount)
              )
            )
          );

          userOutputTokens.add(
            new sigmaRust.Token(
              sigmaRust.TokenId.from_str(this._fee.tokenId),
              sigmaRust.TokenAmount.from_i64(this.toI64(new BigNumber(asset.amount)))
            )
          );
        }
      }

      builder.set_register_value(
        sigmaRust.NonMandatoryRegisterId.R4,
        sigmaRust.Constant.decode_from_base16(box.additionalRegisters.R4)
      );

      builder.set_register_value(
        sigmaRust.NonMandatoryRegisterId.R5,
        sigmaRust.Constant.decode_from_base16(box.additionalRegisters.R5)
      );

      outputs.add(builder.build());
    }

    let boxSelection = new sigmaRust.SimpleBoxSelector().select(
      unspentBoxes,
      sigmaRust.BoxValue.from_i64(this.toI64(target)),
      userOutputTokens
    );

    if (this.hasBabelFee && !this.isBabelBoxIncluded(boxSelection.boxes()) && this._fee?.box) {
      const inputs = this.addArbitraryBox(boxSelection.boxes(), this._fee.box);
      const change = this.recalculateChange(boxSelection.change(), this._fee.box);
      boxSelection = new sigmaRust.BoxSelection(inputs, change);
    }

    const fee = sigmaRust.BoxValue.from_i64(this.toI64(this.getNanoErgsFee()));
    const wasmUnsigned = sigmaRust.TxBuilder.new(
      boxSelection,
      outputs,
      this._height,
      fee,
      changeAddress,
      sigmaRust.BoxValue.SAFE_USER_MIN()
    ).build();

    const unsigned = JSONBig.parse(wasmUnsigned.to_json()) as UnsignedTx;

    if (this.hasBabelFee) {
      let index = unsigned.inputs.findIndex((x) => x.boxId === this._fee.box?.boxId);
      if (index === -1) {
        throw new Error("Malformed transaction. Babel box is not included in the inputs.");
      }

      if (index !== unsigned.inputs.length - 1) {
        unsigned.inputs.splice(unsigned.inputs.length - 1, 0, unsigned.inputs.splice(index, 1)[0]);
      }

      const penultimateIndex = unsigned.outputs.length - 2;
      index = unsigned.outputs.findIndex((output) => isBabelErgoTree(output.ergoTree));
      if (index === -1) {
        throw new Error("Malformed transaction. Babel output is not included in the outputs.");
      }

      unsigned.outputs.splice(penultimateIndex, 0, unsigned.outputs.splice(index, 1)[0]);
    }

    unsigned.inputs = this.hydrateInputs(unsigned.inputs) as UnsignedInput[];
    unsigned.dataInputs = this.hydrateInputs(unsigned.dataInputs);
    console.log(unsigned);
    return unsigned;
  }

  private isBabelBoxIncluded(boxes: ErgoBoxes): boolean {
    if (!this._fee?.box) {
      return false;
    }

    const boxId = this._fee.box.boxId;
    for (let i = 0; i < boxes.len(); i++) {
      if (boxes.get(i).box_id().to_str() === boxId) {
        return true;
      }
    }

    return false;
  }

  private hasErgSelected(): boolean {
    return find(this._assets, (a) => a.asset.tokenId === ERG_TOKEN_ID) != undefined;
  }

  private recalculateChange(change: ErgoBoxAssetsDataList, box: ErgoBox) {
    if (change.len() === 0) {
      return change;
    }

    const sigmaRust = wasmModule.SigmaRust;
    const newChange = new sigmaRust.ErgoBoxAssetsDataList();
    for (let i = 0; i < change.len(); i++) {
      if (i > 0) {
        newChange.add(change.get(i));
        continue;
      }

      const value = sigmaRust.BoxValue.from_i64(
        change.get(i).value().as_i64().checked_add(sigmaRust.I64.from_str(box.value))
      );

      const tokens = change.get(i).tokens();
      for (const asset of box.assets) {
        tokens.add(
          new sigmaRust.Token(
            sigmaRust.TokenId.from_str(asset.tokenId),
            sigmaRust.TokenAmount.from_i64(sigmaRust.I64.from_str(asset.amount.toString()))
          )
        );
      }
      newChange.add(new sigmaRust.ErgoBoxAssetsData(value, tokens));
    }

    return newChange;
  }

  private addArbitraryBox(inputs: ErgoBoxes, box: ErgoBox): ErgoBoxes {
    inputs.add(wasmModule.SigmaRust.ErgoBox.from_json(JSONBig.stringify(box)));
    return inputs;
  }

  /**
   * @param inputs Merge full box info with inputs
   */
  private hydrateInputs(inputs: { boxId: string }[]) {
    if (isEmpty(inputs)) {
      return [];
    }

    return inputs.map((x) => {
      let box = this._inputs.find((b) => b.boxId === x.boxId);
      return { ...x, ...box };
    });
  }

  private buildOutput(
    outputValue: BoxValue,
    tokens: Tokens,
    recipient: Address,
    height: number
  ): ErgoBoxCandidate {
    const builder = new wasmModule.SigmaRust.ErgoBoxCandidateBuilder(
      outputValue,
      wasmModule.SigmaRust.Contract.pay_to_address(recipient),
      height
    );

    for (let i = 0; i < tokens.len(); i++) {
      builder.add_token(tokens.get(i).id(), tokens.get(i).amount());
    }

    return builder.build();
  }

  private buildTokenList(): Tokens {
    const tokens = new wasmModule.SigmaRust.Tokens();
    if (!find(this._assets, (a) => a.asset.tokenId !== ERG_TOKEN_ID)) {
      return tokens;
    }
    const sigmaRust = wasmModule.SigmaRust;

    for (const asset of this._assets.filter((x) => x.asset.tokenId !== ERG_TOKEN_ID)) {
      if (!asset.amount || asset.amount.isLessThanOrEqualTo(0)) {
        continue;
      }

      tokens.add(
        new sigmaRust.Token(
          sigmaRust.TokenId.from_str(asset.asset.tokenId),
          sigmaRust.TokenAmount.from_i64(
            this.toI64(undecimalize(asset.amount, asset.asset.info?.decimals ?? 0))
          )
        )
      );
    }

    return tokens;
  }

  private getSelectedNanoErgs(): BigNumber | undefined {
    const erg = find(this._assets, (a) => a.asset.tokenId === ERG_TOKEN_ID);
    return erg && erg.amount ? undecimalize(erg.amount, ERG_DECIMALS) : undefined;
  }

  private getTokenUnitsFeeValue(): BigNumber | undefined {
    if (!this.hasBabelFee) {
      return;
    }

    return undecimalize(this._fee.value, this._fee.assetInfo?.decimals || 0);
  }

  private getNanoErgsSendingAmount(): BigNumber {
    const nanoErgs = this.getSelectedNanoErgs();

    if (!nanoErgs || nanoErgs.isLessThan(MIN_BOX_VALUE)) {
      if (this.hasBabelFee) {
        return new BigNumber(MIN_BOX_VALUE);
      }

      throw new TxSignError("Not enough ERG to make a transaction.");
    }

    return nanoErgs;
  }

  private getNanoErgsFee(): BigNumber {
    if (this.hasBabelFee && this._fee.box) {
      const rate = getNanoErgsPerTokenRate(this._fee.box);
      const nanoErgs = undecimalize(
        this._fee.value,
        this._fee.assetInfo?.decimals || 0
      ).multipliedBy(rate);

      const sendingNanoErgs = this.getSelectedNanoErgs();
      if (!sendingNanoErgs || sendingNanoErgs.isLessThan(MIN_BOX_VALUE)) {
        return nanoErgs.minus(MIN_BOX_VALUE);
      }

      return nanoErgs;
    }

    return !this._fee?.value || this._fee.value.isZero()
      ? new BigNumber(SAFE_MIN_FEE_VALUE)
      : undecimalize(this._fee.value, ERG_DECIMALS);
  }

  private toI64(value: BigNumber): I64 {
    return wasmModule.SigmaRust.I64.from_str(value.toString());
  }
}
