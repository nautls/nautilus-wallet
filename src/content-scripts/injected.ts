type Resolver = {
  currentId: number;
  requests: Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>;
};

declare const ergoConnector: any;

declare interface Window {
  ergo: any;
  ergo_request_read_access: any;
  ergo_check_read_access: any;
  ergoConnector: any;
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
    // todo: remove this any
    return (event: any) => {
      if (event.data.type === "rpc/connector-response") {
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
    connect({ createErgoObject = true } = {}) {
      return this.#rpcCall("connect", [createErgoObject]);
    }

    disconnect() {
      return !!instance ? this.#rpcCall("disconnect") : Promise.resolve(false);
    }

    isConnected() {
      return !!instance ? this.#rpcCall("checkConnection") : Promise.resolve(false);
    }

    getContext() {
      return !!instance ? Promise.resolve(instance) : Promise.reject();
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
    console.warn(`[Deprecated] This method will be disabled soon and replaced by '${fnName}'.`);
  };

  if (!window.ergo_request_read_access && !window.ergo_check_read_access) {
    window.ergo_request_read_access = function () {
      warnDeprecated("ergoConnector.nautilus.connect()");
      return ergoConnector.nautilus.connect();
    };
    window.ergo_check_read_access = function () {
      warnDeprecated("ergoConnector.nautilus.isConnected()");
      return ergoConnector.nautilus.isConnected();
    };
  }
})();
