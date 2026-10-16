import { BridgeMessage, Endpoint, GetReturnType } from "webext-bridge";
import { onMessage, sendMessage } from "webext-bridge/popup";
import { router } from "../router";
import { AsyncRequestQueue, AsyncRequestType } from "./asyncRequestQueue";
import { DataWithPayload, InternalEvent, InternalRequest } from "./protocol";

export const queue = new AsyncRequestQueue();

const BACKGROUND = "background";
const _ = undefined;

export function registerRpcHooks() {
  sendMessage(InternalEvent.Loaded, _, BACKGROUND);

  onMessage(InternalRequest.Connect, fromBackground(InternalRequest.Connect));
  onMessage(InternalRequest.Auth, fromBackground(InternalRequest.Auth));
  onMessage(InternalRequest.SignTx, fromBackground(InternalRequest.SignTx));
  onMessage(InternalRequest.SignData, fromBackground(InternalRequest.SignData));
  onMessage(InternalRequest.SignTxInputs, fromBackground(InternalRequest.SignTxInputs));
}

export function isFromBackground(sender: Pick<Endpoint, "context">) {
  return sender.context === BACKGROUND;
}

function fromBackground<T extends AsyncRequestType>(type: T) {
  return ({ data, sender }: Pick<BridgeMessage<DataWithPayload>, "data" | "sender">) => {
    if (!isFromBackground(sender)) throw new Error("Unauthorized sender.");
    return handle<GetReturnType<T>>(type, data);
  };
}

export function sendBackendServerUrl(url: string) {
  sendMessage(InternalEvent.UpdatedBackendUrl, url, BACKGROUND);
}

async function handle<T>(type: AsyncRequestType, data: DataWithPayload) {
  const { origin, favicon } = data.payload;
  const promise = queue.push<T>({ type, origin, favicon, data });
  await router.replace({ name: getRoute(type) });

  return promise;
}

function getRoute(requestType: AsyncRequestType) {
  if (requestType === InternalRequest.Connect) return "connector-connect";
  if (requestType === InternalRequest.Auth) return "connector-auth";
  if (requestType === InternalRequest.SignTx) return "connector-sign-tx";
  if (requestType === InternalRequest.SignTxInputs) return "connector-sign-tx";
  if (requestType === InternalRequest.SignData) return "connector-sign-data";
}
