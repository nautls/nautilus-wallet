(() => {
  var rpcId = 0;
  var resolver = new Map();
  var instance = undefined;

  window.addEventListener("message", function (event) {
    if (event.data.type !== "rpc/connector-response/auth") return;

    const promise = resolver.get(event.data.requestId);
    if (!promise) return;

    resolver.delete(event.data.requestId);
    const r = event.data.return;

    if (event.data.function === "connect" && r.data === true) {
      instance = event.data.params[0] === true ? ergo : Object.freeze(new NautilusErgoApi());
    } else if (event.data.function === "disconnect" && r.data === true) {
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

    #rpcCall(func, params) {
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

  const warnDeprecated = function (fnName) {
    console.warn(
      "[Deprecated] In order to avoid conflicts with another wallets, this method will be disabled and replaced by '" +
        fnName +
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
