import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE } from "@/constants/ergo";
import { UnsignedTx } from "@/types/connector";
import { TxSignError } from "@/types/errors";
import { ExplorerGetUnspentBox } from "@/types/explorer";
import { SendTxCommandAsset, StateAddress } from "@/types/internal";
import { removeDecimals } from "@/utils/bigNumbers";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import {
  Address,
  BoxValue,
  ErgoBoxCandidates,
  ErgoBoxes,
  I64,
  Tokens,
  UnsignedTransaction,
  Wallet
} from "ergo-lib-wasm-browser";
import { find } from "lodash";
import Bip32 from "../bip32";
import { SignContext } from "./signContext";
import JSONBig from "json-bigint";

export class Transaction {
  private _from!: StateAddress[];
  private _to!: string;
  private _change!: string;
  private _fee!: BigNumber;
  private _assets!: SendTxCommandAsset[];
  private _boxes!: ExplorerGetUnspentBox[];

  private constructor(from: StateAddress[]) {
    this._from = from;
  }

  public static from(addresses: StateAddress[]): Transaction {
    return new this(addresses);
  }

  public to(address: string): Transaction {
    this._to = address;
    return this;
  }

  public change(address: string): Transaction {
    this._change = address;
    return this;
  }

  public withFee(fee: BigNumber): Transaction {
    this._fee = fee;
    return this;
  }

  public withAssets(assets: SendTxCommandAsset[]): Transaction {
    this._assets = assets;
    return this;
  }

  public fromBoxes(boxes: ExplorerGetUnspentBox[]): Transaction {
    this._boxes = boxes;
    return this;
  }

  public signFromConnector(unsignedTx: UnsignedTx, context: SignContext): string {
    const sigmaRust = wasmModule.SigmaRust;
    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(unsignedTx.inputs);
    const tx = sigmaRust.UnsignedTransaction.from_json(JSONBig.stringify(unsignedTx));
    const signed = this._sign(tx, unspentBoxes, context);

    return signed.to_json();
  }

  public sign(context: SignContext): string {
    const sigmaRust = wasmModule.SigmaRust;

    const height = this._boxes[0]?.creationHeight || 0;
    const recipient = sigmaRust.Address.from_mainnet_str(this._to);
    const change_address = sigmaRust.Address.from_mainnet_str(this._change);

    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(this._boxes);
    const outputValue = this.getErgAmount();
    const tokens = this.buildTokenList();
    const tx_outputs = this.buildOutputBoxes(outputValue, tokens, recipient, height);
    const fee = this.getFee();
    const box_selector = new sigmaRust.SimpleBoxSelector();
    const target_balance = sigmaRust.BoxValue.from_i64(
      outputValue.as_i64().checked_add(fee.as_i64())
    );
    const box_selection = box_selector.select(unspentBoxes, target_balance, tokens);

    const unsigned = sigmaRust.TxBuilder.new(
      box_selection,
      tx_outputs,
      height,
      fee,
      change_address,
      sigmaRust.BoxValue.SAFE_USER_MIN()
    ).build();

    const signed = this._sign(unsigned, unspentBoxes, context);
    return signed.to_json();
  }

  private _sign(unsigned: UnsignedTransaction, unspentBoxes: ErgoBoxes, context: SignContext) {
    const sigmaRust = wasmModule.SigmaRust;

    const wallet = this.buildWallet(this._from, context.bip32);
    const blockHeaders = sigmaRust.BlockHeaders.from_json(context.blockHeaders);
    const preHeader = sigmaRust.PreHeader.from_block_header(blockHeaders.get(0));
    const signContext = new sigmaRust.ErgoStateContext(preHeader, blockHeaders);
    const signed = wallet.sign_transaction(
      signContext,
      unsigned,
      unspentBoxes,
      sigmaRust.ErgoBoxes.from_boxes_json([])
    );
    return signed;
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

  private buildWallet(addresses: StateAddress[], bip32: Bip32): Wallet {
    const sigmaRust = wasmModule.SigmaRust;
    const sks = new sigmaRust.SecretKeys();

    for (const address of addresses) {
      sks.add(sigmaRust.SecretKey.dlog_from_bytes(bip32.derivePrivateKey(address.index)));
    }
    return sigmaRust.Wallet.from_secrets(sks);
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
            this.toI64(removeDecimals(asset.amount, asset.asset.decimals))
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
      removeDecimals(erg.amount, erg.asset.decimals).isLessThan(MIN_BOX_VALUE)
    ) {
      throw new TxSignError("not enought ERG to make a transaction");
    }

    return wasmModule.SigmaRust.BoxValue.from_i64(
      this.toI64(removeDecimals(erg.amount, erg.asset.decimals))
    );
  }

  private getFee(): BoxValue {
    const sigmaRust = wasmModule.SigmaRust;
    return !this._fee || this._fee.isZero()
      ? sigmaRust.TxBuilder.SUGGESTED_TX_FEE()
      : sigmaRust.BoxValue.from_i64(this.toI64(removeDecimals(this._fee, ERG_DECIMALS)));
  }

  private toI64(value: BigNumber): I64 {
    return wasmModule.SigmaRust.I64.from_str(value.toString());
  }
}
