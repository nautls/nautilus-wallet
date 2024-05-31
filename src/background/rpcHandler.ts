import router from "@/router";
import { onMessage, sendMessage } from "webext-bridge/popup";
import { DataWithPayload, InternalEvent, InternalRequest } from "./messaging";
import { AsyncRequestQueue, AsyncRequestType } from "./asyncRequestQueue";
import { RouteLocationRaw } from "vue-router";

export const queue = new AsyncRequestQueue();
const _ = undefined;

export function startListening() {
  sendMessage(InternalEvent.Loaded, _, "background");

  onMessage(InternalRequest.Connect, ({ data }) => handle(InternalRequest.Connect, data));
  onMessage(InternalRequest.Auth, ({ data }) => handle(InternalRequest.Auth, data));
  onMessage(InternalRequest.SignTx, ({ data }) => handle(InternalRequest.SignTx, data));
  onMessage(InternalRequest.SignTxInputs, ({ data }) => handle(InternalRequest.SignTxInputs, data));
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
  if (requestType === InternalRequest.SignTxInputs) return "connector-sign-tx-input";
}
