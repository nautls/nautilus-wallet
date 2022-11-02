import { DERIVATION_PATH, MAINNET } from "@/constants/ergo";
import { ErgoTx, UnsignedTx } from "@/types/connector";
import { StateAddress } from "@/types/internal";
import { wasmModule } from "@/utils/wasm-module";
import {
  ErgoBoxes,
  Tokens,
  UnsignedTransaction,
  Wallet,
  ErgoBox as WasmErgoBox,
  ErgoBoxCandidate
} from "ergo-lib-wasm-browser";
import { find, first } from "lodash";
import Bip32 from "../bip32";
import JSONBig from "json-bigint";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import {
  BoxCandidate,
  DeviceError,
  ErgoLedgerApp,
  Network,
  RETURN_CODE,
  Token,
  UnsignedBox
} from "ledger-ergo-js";
import { LedgerDeviceModelId, LedgerState } from "@/constants/ledger";
import { addressFromErgoTree } from "../addresses";
import { Header } from "@ergo-graphql/types";
import { toBigNumber } from "@/utils/bigNumbers";

export class Prover {
  private _from!: StateAddress[];
  private _useLedger!: boolean;
  private _changeIndex!: number;
  private _deriver!: Bip32;
  private _callbackFunc?: (newVal: unknown) => void;

  public constructor(deriver: Bip32) {
    this._deriver = deriver;
    this._useLedger = false;
  }

  public from(addresses: StateAddress[]): Prover {
    this._from = addresses;
    return this;
  }

  public changeIndex(index: number): Prover {
    this._changeIndex = index;
    return this;
  }

  public setCallback<T>(callback?: (newState: T) => void): Prover {
    if (callback) {
      this._callbackFunc = callback as (newVal: unknown) => void;
    }

    return this;
  }

  public useLedger(use = true): Prover {
    this._useLedger = use;
    return this;
  }

  public signMessage(message: string) {
    const wallet = this.buildWallet(this._from, this._deriver);
    const address = MAINNET
      ? wasmModule.SigmaRust.Address.from_mainnet_str(this._from[0].script)
      : wasmModule.SigmaRust.Address.from_testnet_str(this._from[0].script);

    return wallet.sign_message_using_p2pk(address, Buffer.from(message, "utf-8"));
  }

  public async sign(unsignedTx: UnsignedTx, headers: Header[]): Promise<ErgoTx> {
    const sigmaRust = wasmModule.SigmaRust;
    const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(unsignedTx.inputs);
    const dataInputBoxes = sigmaRust.ErgoBoxes.from_boxes_json(unsignedTx.dataInputs);
    const tx = sigmaRust.UnsignedTransaction.from_json(JSONBig.stringify(unsignedTx));
    const signed = await this._sign(tx, unspentBoxes, dataInputBoxes, headers);

    return JSONBig.parse(signed.to_json());
  }

