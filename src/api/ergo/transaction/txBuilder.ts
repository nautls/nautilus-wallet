import { DERIVATION_PATH, ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE } from "@/constants/ergo";
import { ErgoBox, ErgoTx, UnsignedTx } from "@/types/connector";
import { TxSignError } from "@/types/errors";
import { SendTxCommandAsset, StateAddress } from "@/types/internal";
import { undecimalize } from "@/utils/bigNumbers";
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
  Wallet,
  ErgoBox as WasmErgoBox
} from "ergo-lib-wasm-browser";
import { find, maxBy } from "lodash";
import Bip32 from "../bip32";
import { SignContext } from "./signContext";
import JSONBig from "json-bigint";
import HidTransport from "@ledgerhq/hw-transport-webhid";
import { BoxCandidate, DeviceError, ErgoLedgerApp, Token, UnsignedBox } from "ledgerjs-hw-app-ergo";
import { LedgerDeviceModelId, LedgerState, LEDGER_RETURN_CODE } from "@/constants/ledger";

export class TxBuilder {
  private _from!: StateAddress[];
  private _to!: string;
  private _changeIndex!: number;
  private _fee!: BigNumber;
  private _assets!: SendTxCommandAsset[];
  private _boxes!: ErgoBox[];
  private _useLedger!: boolean;
  private _callbackFunc?: (newVal: any) => {};

  private constructor(from: StateAddress[]) {
    this._from = from;
    this._useLedger = false;
  }

  public static from(addresses: StateAddress[]): TxBuilder {
    return new this(addresses);
  }

  public to(address: string): TxBuilder {
    this._to = address;
    return this;
  }

  public changeIndex(index: number): TxBuilder {
    this._changeIndex = index;
    return this;
  }

  public withFee(fee: BigNumber): TxBuilder {
    this._fee = fee;
    return this;
  }

  public withAssets(assets: SendTxCommandAsset[]): TxBuilder {
    this._assets = assets;
    return this;
  }

  public fromBoxes(boxes: ErgoBox[]): TxBuilder {
    this._boxes = boxes;
    return this;
  }

  public setCallback(callback?: (newState: any) => {}): TxBuilder {
    if (callback) {
      this._callbackFunc = callback;
    }

    return this;
  }

  public useLedger(use = true): TxBuilder {
    this._useLedger = use;
    return this;
  }

  public async signFromConnector(unsignedTx: UnsignedTx, context: SignContext): Promise<string> {
    const sigmaRust = wasmModule.SigmaRust;
    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(unsignedTx.inputs);
    const dataInputBoxes = sigmaRust.ErgoBoxes.from_boxes_json(unsignedTx.dataInputs);
    const tx = sigmaRust.UnsignedTransaction.from_json(JSONBig.stringify(unsignedTx));
    const signed = await this._sign(tx, unspentBoxes, dataInputBoxes, context);

    return signed.to_json();
  }

  public async sign(context: SignContext): Promise<ErgoTx> {
    const sigmaRust = wasmModule.SigmaRust;
    const lastBlockHeader = maxBy(context.blockHeaders, (h) => h.height);
    const height = lastBlockHeader!.height;
    const recipient = sigmaRust.Address.from_mainnet_str(this._to);
    const changeAddress = sigmaRust.Address.from_mainnet_str(
      context.bip32.deriveAddress(this._changeIndex).script
    );

    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(this._boxes);
    const outputValue = this.getErgAmount();
    const tokens = this.buildTokenList();
    const txOutputs = this.buildOutputBoxes(outputValue, tokens, recipient, height);
    const fee = this.getFee();
    const boxSelector = new sigmaRust.SimpleBoxSelector();
    const targetBalance = sigmaRust.BoxValue.from_i64(
      outputValue.as_i64().checked_add(fee.as_i64())
    );
    const boxSelection = boxSelector.select(unspentBoxes, targetBalance, tokens);
    const unsigned = sigmaRust.TxBuilder.new(
      boxSelection,
      txOutputs,
      height,
      fee,
      changeAddress,
      sigmaRust.BoxValue.SAFE_USER_MIN()
    ).build();

    const signed = await this._sign(
      unsigned,
      unspentBoxes,
      sigmaRust.ErgoBoxes.from_boxes_json([]),
      context
    );

    return JSONBig.parse(signed.to_json());
  }

  private async _sign(
    unsigned: UnsignedTransaction,
    unspentBoxes: ErgoBoxes,
    dataInputBoxes: ErgoBoxes,
    context: SignContext
  ) {
    const sigmaRust = wasmModule.SigmaRust;

    if (this._useLedger) {
      let ledgerApp!: ErgoLedgerApp;

      try {
        ledgerApp = new ErgoLedgerApp(await HidTransport.create());
        this.sendCallback({
          connected: true,
          appId: ledgerApp.authToken,
          deviceModel: ledgerApp.transport.deviceModel?.id.toString() ?? LedgerDeviceModelId.nanoX
        });
      } catch (e) {
        this.sendCallback({
          connected: false,
          loading: false,
          state: LedgerState.deviceNotFound
        });

        throw e;
      }

      try {
        const inputs: UnsignedBox[] = [];
        const outputs: BoxCandidate[] = [];

        for (let i = 0; i < unsigned.inputs().len(); i++) {
          const input = unsigned.inputs().get(i);
          const wasmBox = findBox(unspentBoxes, input.box_id().to_str());
          const box = find(this._boxes, (b) => b.boxId === input.box_id().to_str());
          if (!wasmBox || !box) {
            throw Error(`Input ${input.box_id().to_str()} not found in unspent boxes.`);
          }
          inputs.push({
            txId: box.transactionId,
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

        this.sendCallback({
          statusText: "Waiting for device transaction signing confirmation..."
        });
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

        this.sendCallback({
          screenText: "Signed",
          statusText: "Sending transaction..."
        });

        return wasmModule.SigmaRust.Transaction.from_unsigned_tx(
          unsigned,
          signatures.map((s) => Buffer.from(s.signature, "hex"))
        );
      } catch (e) {
        if (e instanceof DeviceError) {
          const resp = {
            loading: false,
            state: LedgerState.error,
            statusText: ""
          };

          switch (e.code) {
            case LEDGER_RETURN_CODE.DENIED:
              resp.statusText = "Transaction signing denied.";
              break;
            case LEDGER_RETURN_CODE.INTERNAL_CRYPTO_ERROR:
              resp.statusText =
                "It looks like your device is locked. Make sure it is unlocked before proceeding.";
              break;
            default:
              resp.statusText = `[Device error] ${e.message}`;
          }

          this.sendCallback(resp);
        }

        throw e;
      } finally {
        ledgerApp.transport.close();
      }
    }

    const wallet = this.buildWallet(this._from, context.bip32);
    const blockHeaders = sigmaRust.BlockHeaders.from_json(context.blockHeaders);
    const preHeader = sigmaRust.PreHeader.from_block_header(blockHeaders.get(0));
    const signContext = new sigmaRust.ErgoStateContext(preHeader, blockHeaders);
    const signed = wallet.sign_transaction(signContext, unsigned, unspentBoxes, dataInputBoxes);
    return signed;
  }

  private sendCallback(state: any) {
    if (!this._callbackFunc) {
      return;
    }

    this._callbackFunc(state);
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

function findBox(wasmBoxes: ErgoBoxes, boxId: string): WasmErgoBox | undefined {
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
