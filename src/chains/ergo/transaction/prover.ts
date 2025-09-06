import {
  BlockHeader,
  EIP12UnsignedTransaction,
  first,
  isEmpty,
  SignedInput,
  SignedTransaction
} from "@fleet-sdk/common";
import WebHIDTransport from "@ledgerhq/hw-transport-webhid";
import {
  Address,
  BlockHeaders,
  ErgoBoxes,
  ErgoStateContext,
  Parameters,
  PreHeader,
  SecretKey,
  SecretKeys,
  Tokens,
  Transaction,
  UnsignedTransaction,
  Wallet
} from "ergo-lib-wasm-browser";
import { BoxCandidate, ErgoLedgerApp, Network, Token, UnsignedBox } from "ledger-ergo-js";
import { DERIVATION_PATH, MAINNET } from "@/constants/ergo";
import { walletsDbService } from "@/database/walletsDbService";
import { addressFromErgoTree } from "../addresses";
import HdKey, { IndexedAddress } from "../hdKey";

export type ProverStateType = "success" | "error" | "loading" | "locked" | "ready";

export type LedgerDeviceModelId =
  | "blue" // Ledger Blue
  | "nanoS" // Ledger Nano S
  | "nanoSP" // Ledger Nano S Plus
  | "nanoX" // Ledger Nano X
  | "stax" // Ledger Stax
  | "europa"; // Ledger Flex ("europa" is the internal name)

export interface ProverState {
  type?: ProverStateType;
  label?: string;
  model?: LedgerDeviceModelId;
  connected?: boolean;
  additionalInfo?: string;
  busy?: boolean;
  appId?: number;
}

export type PartialSignState = Partial<ProverState>;

export type StateCallback = (newState: PartialSignState) => void;

export class Prover {
  #from!: IndexedAddress[];
  #useLedger!: boolean;
  #changeIndex!: number;
  #deriver!: HdKey;
  #headers?: BlockHeaders;

  #callbackFn?: StateCallback;

  constructor(deriver: HdKey) {
    this.#deriver = deriver;
    this.#useLedger = false;
  }

  from(addresses: IndexedAddress[]): Prover {
    this.#from = addresses;
    return this;
  }

  changeIndex(index: number): Prover {
    this.#changeIndex = index;
    return this;
  }

  setCallback<T>(callback?: (newState: T) => void): Prover {
    if (callback) {
      this.#callbackFn = callback as (newVal: unknown) => void;
    }

    return this;
  }

  useLedger(use = true): Prover {
    this.#useLedger = use;
    return this;
  }

  setHeaders(headers: BlockHeader[]): Prover {
    this.#headers = BlockHeaders.from_json(headers.map((h) => ({ ...h, votes: h.votes })));
    return this;
  }

  signMessage(message: Uint8Array) {
    const address = MAINNET
      ? Address.from_mainnet_str(this.#from[0].script)
      : Address.from_testnet_str(this.#from[0].script);

    return this.#buildWallet().sign_message_using_p2pk(address, message);
  }

  async signTransaction(unsignedTx: EIP12UnsignedTransaction): Promise<SignedTransaction> {
    const { tx, inputs, dataInputs } = this.#parseUnsignedTx(unsignedTx);
    const signed = await this.#signTx(tx, inputs, dataInputs);
    return signed.to_js_eip12();
  }

  async signInputs(
    unsignedTx: EIP12UnsignedTransaction,
    inputsToSign: number[]
  ): Promise<SignedInput[]> {
    inputsToSign = inputsToSign.sort();
    const { tx, inputs, dataInputs } = this.#parseUnsignedTx(unsignedTx);
    return this.#signInputs(tx, inputs, dataInputs, inputsToSign);
  }

  genCommitments(unsignedTx: EIP12UnsignedTransaction) {
    const context = this.#buildContext();
    const { tx, inputs, dataInputs } = this.#parseUnsignedTx(unsignedTx);
    return this.#buildWallet().generate_commitments(context, tx, inputs, dataInputs).to_json();
  }

  #parseUnsignedTx(unsignedTx: EIP12UnsignedTransaction) {
    const inputs = ErgoBoxes.from_boxes_json(unsignedTx.inputs);
    const dataInputs = ErgoBoxes.from_boxes_json(unsignedTx.dataInputs);
    const tx = UnsignedTransaction.from_json(JSON.stringify(unsignedTx));

    return { tx, inputs, dataInputs };
  }

  async #signTx(unsigned: UnsignedTransaction, unspentBoxes: ErgoBoxes, dataInputs: ErgoBoxes) {
    if (!this.#useLedger) {
      const wallet = this.#buildWallet();
      const signContext = this.#buildContext();
      return wallet.sign_transaction(signContext, unsigned, unspentBoxes, dataInputs);
    }

    try {
      this.#reportState({ busy: true }); // Prevents the UI to keep sending requests to the device

      const ledgerApp = new ErgoLedgerApp(await WebHIDTransport.create()).useAuthToken();

      this.#reportState({
        type: undefined,
        label: "Confirm transaction signing",
        appId: ledgerApp.authToken
      });

