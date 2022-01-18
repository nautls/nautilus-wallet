import { ERG_TOKEN_ID, MIN_BOX_VALUE } from "@/constants/ergo";
import { IDbAddress } from "@/types/database";
import { ExplorergetUnspentBox } from "@/types/explorer";
import { SendTxCommandAsset, StateAddress } from "@/types/internal";
import { removeDecimals } from "@/utils/bigNumbers";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { BoxValue, SecretKeys, Tokens, Wallet } from "ergo-lib-wasm-browser";
import { find, forEach } from "lodash";
import Bip32 from "../bip32";
import { SignContext } from "./signContext";

export class Transaction {
  private _from!: StateAddress[];
  private _to!: string;
  private _change!: string;
  private _fee!: BigNumber;
  private _assets!: SendTxCommandAsset[];
  private _boxes!: ExplorergetUnspentBox[];

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

  public fromBoxes(boxes: ExplorergetUnspentBox[]): Transaction {
    this._boxes = boxes;
    return this;
  }

  public sign(context: SignContext): string {
    const sigmaRust = wasmModule.SigmaRust;

    const currentHeight = this._boxes[0]?.creationHeight || 0;
    const recipient = sigmaRust.Address.from_mainnet_str(this._to);
    const change_address = sigmaRust.Address.from_mainnet_str(this._change);

    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(this._boxes);
    const outboxValue = this.getErgAmount();
    const tokens = this.buildTokenList();
    const outboxBuilder = new sigmaRust.ErgoBoxCandidateBuilder(
      outboxValue,
      sigmaRust.Contract.pay_to_address(recipient),
      currentHeight
    );

    for (let i = 0; i < tokens.len(); i++) {
      outboxBuilder.add_token(tokens.get(i).id(), tokens.get(i).amount());
    }

    const tx_outputs = new sigmaRust.ErgoBoxCandidates(outboxBuilder.build());

    const fee = this.getFee();

    const box_selector = new sigmaRust.SimpleBoxSelector();
    const target_balance = sigmaRust.BoxValue.from_i64(
      outboxValue.as_i64().checked_add(fee.as_i64())
    );
    const box_selection = box_selector.select(unspentBoxes, target_balance, tokens);
    const unsigned = sigmaRust.TxBuilder.new(
      box_selection,
      tx_outputs,
      currentHeight,
      fee,
      change_address,
      sigmaRust.BoxValue.SAFE_USER_MIN()
    ).build();

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

    return signed.to_json();
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
    if (!find(this._assets, a => a.asset.tokenId !== ERG_TOKEN_ID)) {
      return tokens;
    }

    for (const asset of this._assets.filter(x => x.asset.tokenId !== ERG_TOKEN_ID)) {
      if (!asset.amount || asset.amount.isLessThanOrEqualTo(0)) {
        continue;
      }

      tokens.add(
        new wasmModule.SigmaRust.Token(
          wasmModule.SigmaRust.TokenId.from_str(asset.asset.tokenId),
          wasmModule.SigmaRust.TokenAmount.from_i64(
            wasmModule.SigmaRust.I64.from_str(
              removeDecimals(asset.amount, asset.asset.decimals).toString()
            )
          )
        )
      );
    }

    return tokens;
  }

  private getErgAmount(): BoxValue {
    const erg = find(this._assets, a => a.asset.tokenId === ERG_TOKEN_ID);
    if (
      !erg ||
      !erg.amount ||
      removeDecimals(erg.amount, erg.asset.decimals).isLessThan(MIN_BOX_VALUE)
    ) {
      throw Error("not enought ERG to make a transaction");
    }

    return wasmModule.SigmaRust.BoxValue.from_i64(
      wasmModule.SigmaRust.I64.from_str(removeDecimals(erg.amount, erg.asset.decimals).toString())
    );
  }

  private getFee(): BoxValue {
    const sigmaRust = wasmModule.SigmaRust;
    return !this._fee || this._fee.isZero()
      ? sigmaRust.TxBuilder.SUGGESTED_TX_FEE()
      : sigmaRust.BoxValue.from_i64(sigmaRust.I64.from_str(this._fee.toString()));
  }
}
