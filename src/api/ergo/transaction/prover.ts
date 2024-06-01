import { Header } from "@ergo-graphql/types";
import { EIP12UnsignedTransaction, SignedInput, SignedTransaction } from "@fleet-sdk/common";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import {
  Address,
  BlockHeaders,
  ErgoBoxCandidate,
  ErgoBoxes,
  ErgoStateContext,
  NonMandatoryRegisterId,
  PreHeader,
  SecretKey,
  SecretKeys,
  Tokens,
  Transaction,
  UnsignedTransaction,
  Wallet,
  ErgoBox as WasmErgoBox
} from "ergo-lib-wasm-browser";
import JSONBig from "json-bigint";
import {
  BoxCandidate,
  DeviceError,
  ErgoLedgerApp,
  Network,
  RETURN_CODE,
  Token,
  UnsignedBox
} from "ledger-ergo-js";
import { find, first } from "lodash-es";
import { addressFromErgoTree } from "../addresses";
import Bip32 from "../bip32";
import { DERIVATION_PATH, MAINNET } from "@/constants/ergo";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { ProverDeviceState, ProverStateType, SigningState, StateAddress } from "@/types/internal";
import { toBigNumber } from "@/utils/bigNumbers";

export type PartialSignState = Omit<Partial<SigningState>, "device"> & {
  device?: Partial<ProverDeviceState>;
};

export class Prover {
  private _from!: StateAddress[];
  private _useLedger!: boolean;
  private _changeIndex!: number;
  private _deriver!: Bip32;
  private _callbackFn?: (newVal: PartialSignState) => void;

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
      this._callbackFn = callback as (newVal: unknown) => void;
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
      ? Address.from_mainnet_str(this._from[0].script)
      : Address.from_testnet_str(this._from[0].script);

    return wallet.sign_message_using_p2pk(address, Buffer.from(message, "utf-8"));
  }

  public async sign(
    unsignedTx: EIP12UnsignedTransaction,
    headers: Header[]
  ): Promise<SignedTransaction> {
    const unspentBoxes = ErgoBoxes.from_boxes_json(unsignedTx.inputs);
    const dataInputBoxes = ErgoBoxes.from_boxes_json(unsignedTx.dataInputs);
    const tx = UnsignedTransaction.from_json(JSONBig.stringify(unsignedTx));
    const signed = await this._sign(tx, unspentBoxes, dataInputBoxes, headers);

    return signed.to_js_eip12();
  }

  public async signInputs(
    unsignedTx: EIP12UnsignedTransaction,
    headers: Header[],
    inputsToSign: number[]
  ): Promise<SignedInput[]> {
    inputsToSign = inputsToSign.sort();
    const unspentBoxes = ErgoBoxes.from_boxes_json(unsignedTx.inputs);
    const dataInputBoxes = ErgoBoxes.from_boxes_json(unsignedTx.dataInputs);
    const tx = UnsignedTransaction.from_json(JSONBig.stringify(unsignedTx));
    const signed = this._signInputs(tx, unspentBoxes, dataInputBoxes, headers, inputsToSign);

    return signed;
  }

  private async _sign(
    unsigned: UnsignedTransaction,
    unspentBoxes: ErgoBoxes,
    dataInputBoxes: ErgoBoxes,
    headers: Header[]
  ) {
    if (this._useLedger) {
      let ledgerApp!: ErgoLedgerApp;

      try {
        ledgerApp = new ErgoLedgerApp(await WebUSBTransport.create())
          .useAuthToken()
          .enableDebugMode();

        this.reportState({
          device: {
            screenText: "Connected",
            connected: true,
            appId: ledgerApp.authToken || 0,
            model:
              (ledgerApp.transport.deviceModel?.id.toString() as LedgerDeviceModelId) ??
              LedgerDeviceModelId.nanoX
          }
        });
      } catch (e) {
        this.reportState({
          device: {
            connected: false
          },
          type: ProverStateType.unavailable
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

        this.reportState({
          statusText: "Please confirm the transaction signature on your device.",
          device: {
            screenText: "Waiting for approval..."
          }
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

        this.reportState({
          type: ProverStateType.success,
          device: {
            screenText: "Signed"
          }
        });

        return Transaction.from_unsigned_tx(unsigned, proofs);
      } catch (e) {
        if (e instanceof DeviceError) {
          const resp: PartialSignState = {
            type: ProverStateType.error,
            device: {
              screenText: "Error"
            }
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

          this.reportState(resp);
        }

        throw e;
      } finally {
        ledgerApp.transport.close();
      }
    }

    const wallet = this.buildWallet(this._from, this._deriver);
    const blockHeaders = BlockHeaders.from_json(
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

    const preHeader = PreHeader.from_block_header(blockHeaders.get(0));
    const signContext = new ErgoStateContext(preHeader, blockHeaders);

    const signed = wallet.sign_transaction(signContext, unsigned, unspentBoxes, dataInputBoxes);
    return signed;
  }

  private _signInputs(
    unsigned: UnsignedTransaction,
    unspentBoxes: ErgoBoxes,
    dataInputBoxes: ErgoBoxes,
    headers: Header[],
    inputsToSign: number[]
  ) {
    const wallet = this.buildWallet(this._from, this._deriver);
    const blockHeaders = BlockHeaders.from_json(
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

    const preHeader = PreHeader.from_block_header(blockHeaders.get(0));
    const signContext = new ErgoStateContext(preHeader, blockHeaders);
    const signed: SignedInput[] = [];

    for (const index of inputsToSign) {
      const result = wallet.sign_tx_input(
        index,
        signContext,
        unsigned,
        unspentBoxes,
        dataInputBoxes
      );

      signed.push({
        boxId: result.box_id().to_str(),
        spendingProof: JSON.parse(result.spending_proof().to_json())
      });
    }

    return signed;
  }

  private serializeRegisters(box: ErgoBoxCandidate): Buffer {
    const registerEnum = NonMandatoryRegisterId;
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

  private reportState(state: PartialSignState) {
    if (!this._callbackFn) {
      return;
    }

    this._callbackFn(state);
  }

  private buildWallet(addresses: StateAddress[], bip32: Bip32): Wallet {
    const sks = new SecretKeys();

    for (const address of addresses) {
      sks.add(SecretKey.dlog_from_bytes(bip32.derivePrivateKey(address.index)));
    }
    return Wallet.from_secrets(sks);
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
