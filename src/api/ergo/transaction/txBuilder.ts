import {
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  MAINNET,
  MIN_BOX_VALUE,
  SAFE_MIN_FEE_VALUE
} from "@/constants/ergo";
import { ErgoBox, UnsignedInput, UnsignedTx } from "@/types/connector";
import { TxSignError } from "@/types/errors";
import { explorerBoxMapper } from "@/types/explorer";
import { BigNumberType, FeeSettings, StateAsset } from "@/types/internal";
import { undecimalize } from "@/utils/bigNumbers";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { Address, BoxValue, ErgoBoxCandidate, ErgoTree, I64, Tokens } from "ergo-lib-wasm-browser";
import JSONBig from "json-bigint";
import { find, isEmpty } from "lodash";
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

  private readonly hasBabelFee = this._fee?.tokenId !== ERG_TOKEN_ID;

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
      this._inputs.push(explorerBoxMapper({ asConfirmed: true })(this._fee.box));
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
      this._inputs.push(explorerBoxMapper({ asConfirmed: true })(this._fee.box));
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
    const userOutputValue = sigmaRust.BoxValue.from_i64(this.toI64(this.getNanoErgsAmount()));
    const userOutputTokens = this.buildTokenList();
    const userOutput = this.buildOutput(userOutputValue, userOutputTokens, recipient, this._height);

    const outputs = new sigmaRust.ErgoBoxCandidates(userOutput);

    let target = this.getNanoErgsAmount().plus(this.getNanoErgFee());
    if (this.hasBabelFee && this._fee.box) {
      const box = this._fee.box;
      const rate = getNanoErgsPerTokenRate(box);
      const nanoErgs = undecimalize(
        this._fee.value,
        this._fee.assetInfo?.decimals || 0
      ).multipliedBy(rate);

      const newBoxValue = new BigNumber(box.value).minus(nanoErgs);
      target = target.plus(newBoxValue);

      const builder = new wasmModule.SigmaRust.ErgoBoxCandidateBuilder(
        sigmaRust.BoxValue.from_i64(this.toI64(newBoxValue)),
        wasmModule.SigmaRust.Contract.new(ErgoTree.from_base16_bytes(box.ergoTree)),
        this._height
      );

      let tokenUnitsAmount = undecimalize(this._fee.value, this._fee.assetInfo?.decimals ?? 0);
      if (isEmpty(box.assets)) {
        builder.add_token(
          sigmaRust.TokenId.from_str(this._fee.tokenId),
          sigmaRust.TokenAmount.from_i64(this.toI64(tokenUnitsAmount))
        );
      } else {
        for (const asset of box.assets) {
          tokenUnitsAmount =
            asset.tokenId === this._fee.tokenId
              ? new BigNumber(asset.amount).plus(tokenUnitsAmount)
              : new BigNumber(asset.amount);

          builder.add_token(
            sigmaRust.TokenId.from_str(asset.tokenId),
            sigmaRust.TokenAmount.from_i64(this.toI64(tokenUnitsAmount))
          );
        }
      }

      userOutputTokens.add(
        new sigmaRust.Token(
          sigmaRust.TokenId.from_str(this._fee.tokenId),
          sigmaRust.TokenAmount.from_i64(this.toI64(tokenUnitsAmount))
        )
      );

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

    const fee = sigmaRust.BoxValue.from_i64(this.toI64(this.getNanoErgFee()));
    const boxSelection = new sigmaRust.SimpleBoxSelector().select(
      unspentBoxes,
      sigmaRust.BoxValue.from_i64(this.toI64(target)),
      userOutputTokens
    );

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
      if (!find(unsigned.inputs, (x) => x.boxId === this._fee.box?.id)) {
        console.log(unsigned);
        throw new Error("Malformed transaction. Babel box is not included in the inputs.");
      }

      const penultimateIndex = unsigned.outputs.length - 2;
      const babelIndex = unsigned.outputs.findIndex((output) => isBabelErgoTree(output.ergoTree));
      if (babelIndex === -1) {
        throw new Error("Malformed transaction. Babel output is not included in the outputs.");
      }

      unsigned.outputs.splice(penultimateIndex, 0, unsigned.outputs.splice(babelIndex, 1)[0]);
    }

    unsigned.inputs = this.hydrateInputs(unsigned.inputs) as UnsignedInput[];
    unsigned.dataInputs = this.hydrateInputs(unsigned.dataInputs);
    console.log(unsigned);
    return unsigned;
  }

  /**
   * @param inputs Merge full box info with inputs
   */
  private hydrateInputs(inputs: { boxId: string }[]) {
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

    // if (this.hasBabelFee && this._fee.box) {
    //   const token = this._fee.box.assets.find((asset) => asset.tokenId === this._fee.tokenId);

    //   tokens.add(
    //     new sigmaRust.Token(
    //       sigmaRust.TokenId.from_str(this._fee.tokenId),
    //       sigmaRust.TokenAmount.from_i64(
    //         this.toI64(
    //           undecimalize(this._fee.value, this._fee.assetInfo?.decimals ?? 0).plus(
    //             token?.amount || 0
    //           )
    //         )
    //       )
    //     )
    //   );
    // }

    return tokens;
  }

  private getNanoErgsAmount(): BigNumber {
    // if (this.hasBabelFee && this._fee.box) {
    //   const nanoErgs = new BigNumber(this._fee.box?.value)
    //     // .plus(selectedNanoErs)
    //     .minus(this.getNanoErgFee());

    //   return wasmModule.SigmaRust.BoxValue.from_i64(I64.from_str(nanoErgs.toString()));
    // }
    const erg = find(this._assets, (a) => a.asset.tokenId === ERG_TOKEN_ID);
    const nanoErgs = erg && erg.amount ? undecimalize(erg.amount, ERG_DECIMALS) : undefined;
    const sigmaRust = wasmModule.SigmaRust;

    if (!nanoErgs || nanoErgs.isLessThan(MIN_BOX_VALUE)) {
      if (this.hasBabelFee) {
        return new BigNumber(MIN_BOX_VALUE);
      }

      throw new TxSignError("Not enough ERG to make a transaction.");
    }

    return nanoErgs;
  }

  private getNanoErgFee(): BigNumber {
    if (this.hasBabelFee && this._fee.box) {
      const rate = getNanoErgsPerTokenRate(this._fee.box);
      const nanoErgs = undecimalize(this._fee.value, this._fee.assetInfo?.decimals || 0)
        .multipliedBy(rate)
        .minus(MIN_BOX_VALUE);

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
