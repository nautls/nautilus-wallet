import { APIErrorCode, TxSendErrorCode } from "@/types/connector";
import { createWindow } from "@/common/uiHelpers";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import {
  checkConnection,
  getAddresses,
  getBalance,
  getCurrentHeight,
  getUTxOs
} from "./ergoHandlers";
import { browser } from "@/common/browserApi";
import { onMessage, sendMessage } from "webext-bridge/background";
import { BridgeMessage, GetDataType, GetReturnType, isInternalEndpoint } from "webext-bridge";
import { DataWithPayload, error, InternalEvent, InternalRequest, success } from "@/rpc/protocol";
import { AsyncRequest, AsyncRequestQueue, AsyncRequestType } from "@/rpc/asyncRequestQueue";
import { isEmpty } from "@fleet-sdk/common";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { addressesDbService } from "@/api/database/addressesDbService";
import { submitTx } from "@/api/ergo/submitTx";
import { graphQLService } from "@/api/explorer/graphQlService";
import { JsonValue } from "@/types/internal";

type AuthenticatedMessageHandler<T extends InternalRequest> = (
  message: BridgeMessage<GetDataType<T, JsonValue>>,
  walletId?: number
) => GetReturnType<T> | Promise<GetReturnType<T>>;

const NOT_CONNECTED_ERROR = error(APIErrorCode.InvalidRequest, "Not connected.");
const requests = new AsyncRequestQueue();

function onAuthenticatedMessage<T extends InternalRequest>(
  request: T,
  handler: AuthenticatedMessageHandler<T>
) {
  onMessage(request, async (msg) => {
    if (!isInternalEndpoint(msg.sender)) return handler(msg);
    const conn = await connectedDAppsDbService.getByOrigin(msg.data.payload.origin);
    if (!conn) return handler(msg);

    return handler(msg, conn.walletId);
  });
}

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

onAuthenticatedMessage(InternalRequest.GetUTxOs, async ({ data }, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;

  const utxos = await getUTxOs(walletId, data.target);
  return success(utxos);
});

onAuthenticatedMessage(InternalRequest.GetBalance, async (msg, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;

  const tokenId = !msg.data.tokenId || msg.data.tokenId === "ERG" ? ERG_TOKEN_ID : msg.data.tokenId;
  const balance = await getBalance(walletId, tokenId);
  return success(balance);
});

onAuthenticatedMessage(InternalRequest.GetAddresses, async (msg, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;

  const addresses = await getAddresses(walletId, msg.data.filter);
  if (isEmpty(addresses)) return error(APIErrorCode.InternalError, "No addresses found.");

  return success(addresses);
});

onAuthenticatedMessage(InternalRequest.GetCurrentHeight, async (_, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;

  const height = await getCurrentHeight();
  return height
    ? success(height)
    : error(APIErrorCode.InternalError, "The height returned by the backend is invalid.");
});

onAuthenticatedMessage(InternalRequest.SubmitTransaction, async (msg, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;
  if (!msg.data.transaction) return invalidRequest("Invalid params.");

  try {
    const response = await submitTx(msg.data.transaction, walletId);
    return success(response);
  } catch (e) {
    return error(TxSendErrorCode.Refused, (e as Error).message);
  }
});

onAuthenticatedMessage(InternalRequest.SignData, async (msg, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;
  return invalidRequest("Not implemented.");
});

onAuthenticatedMessage(InternalRequest.Auth, async (msg, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;
  if (!msg.data.address || !msg.data.message) return invalidRequest("Invalid params.");

  const address = await addressesDbService.getByScript(msg.data.address);
  if (!address || address.walletId !== walletId) {
    return invalidRequest("The address is not associated with the connected wallet.");
  }

  return await openWindow(InternalRequest.Auth, msg.data, msg.sender.tabId);
});

onAuthenticatedMessage(InternalRequest.SignTx, async (msg, walletId) => {
  if (!walletId) return NOT_CONNECTED_ERROR;
  if (!msg.data.transaction) return invalidRequest("Invalid params.");

  return await openWindow(InternalRequest.SignTx, msg.data, msg.sender.tabId);
});

onMessage(InternalEvent.Loaded, async ({ sender }) => {
  if (!isInternalEndpoint(sender)) return;

  let request: AsyncRequest | undefined;
  do {
    request = requests.pop();
    if (!request) continue;

    const payload = { origin: request.origin, favicon: request.favicon };
    const data = request.data ? { payload, ...request.data } : { payload };

    const result = await sendMessage(request.type, data, "popup");
    request.resolve(result);
  } while (request);
});

onMessage(InternalEvent.UpdatedBackendUrl, (msg) => {
  if (!isInternalEndpoint(msg.sender) || !msg.data) return;
  graphQLService.updateServerUrl(msg.data);
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