      const proofs = await ledgerApp.signTx(
        {
          inputs: mapLedgerInputs(unsigned, unspentBoxes, this.#from),
          dataInputs: mapLedgerDataInputs(dataInputs),
          outputs: mapLedgerOutputs(unsigned),
          distinctTokenIds: unsigned.distinct_token_ids(),
          changeMap: {
            address: this.#deriver.deriveAddress(this.#changeIndex ?? 0).script,
            path: `${DERIVATION_PATH}/${this.#changeIndex}`
          }
        },
        MAINNET ? Network.Mainnet : Network.Testnet
      );

      this.#reportState({ type: "success", label: "Signed", appId: undefined });
      return Transaction.from_unsigned_tx(unsigned, proofs);
    } finally {
      this.#reportState({ busy: false });
    }
  }

  #signInputs(
    tx: UnsignedTransaction,
    inputs: ErgoBoxes,
    dataInputs: ErgoBoxes,
    inputsToSign: number[]
  ) {
    const wallet = this.#buildWallet();
    const context = this.#buildContext();
    const signedInputs: SignedInput[] = [];

    for (const index of inputsToSign) {
      const result = wallet.sign_tx_input(index, context, tx, inputs, dataInputs);
      signedInputs.push({
        boxId: result.box_id().to_str(),
        spendingProof: JSON.parse(result.spending_proof().to_json())
      });
    }

    return signedInputs;
  }

  #reportState(state: PartialSignState) {
    if (!this.#callbackFn) return;
    this.#callbackFn(state);
  }

  #buildContext() {
    if (isEmpty(this.#headers)) throw Error("Headers are not set.");

    const preHeader = PreHeader.from_block_header(this.#headers.get(0));
    return new ErgoStateContext(preHeader, this.#headers, Parameters.default_parameters());
  }

  #buildWallet() {
    const sks = new SecretKeys();
    for (const address of this.#from) {
      sks.add(SecretKey.dlog_from_bytes(this.#deriver.derivePrivateKey(address.index)));
    }

    return Wallet.from_secrets(sks);
  }
}

function getBoxById(wasmBoxes: ErgoBoxes, boxId: string) {
  for (let i = 0; i < wasmBoxes.len(); i++) {
    if (wasmBoxes.get(i).box_id().to_str() === boxId) return wasmBoxes.get(i);
  }
}

function mapTokens(wasmTokens: Tokens) {
  const tokens: Token[] = [];
  for (let i = 0; i < wasmTokens.len(); i++) {
    tokens.push({
      id: wasmTokens.get(i).id().to_str(),
      amount: wasmTokens.get(i).amount().as_i64().to_str()
    });
  }

  return tokens;
}

function mapLedgerInputs(tx: UnsignedTransaction, inputs: ErgoBoxes, addresses: IndexedAddress[]) {
  const mappedInputs: UnsignedBox[] = [];
  for (let i = 0; i < tx.inputs().len(); i++) {
    const input = tx.inputs().get(i);
    const box = getBoxById(inputs, input.box_id().to_str());
    if (!box) throw Error(`Input ${input.box_id().to_str()} not found in unspent boxes.`);

    const ergoTree = box.ergo_tree().to_base16_bytes().toString();
    const path =
      addresses.find((a) => a.script === addressFromErgoTree(ergoTree)) ?? first(addresses);
    if (!path) throw Error(`Unable to find a sign path for ${input.box_id().to_str()}.`);

    mappedInputs.push({
      txId: box.tx_id().to_str(),
      index: box.index(),
      value: box.value().as_i64().to_str(),
      ergoTree: box.ergo_tree().sigma_serialize_bytes(),
      creationHeight: box.creation_height(),
      tokens: mapTokens(box.tokens()),
      additionalRegisters: box.serialized_additional_registers(),
      extension: input.extension().sigma_serialize_bytes(),
      signPath: `${DERIVATION_PATH}/${path.index}`
    });
  }

  return mappedInputs;
}

function mapLedgerDataInputs(dataInputs: ErgoBoxes) {
  const boxIds: string[] = [];
  for (let i = 0; i < dataInputs.len(); i++) {
    boxIds.push(dataInputs.get(i).box_id().to_str());
  }

  return boxIds;
}

function mapLedgerOutputs(tx: UnsignedTransaction) {
  const outputs: BoxCandidate[] = [];
  for (let i = 0; i < tx.output_candidates().len(); i++) {
    const output = tx.output_candidates().get(i);
    outputs.push({
      value: output.value().as_i64().to_str(),
      ergoTree: output.ergo_tree().sigma_serialize_bytes(),
      creationHeight: output.creation_height(),
      tokens: mapTokens(output.tokens()),
      registers: output.serialized_additional_registers()
    });
  }

  return outputs;
}

export async function getPrivateDeriver(walletId: number, password: string): Promise<HdKey> {
  return await HdKey.fromMnemonic(await walletsDbService.getMnemonic(walletId, password));
}
