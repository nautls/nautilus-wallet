import router from "@/router";
import { RpcEvent, RpcMessage } from "@/types/connector";
import { browser, Port } from "@/utils/browserApi";
import { onMessage, sendMessage } from "webext-bridge/popup";
import { DataWithPayload, InternalEvent, InternalRequest } from "./messaging";
import { AsyncRequestQueue, AsyncRequestType } from "./asyncRequestQueue";
import { RouteLocationRaw } from "vue-router";

export const queue = new AsyncRequestQueue();
const _ = undefined;

export function listen() {
  sendMessage(InternalEvent.Loaded, _, "background");

  onMessage(InternalRequest.Connect, ({ data }) => handle(InternalRequest.Connect, data));
  onMessage(InternalRequest.Auth, ({ data }) => handle(InternalRequest.Auth, data));
}

async function handle<T>(type: AsyncRequestType, data: DataWithPayload) {
  const promise = queue.push<T>({
    type,
    origin: data.payload.origin,
    favicon: data.payload.favicon,
    data
  });
  const route: RouteLocationRaw = { name: getRoute(type), query: { popup: "true" } };
  if (type === InternalRequest.Connect) route.query!.auth = "true";
  await router.replace(route);

  return promise;
}

function getRoute(requestType: AsyncRequestType) {
  if (requestType === InternalRequest.Connect) return "connector-connect";
  if (requestType === InternalRequest.Auth) return "connector-auth";
  if (requestType === InternalRequest.SignTx) return "connector-sign-tx";
}

class RpcHandler {
  private _messages: RpcMessage[];
  private _port!: Port;

  constructor() {
    this._messages = [];
  }

  public get connected(): boolean {
    return !!this._port;
  }

  public sendMessage(message: RpcMessage): void {
    this._sendMessage(message);
  }

  private _sendMessage(message: unknown): void {
    if (!this._port) {
      throw Error("communication port is undefined");
    }

    this._port.postMessage(message);
  }

  public sendEvent(event: string, data?: unknown): void;
  public sendEvent(event: RpcEvent): void;
  public sendEvent(event: RpcEvent | string, data?: unknown): void {
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
    if (!browser?.runtime) return;

    this._port = browser.runtime.connect({ name: "nautilus-ui" });
    this.sendEvent("loaded");

    this._port.onMessage.addListener((message: RpcMessage) => {
      if (message.type !== "rpc/nautilus-request") {
        return;
      }

      switch (message.function) {
        case "connect":
          router.replace({
            name: "connector-connect",
            query: { popup: "true", auth: "true" }
          });
          break;
        case "signTxInputs":
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
