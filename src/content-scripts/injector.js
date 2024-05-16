import authApi from "./authApi.js?url";

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

function injectScript(script_file) {
  var script = document.createElement("script");
  script.src = chrome.runtime.getURL(script_file);
  (document.head || document.documentElement).appendChild(script);
  log(script_file + " injected");
}

function log(content) {
  // eslint-disable-next-line no-console
  console.log(`[Nautilus] ${content}`);
}

function error(content) {
  // eslint-disable-next-line no-console
  console.error(`[Nautilus] ${content}`);
}

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

  get_utxos(amountOrTargetObj = undefined, token_id = "ERG", paginate = undefined) {
    return this._rpcCall("getBoxes", [amountOrTargetObj, token_id, paginate]);
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

  sign_tx_inputs(tx, indexes) {
    return this._rpcCall("signTxInputs", [tx, indexes]);
  }

  sign_data(addr, message) {
    return this._rpcCall("signData", [addr, message]);
  }

  auth(addr, message) {
    return this._rpcCall("auth", [addr, message]);
  }

  get_current_height() {
    return this._rpcCall("getCurrentHeight")
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

// eslint-disable-next-line no-undef
const Browser = typeof browser === "undefined" ? chrome : browser;

if (shouldInject()) {
  if (injectScript(authApi)) {
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
