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
