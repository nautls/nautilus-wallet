import { onMessage, sendMessage } from "webext-bridge/popup";
import { router } from "../router";
import { AsyncRequestQueue, AsyncRequestType } from "./asyncRequestQueue";
import { DataWithPayload, InternalEvent, InternalRequest } from "./protocol";

export const queue = new AsyncRequestQueue();

const BACKGROUND = "background";
const _ = undefined;

export function registerRpcHooks() {
  sendMessage(InternalEvent.Loaded, _, BACKGROUND);

  onMessage(InternalRequest.Connect, ({ data }) => handle(InternalRequest.Connect, data));
  onMessage(InternalRequest.Auth, ({ data }) => handle(InternalRequest.Auth, data));
  onMessage(InternalRequest.SignTx, ({ data }) => handle(InternalRequest.SignTx, data));
  onMessage(InternalRequest.SignData, ({ data }) => handle(InternalRequest.SignData, data));
  onMessage(InternalRequest.SignTxInputs, ({ data }) => handle(InternalRequest.SignTxInputs, data));
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
