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
    log("code injected");
    return true;
  } catch (e) {
    error("injection failed: " + e);
    return false;
  }
}

function log(content) {
  console.log(`[Nautilus] ${content}`);
}

function error(content) {
  console.error(`[Nautilus] ${content}`);
}

const initialApi = `
var nauRpcId = 0;
var nauRpcResolver = new Map();
window.addEventListener("message", function (event) {
  if (event.data.type === "rpc/connector-response") {
    console.debug("message from connector: " + JSON.stringify(event.data));
    const promise = nauRpcResolver.get(event.data.id);
    if (promise !== undefined) {
      nauRpcResolver.delete(event.data.id);
      const ret = event.data.return;
      if (ret.isSuccess) {
        promise.resolve(ret.data);
      } else {
        promise.reject(ret.data);
      }
    }
  }
});

class NautilusAuthApi {
  requestAccess() {
    return this._rpcCall("requestAccess");
  }

  checkAccess(p) {
    return this._rpcCall("testWithParams", [p]);
  }

  _rpcCall(func, params) {
    return new Promise(function (resolve, reject) {
      window.postMessage(
        { type: "rpc/connector-request", id: nauRpcId, function: func, params },
        location.origin
      );

      console.debug("rpcId = " + nauRpcId);

      nauRpcResolver.set(nauRpcId, { resolve: resolve, reject: reject });
      nauRpcId++;
    });
  }
}

if (ergoConnector !== undefined) {
  ergoConnector = {
    ...ergoConnector,
    nautilus: Object.freeze(new NautilusAuthApi())
  };
} else {
  var ergoConnector = {
    nautilus: Object.freeze(new NautilusAuthApi())
  };
}
// `;

const ergoApi = `
class NautilusErgoApi {
  getBoxes() {
    return this._rpcCall("requestAccess");
  }

  _rpcCall(func, params) {
    return new Promise(function (resolve, reject) {
      window.postMessage(
        { type: "rpc/connector-request", id: nauRpcId, function: func, params },
        location.origin
      );

      console.debug("rpcId = " + nauRpcId);

      nauRpcResolver.set(nauRpcId, { resolve: resolve, reject: reject });
      nauRpcId++;
    });
  }
}

const ergo = Object.freeze(new NautilusErgoApi());
// `;

let nautilusPort;

function createPort() {
  if (nautilusPort !== undefined) {
    return;
  }

  nautilusPort = chrome.runtime.connect();
}

if (shouldInject()) {
  inject(initialApi);
  nautilusPort = chrome.runtime.connect();

  nautilusPort.onMessage.addListener(message => {
    if (message.type !== "rpc/connector-response") {
      return;
    }

    window.postMessage(message, location.origin);
  });

  window.addEventListener("message", function (event) {
    if (event.data.type !== "rpc/connector-request") {
      return;
    }

    nautilusPort.postMessage(event.data);
  });
}
