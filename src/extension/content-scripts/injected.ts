import { sendMessage, setNamespace } from "webext-bridge/window";
import { SelectionTarget } from "@nautilus-js/eip12-types";
import { EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { buildNamespaceFor, ExternalEvent, ExternalRequest, Result } from "@/rpc/protocol";
import { APIErrorCode } from "@/types/connector";

const CONTENT_SCRIPT = "content-script";
const _ = undefined;
const PAGINATION_ERROR = {
  code: APIErrorCode.InvalidRequest,
  info: "Pagination is not supported."
};

declare global {
  interface Window {
    ergo?: Readonly<NautilusErgoApi>;
    ergoConnector: { nautilus: Readonly<NautilusAuthApi> };
    ergo_request_read_access: () => Promise<boolean>;
    ergo_check_read_access: () => Promise<boolean>;
  }
}

class NautilusAuthApi {
  #context?: Readonly<NautilusErgoApi>;

  async connect({ createErgoObject = true } = {}): Promise<boolean> {
    const granted = await sendMessage(ExternalRequest.Connect, _, CONTENT_SCRIPT);
    if (granted) {
      this.#context = Object.freeze(new NautilusErgoApi());
      if (createErgoObject) window.ergo = this.#context;
    }

    return granted;
  }

  isAuthorized() {
    return sendMessage(ExternalRequest.CheckConnection, _, CONTENT_SCRIPT);
  }

  isConnected() {
    return Promise.resolve(this.#context !== undefined);
  }

  async disconnect() {
    const disconnected = await sendMessage(ExternalRequest.Disconnect, _, CONTENT_SCRIPT);
    if (disconnected) {
      this.#context = undefined;
      if (window.ergo) delete window.ergo;
    }

    return disconnected;
  }

  getContext() {
    return this.#context
      ? Promise.resolve(this.#context)
      : Promise.reject({ code: APIErrorCode.Refused, info: "Not connected." });
  }
}

class NautilusErgoApi {
  static instance: NautilusErgoApi;

  constructor() {
    if (NautilusErgoApi.instance) {
      return NautilusErgoApi.instance;
    }

    NautilusErgoApi.instance = this;
    return this;
  }

  async get_utxos(
    amountOrTarget?: SelectionTarget | string,
    tokenId?: string,
    paginate?: undefined
  ) {
    if (paginate) throw PAGINATION_ERROR;

    let target: SelectionTarget | undefined;
    if (amountOrTarget) {
      if (typeof amountOrTarget === "string") {
        target =
          !tokenId || tokenId === "ERG"
            ? { nanoErgs: amountOrTarget }
            : { tokens: [{ tokenId, amount: amountOrTarget }] };
      } else {
        target = amountOrTarget;
      }
    }

    return handle(await sendMessage(ExternalRequest.GetUTxOs, { target }, CONTENT_SCRIPT));
  }

  async get_balance(tokenId = "ERG") {
    return handle(await sendMessage(ExternalRequest.GetBalance, { tokenId }, CONTENT_SCRIPT));
  }

  async get_used_addresses(paginate: undefined) {
    if (paginate) throw PAGINATION_ERROR;
    return handle(await sendMessage(ExternalRequest.GetAddresses, "used", CONTENT_SCRIPT));
  }

  async get_unused_addresses(paginate: undefined) {
    if (paginate) throw PAGINATION_ERROR;
    return handle(await sendMessage(ExternalRequest.GetAddresses, "unused", CONTENT_SCRIPT));
  }

  async get_change_address() {
    return handle(await sendMessage(ExternalRequest.GetAddresses, "change", CONTENT_SCRIPT));
  }

  async sign_tx(transaction: EIP12UnsignedTransaction) {
    return handle(await sendMessage(ExternalRequest.SignTx, { transaction }, CONTENT_SCRIPT));
  }

  async sign_tx_inputs(transaction: EIP12UnsignedTransaction, indexes: number[]) {
    return handle(
      await sendMessage(ExternalRequest.SignTxInputs, { transaction, indexes }, CONTENT_SCRIPT)
    );
  }

  async sign_data(address: string, message: string) {
    return handle(
      await sendMessage(ExternalRequest.SignData, { address, message }, CONTENT_SCRIPT)
    );
  }

  async auth(address: string, message: string) {
    return handle(await sendMessage(ExternalRequest.Auth, { address, message }, CONTENT_SCRIPT));
  }

  async get_current_height() {
    return handle(await sendMessage(ExternalRequest.GetCurrentHeight, _, CONTENT_SCRIPT));
  }

  async submit_tx(transaction: SignedTransaction) {
    return handle(
      await sendMessage(ExternalRequest.SubmitTransaction, { transaction }, CONTENT_SCRIPT)
    );
  }
}

function handle<T>(result: Result<T>) {
  if (result.success) return result.data;
  else throw result.error;
}

const warnDeprecated = function (fnName: string) {
  // eslint-disable-next-line no-console
  console.warn(`[Deprecated] This method will be disabled soon and replaced by '${fnName}'.`);
};

(() => {
  setNamespace(buildNamespaceFor(location.origin));

  const nautilus = Object.freeze(new NautilusAuthApi());
  if (window.ergoConnector !== undefined) {
    window.ergoConnector = { ...window.ergoConnector, nautilus };
  } else {
    window.ergoConnector = { nautilus };
  }

  if (!window.ergo_request_read_access && !window.ergo_check_read_access) {
    window.ergo_request_read_access = function () {
      warnDeprecated("ergoConnector.nautilus.connect()");
      return window.ergoConnector.nautilus.connect();
    };

    window.ergo_check_read_access = function () {
      warnDeprecated("ergoConnector.nautilus.isConnected()");
      return window.ergoConnector.nautilus.isConnected();
    };
  }

  dispatchEvent(new CustomEvent(ExternalEvent.Injected, { detail: "nautilus" }));
})();
