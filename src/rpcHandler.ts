import router from "./router";
import { RpcMessage } from "./types/connector";

class RpcHandler {
  private _messages: RpcMessage[];
  private _port!: chrome.runtime.Port;

  constructor() {
    this._messages = [];
  }

  public postMessage(message: RpcMessage) {
    this._port.postMessage(message);
  }

  public start() {
    if (!chrome.runtime) {
      return;
    }

    this._port = chrome.runtime.connect({ name: "nautilus-ui" });
    this._port.postMessage({ type: "rpc/nautilus-response", function: "loaded" } as RpcMessage);

    this._port.onMessage.addListener((message: RpcMessage, port) => {
      if (!message.params) {
        port.postMessage("error: no params");
        return;
      }

      this._messages.push(message);

      if (message.type === "rpc/nautilus-request" && message.function === "requestAccess") {
        router.push({
          name: "connector-auth",
          query: { popup: "true", auth: "true" }
        });
      }
    });
  }

  public get messages() {
    return this._messages;
  }
}

export const rpcHandler = new RpcHandler();
