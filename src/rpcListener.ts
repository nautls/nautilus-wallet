import router from "./router";
import { RpcMessage } from "./types/connector";

class RpcListener {
  private _messages: RpcMessage[];

  constructor() {
    this._messages = [];
  }

  public start() {
    if (!chrome.runtime) {
      return;
    }

    const port = chrome.runtime.connect({ name: "nautilus-ui" });
    port.postMessage({ type: "rpc/nautilus-request", function: "loaded" } as RpcMessage);

    port.onMessage.addListener((message: RpcMessage, port) => {
      if (!message.params) {
        port.postMessage("error: no params");
        return;
      }

      if (message.type === "rpc/nautilus-request") {
        router.push({
          name: "connector-auth",
          query: { popup: "true", auth: "true" },
          params: {
            tabId: message.params[0],
            origin: message.params[1],
            favicon: message.params[2]
          }
        });
      }
    });
  }

  public get messages() {
    return this._messages;
  }
}

export const rpcListener = new RpcListener();
