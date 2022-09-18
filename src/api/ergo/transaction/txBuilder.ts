import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, MAINNET } from "@/constants/ergo";
import { ErgoBox, UnsignedTx } from "@/types/connector";
import { TxSignError } from "@/types/errors";
import { undecimalize } from "@/utils/bigNumbers";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { Address, BoxValue, ErgoBoxCandidates, I64, Tokens } from "ergo-lib-wasm-browser";
import { find } from "lodash";
import JSONBig from "json-bigint";
import Bip32 from "../bip32";
import { StateAsset } from "@/types/internal";

export type TxAssetAmount = {
  asset: StateAsset;
  amount?: BigNumber;
};

export class TxBuilder {
  private _to!: string;
  private _changeIndex!: number;
  private _fee!: BigNumber;
  private _assets!: TxAssetAmount[];
  private _inputs!: ErgoBox[];
  private _deriver!: Bip32;
  private _height!: number;

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

  public fee(fee: BigNumber): TxBuilder {
    this._fee = fee;
    return this;
  }

  public assets(assets: TxAssetAmount[]): TxBuilder {
    this._assets = assets;
    return this;
  }

  public inputs(inputs: ErgoBox[]): TxBuilder {
    this._inputs = inputs;
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
    const outputValue = this.getErgAmount();
    const tokens = this.buildTokenList();
    const txOutputs = this.buildOutputBoxes(outputValue, tokens, recipient, this._height);
    const fee = this.getFee();
    const boxSelector = new sigmaRust.SimpleBoxSelector();
    const targetBalance = sigmaRust.BoxValue.from_i64(
      outputValue.as_i64().checked_add(fee.as_i64())
    );
    const boxSelection = boxSelector.select(unspentBoxes, targetBalance, tokens);
    const wasmUnsigned = sigmaRust.TxBuilder.new(
      boxSelection,
      txOutputs,
      this._height,
      fee,
      changeAddress
    ).build();

    const unsigned = JSONBig.parse(wasmUnsigned.to_json());
    unsigned.inputs = this.hydrateInputs(unsigned.inputs);
    unsigned.dataInputs = this.hydrateInputs(unsigned.dataInputs);

    return unsigned;
  }

  /**
   * @param inputs Merge full box info with inputs
   */
  private hydrateInputs(inputs: { boxId: string }[]) {
    return inputs.map((x) => {
      const box = this._inputs.find((b) => b.boxId === x.boxId);
      return { ...x, ...box };
    });
  }

  private buildOutputBoxes(
    outputValue: BoxValue,
    tokens: Tokens,
    recipient: Address,
    height: number
  ): ErgoBoxCandidates {
    const builder = new wasmModule.SigmaRust.ErgoBoxCandidateBuilder(
      outputValue,
      wasmModule.SigmaRust.Contract.pay_to_address(recipient),
      height
    );

    for (let i = 0; i < tokens.len(); i++) {
      builder.add_token(tokens.get(i).id(), tokens.get(i).amount());
    }

    return new wasmModule.SigmaRust.ErgoBoxCandidates(builder.build());
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

  private getErgAmount(): BoxValue {
    const erg = find(this._assets, (a) => a.asset.tokenId === ERG_TOKEN_ID);
    if (
      !erg ||
      !erg.amount ||
      undecimalize(erg.amount, erg.asset.info?.decimals ?? 0).isLessThan(MIN_BOX_VALUE)
    ) {
      throw new TxSignError("not enought ERG to make a transaction");
    }

    return wasmModule.SigmaRust.BoxValue.from_i64(
      this.toI64(undecimalize(erg.amount, erg.asset.info?.decimals ?? 0))
    );
  }

  private getFee(): BoxValue {
    const sigmaRust = wasmModule.SigmaRust;
    return !this._fee || this._fee.isZero()
      ? sigmaRust.TxBuilder.SUGGESTED_TX_FEE()
      : sigmaRust.BoxValue.from_i64(this.toI64(undecimalize(this._fee, ERG_DECIMALS)));
  }

  private toI64(value: BigNumber): I64 {
    return wasmModule.SigmaRust.I64.from_str(value.toString());
  }
}
