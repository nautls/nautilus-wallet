import { APIErrorCode, RpcEvent, RpcMessage, Session } from "../types/connector";
import { createWindow } from "@/utils/uiHelpers";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import {
  checkConnection,
  getAddresses,
  getBalance,
  getCurrentHeight,
  getUTxOs,
  handleSubmitTxRequest
} from "./ergoApiHandlers";
import { browser } from "@/utils/browserApi";
import { graphQLService } from "@/api/explorer/graphQlService";
import { onMessage, sendMessage } from "webext-bridge/background";
import { BridgeMessage, GetReturnType, isInternalEndpoint } from "webext-bridge";
import {
  DataWithPayload,
  error,
  InternalEvent,
  InternalMessagePayload,
  InternalRequest,
  success
} from "./messaging";
import { AsyncRequest, AsyncRequestQueue, AsyncRequestType } from "./asyncRequestQueue";
import { isEmpty } from "@fleet-sdk/common";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { addressesDbService } from "@/api/database/addressesDbService";

type SuccessfulConnection = { success: true; walletId: number };

const ORIGIN_MATCHER = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;

const sessions = new Map<number, Session>();
const requests = new AsyncRequestQueue();

onMessage(InternalRequest.Connect, async ({ data, sender }) => {
  if (!isInternalEndpoint(sender)) return false;

  const authorized = await checkConnection(data.payload.origin);
  if (authorized) return true;
  return await openWindow(InternalRequest.Connect, data, sender.tabId);
});

onMessage(InternalRequest.CheckConnection, async ({ sender, data }) => {
  if (!isInternalEndpoint(sender)) return false;
  return await checkConnection(data.payload.origin);
});

onMessage(InternalRequest.Disconnect, async ({ sender, data }) => {
  if (!isInternalEndpoint(sender)) return false;
  await connectedDAppsDbService.deleteByOrigin(data.payload.origin);
  const connected = await checkConnection(data.payload.origin);
  return !connected;
});

const NOT_CONNECTED_ERROR = error(APIErrorCode.InvalidRequest, "Not connected.");

onMessage(InternalRequest.GetUTxOs, async (msg) => {
  const check = await validate(msg);
  if (!check.success) return check;

  const utxos = await getUTxOs(check.walletId, msg.data.target);
  return success(utxos);
});

onMessage(InternalRequest.GetBalance, async (msg) => {
  const check = await validate(msg);
  if (!check.success) return check;

  const tokenId = !msg.data.tokenId || msg.data.tokenId === "ERG" ? ERG_TOKEN_ID : msg.data.tokenId;
  const balance = await getBalance(check.walletId, tokenId);
  return success(balance);
});

onMessage(InternalRequest.GetAddresses, async (msg) => {
  const check = await validate(msg);
  if (!check.success) return check;

  const addresses = await getAddresses(check.walletId, msg.data.filter);
  if (isEmpty(addresses)) return error(APIErrorCode.InternalError, "No addresses found.");

  return success(addresses);
});

onMessage(InternalRequest.GetCurrentHeight, async (msg) => {
  const check = await validate(msg);
  if (!check.success) return check;

  const height = await getCurrentHeight();
  return height
    ? success(height)
    : error(APIErrorCode.InternalError, "The height returned by the backend is invalid.");
});

onMessage(InternalRequest.SignData, async (msg) => {
  const check = await validate(msg);
  if (!check.success) return check;

  return invalidRequest("Not implemented.");
});

onMessage(InternalRequest.Auth, async (msg) => {
  const check = await validate(msg);
  if (!check.success) return check;
  if (!msg.data.address || !msg.data.message) return invalidRequest("Invalid params.");

  const address = await addressesDbService.getByScript(msg.data.address);
  if (!address || address.walletId !== check.walletId) {
    return invalidRequest("The address is not associated with the connected wallet.");
  }

  return await openWindow(InternalRequest.Auth, msg.data, msg.sender.tabId);
});

onMessage(InternalRequest.SignTx, async (msg) => {
  const check = await validate(msg);
  if (!check.success) return check;
  if (!msg.data.transaction) return invalidRequest("Invalid params.");

  return await openWindow(InternalRequest.SignTx, msg.data, msg.sender.tabId);
});

async function validate({ sender, data }: BridgeMessage<DataWithPayload>) {
  if (!isInternalEndpoint(sender)) return NOT_CONNECTED_ERROR;

  const connection = await connectedDAppsDbService.getByOrigin(data.payload.origin);
  if (!connection) return NOT_CONNECTED_ERROR;

  return { success: true, walletId: connection.walletId } as SuccessfulConnection;
}

onMessage(InternalEvent.Loaded, async ({ sender }) => {
  if (!isInternalEndpoint(sender)) return;

  let request: AsyncRequest | undefined;
  do {
    request = requests.pop();
    if (!request) continue;

    const payload: InternalMessagePayload = {
      origin: request.origin,
      requestId: request.id,
      favicon: request.favicon
    };
    const data = request.data ? { payload, ...request.data } : { payload };

    const result = await sendMessage(request.type, data, "popup");
    request.resolve(result);
  } while (request);
});

async function openWindow<T extends AsyncRequestType>(
  request: T,
  data: DataWithPayload,
  tabId: number
) {
  if (!data.payload.favicon) {
    data.payload.favicon = await getFavicon(tabId);
  }

  const promise = requests.push<GetReturnType<T>>({
    type: request,
    origin: data.payload.origin,
    data
  });

  await createWindow(tabId);
  return promise;
}

async function getFavicon(tabId: number) {
  return (await browser?.tabs.get(tabId))?.favIconUrl;
}

function invalidRequest(info: string) {
  return error(APIErrorCode.InvalidRequest, info);
}

function getHost(url?: string) {
  if (!url) return;

  const matches = url.match(ORIGIN_MATCHER);
  if (matches) return matches[1];
}

browser?.runtime.onConnect.addListener((port) => {
  // eslint-disable-next-line no-console
  console.log(`connected with ${getHost(port.sender?.url)}`);

  if (port.name === "nautilus-ui") {
    port.onMessage.addListener(async (message: RpcMessage | RpcEvent) => {
      if (message.type === "rpc/nautilus-event") {
        switch (message.name) {
          case "updated:graphql-url":
            graphQLService.updateServerUrl(message.data);
            break;
        }
      }
    });
  } else {
    port.onMessage.addListener(async (message: RpcMessage, port) => {
      const origin = getHost(port.sender?.url);
      const tabId = port.sender?.tab?.id;
      if (message.type !== "rpc/connector-request" || !port.sender || !origin || !tabId) {
        return;
      }

      // const session = sessions.get(tabId);
      switch (message.function) {
        case "submitTx":
          await handleSubmitTxRequest(message, port, sessions.get(tabId));
          break;
      }
    });
  }
});
