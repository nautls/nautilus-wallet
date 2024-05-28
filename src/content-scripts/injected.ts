import { sendMessage, setNamespace } from "webext-bridge/window";
import { buildNamespaceFor } from "../background/messagingUtils";
import { ExternalRequest } from "../background/messaging";

type Resolver = {
  currentId: number;
  requests: Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>;
};

declare global {
  interface Window {
    ergo?: Readonly<NautilusErgoApi>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ergoConnector: any;
    ergo_request_read_access: () => Promise<boolean>;
    ergo_check_read_access: () => Promise<boolean>;
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

  get_utxos(amountOrTargetObj = undefined, token_id = "ERG", paginate = undefined) {
    return this.#rpcCall("getBoxes", [amountOrTargetObj, token_id, paginate]);
  }

  get_balance(token_id = "ERG") {
    return this.#rpcCall("getBalance", [token_id]);
  }

  get_used_addresses(paginate = undefined) {
    return this.#rpcCall("getUsedAddresses", [paginate]);
  }

  get_unused_addresses() {
    return this.#rpcCall("getUnusedAddresses");
  }

  get_change_address() {
    return this.#rpcCall("getChangeAddress");
  }

  sign_tx(tx: unknown) {
    return this.#rpcCall("signTx", [tx]);
  }

  sign_tx_inputs(tx: unknown, indexes: number[]) {
    return this.#rpcCall("signTxInputs", [tx, indexes]);
  }

  sign_data(addr: string, message: string) {
    return this.#rpcCall("signData", [addr, message]);
  }

  auth(addr: string, message: string) {
    return this.#rpcCall("auth", [addr, message]);
  }

  get_current_height() {
    return this.#rpcCall("getCurrentHeight");
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

(() => {
  setNamespace(buildNamespaceFor(location.origin));

  const resolver = new Map();
  let rpcId = 0;
  let instance: Readonly<NautilusErgoApi> | undefined;

  window.addEventListener("message", function (event) {
    if (event.data.type !== "rpc/connector-response/auth") return;

    const promise = resolver.get(event.data.requestId);
    if (!promise) return;

    resolver.delete(event.data.requestId);
    const r = event.data.return;

    if (event.data.function === "connect" && r.data === true) {
      instance = Object.freeze(new NautilusErgoApi());
      if (event.data.params[0] === true) {
        // eslint-disable-next-line no-console
        console.log("`ergo` object created.");
        this.window.ergo = instance;
      }
    } else if (event.data.function === "disconnect" && r.data === true) {
      if (this.window.ergo) delete this.window.ergo;
      instance = undefined;
    }

    if (r.isSuccess) {
      promise.resolve(r.data);
    } else {
      promise.reject(r.data);
    }
  });

  class NautilusAuthApi {
    connect({ createErgoObject = true } = {}): Promise<boolean> {
      return sendMessage(ExternalRequest.Connect, { createErgoObject }, "content-script");
    }

    disconnect() {
      return instance ? this.#rpcCall("disconnect") : Promise.resolve(false);
    }

    isConnected() {
      return instance ? this.#rpcCall("checkConnection") : Promise.resolve(false);
    }

    getContext() {
      return instance ? Promise.resolve(instance) : Promise.reject();
    }

    #rpcCall(func: string, params?: unknown[]) {
      return new Promise(function (resolve, reject) {
        window.postMessage({
          type: "rpc/connector-request",
          requestId: rpcId,
          function: func,
          params
        });

        resolver.set(rpcId, { resolve: resolve, reject: reject });
        rpcId++;
      });
    }
  }

  if (window.ergoConnector !== undefined) {
    window.ergoConnector = {
      ...window.ergoConnector,
      nautilus: Object.freeze(new NautilusAuthApi())
    };
  } else {
    window.ergoConnector = {
      nautilus: Object.freeze(new NautilusAuthApi())
    };
  }

  const warnDeprecated = function (fnName: string) {
    // eslint-disable-next-line no-console
    console.warn(`[Deprecated] This method will be disabled soon and replaced by '${fnName}'.`);
  };

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
