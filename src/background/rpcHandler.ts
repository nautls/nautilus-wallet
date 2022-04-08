import router from "@/router";
import { RpcEvent, RpcMessage } from "@/types/connector";
import { Browser } from "@/utils/browserApi";

class RpcHandler {
  private _messages: RpcMessage[];
  private _port!: chrome.runtime.Port;

  constructor() {
    this._messages = [];
  }

  public sendMessage(message: RpcMessage): void {
    this._sendMessage(message);
  }

  private _sendMessage(message: any): void {
    if (!this._port) {
      throw Error("communication port is undefined");
    }

    this._port.postMessage(message);
  }

  public sendEvent(event: string, data?: any): void;
  public sendEvent(event: RpcEvent): void;
  public sendEvent(event: RpcEvent | string, data?: any): void {
    if (typeof event === "string") {
      this._sendMessage({
        type: "rpc/nautilus-event",
        name: event,
        data
      } as RpcEvent);

      return;
    }

    this._sendMessage(event);
  }

  public sendDisconnectedEvent(origin: string): void {
    this.sendEvent("disconnected", origin);
  }

  public start(): void {
    if (!Browser.runtime) {
      return;
    }

    this._port = Browser.runtime.connect({ name: "nautilus-ui" });
    this.sendEvent("loaded");

    this._port.onMessage.addListener((message: RpcMessage, port) => {
      if (message.type !== "rpc/nautilus-request") {
        return;
      }

      switch (message.function) {
        case "connect":
          router.replace({
            name: "connector-auth",
            query: { popup: "true", auth: "true" }
          });
          break;
        case "signTx":
          router.replace({
            name: "connector-sign-tx",
            query: { popup: "true" }
          });
          break;
        default:
          return;
      }

      this._messages.push(message);
    });
  }

  public get messages(): RpcMessage[] {
    return this._messages;
  }
}

export const rpcHandler = new RpcHandler();
