import { DERIVATION_PATH, ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE } from "@/constants/ergo";
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
  ErgoBox,
  ErgoBoxCandidates,
  ErgoBoxes,
  I64,
  Tokens,
  Transaction,
  UnsignedTransaction,
  Wallet
} from "ergo-lib-wasm-browser";
import { find, unset } from "lodash";
import Bip32 from "../bip32";
import { SignContext } from "./signContext";
import JSONBig from "json-bigint";
import HidTransport from "@ledgerhq/hw-transport-webhid";
import { BoxCandidate, ErgoLedgerApp, Token, UnsignedBox } from "ledgerjs-hw-app-ergo";

export class ErgoTransaction {
  private _from!: StateAddress[];
  private _to!: string;
  private _changeIndex!: number;
  private _fee!: BigNumber;
  private _assets!: SendTxCommandAsset[];
  private _boxes!: ExplorerGetUnspentBox[];
  private _useLedger!: boolean;

  private constructor(from: StateAddress[]) {
    this._from = from;
    this._useLedger = false;
  }

  public static from(addresses: StateAddress[]): ErgoTransaction {
    return new this(addresses);
  }

  public to(address: string): ErgoTransaction {
    this._to = address;
    return this;
  }

  public changeIndex(index: number): ErgoTransaction {
    this._changeIndex = index;
    return this;
  }

  public withFee(fee: BigNumber): ErgoTransaction {
    this._fee = fee;
    return this;
  }

  public withAssets(assets: SendTxCommandAsset[]): ErgoTransaction {
    this._assets = assets;
    return this;
  }

  public fromBoxes(boxes: ExplorerGetUnspentBox[]): ErgoTransaction {
    this._boxes = boxes;
    return this;
  }

  public useLedger(use = true): ErgoTransaction {
    this._useLedger = use;
    return this;
  }

  public async signFromConnector(unsignedTx: UnsignedTx, context: SignContext): Promise<string> {
    const sigmaRust = wasmModule.SigmaRust;
    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(unsignedTx.inputs);
    const tx = sigmaRust.UnsignedTransaction.from_json(JSONBig.stringify(unsignedTx));
    const signed = await this._sign(tx, unspentBoxes, context);

    return signed.to_json();
  }

  public async sign(context: SignContext): Promise<string> {
    const sigmaRust = wasmModule.SigmaRust;

    const height = this._boxes[0]?.creationHeight || 0;
    const recipient = sigmaRust.Address.from_mainnet_str(this._to);
    const changeAddress = sigmaRust.Address.from_mainnet_str(
      context.bip32.deriveAddress(this._changeIndex).script
    );

    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(this._boxes);
    const outputValue = this.getErgAmount();
    const tokens = this.buildTokenList();
    const txOutputs = this.buildOutputBoxes(outputValue, tokens, recipient, height);
    const fee = this.getFee();
    const box_selector = new sigmaRust.SimpleBoxSelector();
    const targetBalance = sigmaRust.BoxValue.from_i64(
      outputValue.as_i64().checked_add(fee.as_i64())
    );
    const box_selection = box_selector.select(unspentBoxes, targetBalance, tokens);

    const unsigned = sigmaRust.TxBuilder.new(
      box_selection,
      txOutputs,
      height,
      fee,
      changeAddress,
      sigmaRust.BoxValue.SAFE_USER_MIN()
    ).build();

    const signed = await this._sign(unsigned, unspentBoxes, context);
    return signed.to_json();
  }

  private async _sign(
    unsigned: UnsignedTransaction,
    unspentBoxes: ErgoBoxes,
    context: SignContext
  ): Promise<Transaction> {
    const sigmaRust = wasmModule.SigmaRust;

    if (this._useLedger) {
      const ledgerApp = new ErgoLedgerApp(await HidTransport.create());
      try {
        const inputs: UnsignedBox[] = [];
        const outputs: BoxCandidate[] = [];

        for (let i = 0; i < unsigned.inputs().len(); i++) {
          const input = unsigned.inputs().get(i);
          const wasmBox = findBox(unspentBoxes, input.box_id().to_str());
          const box = find(this._boxes, (b) => b.id === input.box_id().to_str());
          if (!wasmBox || !box) {
            throw Error(`Input ${input.box_id().to_str()} not found in unspent boxes.`);
          }
          console.log(box.id);
          inputs.push({
            txId: box.txId,
            index: box.index,
            value: wasmBox.value().as_i64().to_str(),
            ergoTree: Buffer.from(wasmBox.ergo_tree().sigma_serialize_bytes()),
            creationHeight: wasmBox.creation_height(),
            tokens: mapTokens(wasmBox.tokens()),
            additionalRegisters: Buffer.from(wasmBox.serialized_additional_registers()),
            extension: Buffer.from(input.extension().sigma_serialize_bytes())
          });
        }

        for (let i = 0; i < unsigned.output_candidates().len(); i++) {
          const wasmOutput = unsigned.output_candidates().get(i);

          outputs.push({
            value: wasmOutput.value().as_i64().to_str(),
            ergoTree: Buffer.from(wasmOutput.ergo_tree().sigma_serialize_bytes()),
            creationHeight: wasmOutput.creation_height(),
            tokens: mapTokens(wasmOutput.tokens()),
            registers: Buffer.from([]) // todo: try to find out the right way to do that
          });
        }

        const signatures = await ledgerApp.signTx(
          {
            inputs,
            dataInputs: [],
            outputs,
            changeMap: {
              address: context.bip32.deriveAddress(this._changeIndex).script,
              path: `${DERIVATION_PATH}/${this._changeIndex}`
            },
            signPaths: this._from.map((a) => `${DERIVATION_PATH}/${a.index}`)
          },
          true
        );

        return wasmModule.SigmaRust.Transaction.from_unsigned_tx(
          unsigned,
          signatures.map((s) => Buffer.from(s.signature, "hex"))
        );
      } catch (e) {
        throw e;
      } finally {
        ledgerApp.transport.close();
      }
    }

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

function findBox(wasmBoxes: ErgoBoxes, boxId: string): ErgoBox | undefined {
  for (let i = 0; i < wasmBoxes.len(); i++) {
    if (wasmBoxes.get(i).box_id().to_str() === boxId) {
      return wasmBoxes.get(i);
    }
  }
}

function mapTokens(wasmTokens: Tokens): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < wasmTokens.len(); i++) {
    tokens.push({
      id: wasmTokens.get(i).id().to_str(),
      amount: wasmTokens.get(i).amount().as_i64().to_str()
    });
  }

  return tokens;
}