  private async _sign(
    unsigned: UnsignedTransaction,
    unspentBoxes: ErgoBoxes,
    dataInputBoxes: ErgoBoxes,
    headers: Header[]
  ) {
    const sigmaRust = wasmModule.SigmaRust;

    if (this._useLedger) {
      let ledgerApp!: ErgoLedgerApp;

      try {
        ledgerApp = new ErgoLedgerApp(await WebUSBTransport.create())
          .useAuthToken()
          .enableDebugMode();
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
          const box = findBox(unspentBoxes, input.box_id().to_str());
          if (!box) {
            throw Error(`Input ${input.box_id().to_str()} not found in unspent boxes.`);
          }

          const ergoTree = box.ergo_tree().to_base16_bytes().toString();
          const path =
            find(this._from, (a) => a.script === addressFromErgoTree(ergoTree)) ??
            first(this._from);

          if (!path) {
            throw Error(`Unable to find a sign path for ${input.box_id().to_str()}.`);
          }

          inputs.push({
            txId: box.tx_id().to_str(),
            index: box.index(),
            value: box.value().as_i64().to_str(),
            ergoTree: Buffer.from(box.ergo_tree().sigma_serialize_bytes()),
            creationHeight: box.creation_height(),
            tokens: mapTokens(box.tokens()),
            additionalRegisters: Buffer.from(box.serialized_additional_registers()),
            extension: Buffer.from(input.extension().sigma_serialize_bytes()),
            signPath: `${DERIVATION_PATH}/${path.index}`
          });
        }
        for (let i = 0; i < unsigned.output_candidates().len(); i++) {
          const wasmOutput = unsigned.output_candidates().get(i);

          outputs.push({
            value: wasmOutput.value().as_i64().to_str(),
            ergoTree: Buffer.from(wasmOutput.ergo_tree().sigma_serialize_bytes()),
            creationHeight: wasmOutput.creation_height(),
            tokens: mapTokens(wasmOutput.tokens()),
            registers: this.serializeRegisters(wasmOutput)
          });
        }

        this.sendCallback({
          statusText: "Waiting for device transaction signing confirmation..."
        });
        const proofs = await ledgerApp.signTx(
          {
            inputs,
            dataInputs: [],
            outputs,
            distinctTokenIds: unsigned.distinct_token_ids(),
            changeMap: {
              address: this._deriver.deriveAddress(this._changeIndex ?? 0).script,
              path: `${DERIVATION_PATH}/${this._changeIndex}`
            }
          },
          MAINNET ? Network.Mainnet : Network.Testnet
        );

        this.sendCallback({
          screenText: "Signed",
          statusText: "Sending transaction..."
        });

        return wasmModule.SigmaRust.Transaction.from_unsigned_tx(unsigned, proofs);
      } catch (e) {
        if (e instanceof DeviceError) {
          const resp = {
            loading: false,
            state: LedgerState.error,
            statusText: ""
          };

          switch (e.code) {
            case RETURN_CODE.DENIED:
              resp.statusText = "Transaction signing denied.";
              break;
            case RETURN_CODE.INTERNAL_CRYPTO_ERROR:
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

    const wallet = this.buildWallet(this._from, this._deriver);
    const blockHeaders = sigmaRust.BlockHeaders.from_json(
      headers.map((x) => {
        return {
          ...x,
          id: x.headerId,
          timestamp: toBigNumber(x.timestamp).toNumber(),
          nBits: toBigNumber(x.nBits).toNumber(),
          votes: Buffer.from(x.votes).toString("hex")
        };
      })
    );

    const preHeader = sigmaRust.PreHeader.from_block_header(blockHeaders.get(0));
    const signContext = new sigmaRust.ErgoStateContext(preHeader, blockHeaders);
    const signed = wallet.sign_transaction(signContext, unsigned, unspentBoxes, dataInputBoxes);
    return signed;
  }

  private serializeRegisters(box: ErgoBoxCandidate): Buffer {
    const registerEnum = wasmModule.SigmaRust.NonMandatoryRegisterId;
    if (!box.register_value(registerEnum.R4)) {
      return Buffer.from([]);
    }

    const registers = [
      Buffer.from(box.register_value(registerEnum.R4)?.sigma_serialize_bytes() ?? []),
      Buffer.from(box.register_value(registerEnum.R5)?.sigma_serialize_bytes() ?? []),
      Buffer.from(box.register_value(registerEnum.R6)?.sigma_serialize_bytes() ?? []),
      Buffer.from(box.register_value(registerEnum.R7)?.sigma_serialize_bytes() ?? []),
      Buffer.from(box.register_value(registerEnum.R8)?.sigma_serialize_bytes() ?? []),
      Buffer.from(box.register_value(registerEnum.R9)?.sigma_serialize_bytes() ?? [])
    ].filter((b) => b.length > 0);

    return Buffer.concat([...[Buffer.from([registers.length])], ...registers]);
  }

  private sendCallback(state: unknown) {
    if (!this._callbackFunc) {
      return;
    }

    this._callbackFunc(state);
  }

  private buildWallet(addresses: StateAddress[], bip32: Bip32): Wallet {
    const sigmaRust = wasmModule.SigmaRust;
    const sks = new sigmaRust.SecretKeys();

    for (const address of addresses) {
      sks.add(sigmaRust.SecretKey.dlog_from_bytes(bip32.derivePrivateKey(address.index)));
    }
    return sigmaRust.Wallet.from_secrets(sks);
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
