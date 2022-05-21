function shouldInject() {
  const documentElement = document.documentElement.nodeName;
  const docElemCheck = documentElement ? documentElement.toLowerCase() === "html" : true;
  const { docType } = window.document;
  const docTypeCheck = docType ? docType.name === "html" : true;
  return docElemCheck && docTypeCheck;
}

function inject(code) {
  try {
    const container = document.head || document.documentElement;
    const scriptTag = document.createElement("script");
    scriptTag.setAttribute("async", "false");
    scriptTag.textContent = code;
    container.insertBefore(scriptTag, container.children[0]);
    container.removeChild(scriptTag);
    return true;
  } catch (e) {
    error("Injection failed: " + e);
    return false;
  }
}

function log(content) {
  console.log(`[Nautilus] ${content}`);
}

function error(content) {
  console.error(`[Nautilus] ${content}`);
}

const AUTH_API_CODE = `
(() => {
  var rpcId = 0;
  var resolver = new Map();
  var api = undefined;
  window.addEventListener("message", function (event) {
    if (event.data.type !== "rpc/connector-response/auth") {
      return;
    }

    const promise = resolver.get(event.data.requestId);
    if (!promise) {
      return;
    }

    resolver.delete(event.data.requestId);
    const ret = event.data.return;
    if (event.data.function === "connect" && ret.data === true) {
      if (event.data.params[0] === true) {
        api = ergo;
      } else {
        api = Object.freeze(new NautilusErgoApi());
      }
    } else if (event.data.function === "disconnect" && ret.data === true) {
      api = undefined;
    }

    if (ret.isSuccess) {
      promise.resolve(ret.data);
    } else {
      promise.reject(ret.data);
    }
  });

  class NautilusAuthApi {
    connect({ createErgoObject = true } = {}) {
      return this._rpcCall("connect", [createErgoObject]);
    }

    disconnect() {
      if (api) {
        return this._rpcCall("disconnect");
      }
      return Promise.resolve(false);
    }

    isConnected() {
      if (api) {
        return this._rpcCall("checkConnection");
      }
      return Promise.resolve(false);
    }

    getContext() {
      if (api) {
        return Promise.resolve(api);
      }
      return Promise.reject();
    }

    _rpcCall(func, params) {
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
      ...ergoConnector,
      nautilus: Object.freeze(new NautilusAuthApi())
    };
  } else {
    window.ergoConnector = {
      nautilus: Object.freeze(new NautilusAuthApi())
    };
  }

  const warnDeprecated = function (func) {
    console.warn(
      "[Deprecated] In order to avoid conflicts with another wallets, this method will be disabled and replaced by '" +
        func +
        "' soon."
    );
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
// `;

const ERGO_API_CODE = `
class NautilusErgoApi {
  static instance;

  _resolver = {
    currentId: 1,
    requests: new Map()
  };

  constructor() {
    if (NautilusErgoApi.instance) {
      return NautilusErgoApi.instance;
    }

    window.addEventListener("message", this._eventHandler(this._resolver));
    NautilusErgoApi.instance = this;
    return this;
  }

  get_utxos(amount = undefined, token_id = "ERG", paginate = undefined) {
    return this._rpcCall("getBoxes", [amount, token_id, paginate]);
  }

  get_balance(token_id = "ERG") {
    return this._rpcCall("getBalance", [token_id]);
  }

  get_used_addresses(paginate = undefined) {
    return this._rpcCall("getUsedAddresses", [paginate]);
  }

  get_unused_addresses() {
    return this._rpcCall("getUnusedAddresses");
  }

  get_change_address() {
    return this._rpcCall("getChangeAddress");
  }

  sign_tx(tx) {
    return this._rpcCall("signTx", [tx]);
  }

  sign_tx_input(tx, index) {
    return this._rpcCall("signTxInput", [tx, index]);
  }

  sign_data(addr, message) {
    return this._rpcCall("signData", [addr, message]);
  }

  submit_tx(tx) {
    return this._rpcCall("submitTx", [tx]);
  }

  _rpcCall(func, params) {
    return new Promise((resolve, reject) => {
      window.postMessage({
        type: "rpc/connector-request",
        requestId: this._resolver.currentId,
        function: func,
        params
      });
      this._resolver.requests.set(this._resolver.currentId, { resolve: resolve, reject: reject });
      this._resolver.currentId++;
    });
  }

  _eventHandler(resolver) {
    return (event) => {
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
// API_INSTANCE //`;

const ERGO_CONST_CODE = `const ergo = Object.freeze(new NautilusErgoApi());`;

let ergoApiInjected = false;
let nautilusPort;

const Browser = typeof browser === "undefined" ? chrome : browser;

function createPort() {
  if (nautilusPort !== undefined) {
    return;
  }

  nautilusPort = Browser.runtime.connect();
}

if (shouldInject()) {
  if (inject(AUTH_API_CODE)) {
    log("Access methods injected.");
  }

  nautilusPort = Browser.runtime.connect();
  nautilusPort.onMessage.addListener((message) => {
    if (
      !message.type.startsWith("rpc/connector-response") &&
      message.type !== "rpc/nautilus-event"
    ) {
      return;
    }

    if (message.type === "rpc/connector-response") {
      window.postMessage(message, location.origin);
    } else if (message.type === "rpc/connector-response/auth") {
      if (
        !ergoApiInjected &&
        message.function === "connect" &&
        message.return.isSuccess &&
        message.return.data === true
      ) {
        const api = ERGO_API_CODE.replace(
          "// API_INSTANCE //",
          message.params[0] === true ? ERGO_CONST_CODE : ""
        );
        if (inject(api)) {
          log("Ergo API injected.");
          if (message.params[0] === true) {
            log("Ergo API instantiated.");
          }

          ergoApiInjected = true;
        }
      }

      window.postMessage(message, location.origin);
    } else if (message.type === "rpc/nautilus-event") {
      if (message.name === "disconnected") {
        window.dispatchEvent(new Event("ergo_wallet_disconnected"));
      }
    }
  });

  window.addEventListener("message", function (event) {
    if (event.data.type !== "rpc/connector-request") {
      return;
    }

    nautilusPort.postMessage(event.data);
  });
}
