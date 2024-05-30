import { sendMessage, setNamespace } from "webext-bridge/window";
import { buildNamespaceFor } from "../background/messagingUtils";
import { ExternalRequest, Result } from "../background/messaging";
import { SelectionTarget } from "@nautilus-js/eip12-types";
import { APIErrorCode } from "../types/connector";

const CONTENT_SCRIPT = "content-script";
const _ = undefined;
const PAGINATION_ERROR = {
  code: APIErrorCode.InvalidRequest,
  info: "Pagination is not supported."
};

type Resolver = {
  currentId: number;
  requests: Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>;
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
    const granted = await sendMessage(
      ExternalRequest.Connect,
      { createErgoObject },
      CONTENT_SCRIPT
    );

    if (granted) {
      this.#context = Object.freeze(new NautilusErgoApi());
      if (createErgoObject) {
        window.ergo = this.#context;
      }
    }

    return granted;
  }

  isConnected() {
    return sendMessage(ExternalRequest.CheckConnection, _, CONTENT_SCRIPT);
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
    return this.#context ? Promise.resolve(this.#context) : Promise.reject();
  }
}

class NautilusErgoApi {
  static instance: NautilusErgoApi;

  #resolver: Resolver = {
    currentId: 1,
    requests: new Map()
  };

  constructor() {
    if (NautilusErgoApi.instance) {
      return NautilusErgoApi.instance;
    }

    window.addEventListener("message", this.#eventHandler(this.#resolver));
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

    const result = await sendMessage(ExternalRequest.GetUTxOs, { target }, CONTENT_SCRIPT);
    return handle(result);
  }

  async get_balance(tokenId = "ERG") {
    const result = await sendMessage(ExternalRequest.GetBalance, { tokenId }, CONTENT_SCRIPT);
    return handle(result);
  }

  async get_used_addresses(paginate: undefined) {
    if (paginate) throw PAGINATION_ERROR;

    const result = await sendMessage(ExternalRequest.GetAddresses, "used", CONTENT_SCRIPT);
    return handle(result);
  }

  async get_unused_addresses(paginate: undefined) {
    if (paginate) throw PAGINATION_ERROR;

    const result = await sendMessage(ExternalRequest.GetAddresses, "unused", CONTENT_SCRIPT);
    return handle(result);
  }

  async get_change_address() {
    const result = await sendMessage(ExternalRequest.GetAddresses, "change", CONTENT_SCRIPT);
    return handle(result);
  }

  sign_tx(tx: unknown) {
    return this.#rpcCall("signTx", [tx]);
  }

  sign_tx_inputs(tx: unknown, indexes: number[]) {
    return this.#rpcCall("signTxInputs", [tx, indexes]);
  }

  async sign_data(address: string, message: string) {
    const data = { address, message };
    const result = await sendMessage(ExternalRequest.SignData, data, CONTENT_SCRIPT);
    return handle(result);
  }

  async auth(address: string, message: string) {
    const data = { address, message };
    const result = await sendMessage(ExternalRequest.Auth, data, CONTENT_SCRIPT);
    return handle(result);
  }

  async get_current_height() {
    const result = await sendMessage(ExternalRequest.GetCurrentHeight, _, CONTENT_SCRIPT);
    return handle(result);
  }

  submit_tx(tx: unknown) {
    return this.#rpcCall("submitTx", [tx]);
  }

  #rpcCall(func: string, params?: unknown[]) {
    return new Promise((resolve, reject) => {
      window.postMessage({
        type: "rpc/connector-request",
        requestId: this.#resolver.currentId,
        function: func,
        params
      });

      this.#resolver.requests.set(this.#resolver.currentId, { resolve, reject });
      this.#resolver.currentId++;
    });
  }

  #eventHandler(resolver: Resolver) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (event: any) => {
      if (event.data.type === "rpc/connector-response") {
        // eslint-disable-next-line no-console
        console.debug(JSON.stringify(event.data));
        const promise = resolver.requests.get(event.data.requestId);
        if (promise !== undefined) {
          resolver.requests.delete(event.data.requestId);
          const ret = event.data.return;
          if (ret.isSuccess) {
            promise.resolve(ret.data);
          } else {
            promise.reject(ret.data);
          }
        }
      }
    };
  }
}

function handle<T>(result: Result<T>) {
  if (result.success) {
    return result.data;
  } else {
    throw result.error;
  }
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
})();
