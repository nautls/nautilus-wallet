import { onMessage, sendMessage } from "webext-bridge/background";
import { BridgeMessage, GetDataType, GetReturnType, isInternalEndpoint } from "webext-bridge";
import { isEmpty } from "@fleet-sdk/common";
import { JsonValue } from "type-fest";
import {
  AsyncRequest,
  AsyncRequestQueue,
  AsyncRequestType
} from "../connector/rpc/asyncRequestQueue";
import {
  DataWithPayload,
  error,
  InternalEvent,
  InternalRequest,
  success
} from "../connector/rpc/protocol";
import {
  checkConnection,
  getAddresses,
  getBalance,
  getCurrentHeight,
  getUTxOs
} from "./ergoHandlers";
import { APIErrorCode, TxSendErrorCode } from "@/types/connector";
import { createWindow } from "@/common/uiHelpers";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { browser } from "@/common/browser";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { addressesDbService } from "@/database/addressesDbService";
import { graphQLService } from "@/chains/ergo/services/graphQlService";

type AuthenticatedMessageHandler<T extends InternalRequest> = (
  // @ts-expect-error webext-bridge uses an older version of type-fest, so JsonValue is not recognized
  message: BridgeMessage<GetDataType<T, JsonValue>>,
  walletId: number
) => GetReturnType<T> | Promise<GetReturnType<T>>;

const NOT_CONNECTED_ERROR = error(APIErrorCode.InvalidRequest, "Not connected.");
const requests = new AsyncRequestQueue();

function onMessageAuth<T extends InternalRequest>(
  request: T,
  handler: AuthenticatedMessageHandler<T>
) {
  onMessage(request, async (msg) => {
    if (!isInternalEndpoint(msg.sender)) return NOT_CONNECTED_ERROR as GetReturnType<T>;
    const conn = await connectedDAppsDbService.getByOrigin(msg.data.payload.origin);
    if (!conn) return NOT_CONNECTED_ERROR as GetReturnType<T>;

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

onMessageAuth(InternalRequest.GetUTxOs, async ({ data }, walletId) => {
  const utxos = await getUTxOs(walletId, data.target);
  return success(utxos);
});

onMessageAuth(InternalRequest.GetBalance, async (msg, walletId) => {
  const tokenId = !msg.data.tokenId || msg.data.tokenId === "ERG" ? ERG_TOKEN_ID : msg.data.tokenId;
  const balance = await getBalance(walletId, tokenId);
  return success(balance);
});

onMessageAuth(InternalRequest.GetAddresses, async (msg, walletId) => {
  const addresses = await getAddresses(walletId, msg.data.filter);
  if (isEmpty(addresses)) {
    return error(APIErrorCode.InternalError, "No addresses found.");
  }

  return success(addresses);
});

onMessageAuth(InternalRequest.GetCurrentHeight, async () => {
  const height = await getCurrentHeight();
  return height
    ? success(height)
    : error(APIErrorCode.InternalError, "The height returned by the backend is invalid.");
});

onMessageAuth(InternalRequest.SubmitTransaction, async (msg, walletId) => {
  if (!msg.data.transaction) return invalidRequest("Invalid params.");

  try {
    const response = await graphQLService.submitTransaction(msg.data.transaction, walletId);
    return success(response.transactionId);
  } catch (e) {
    return error(TxSendErrorCode.Refused, (e as Error).message);
  }
});

onMessageAuth(InternalRequest.SignData, handleDataSigningRequest(InternalRequest.SignData));
onMessageAuth(InternalRequest.Auth, handleDataSigningRequest(InternalRequest.Auth));

function handleDataSigningRequest(request: InternalRequest.Auth | InternalRequest.SignData) {
  return async (
    msg: BridgeMessage<GetDataType<typeof request>>,
    walletId: number
  ): Promise<GetReturnType<typeof request>> => {
    if (!msg.data.address || !msg.data.message) return invalidRequest("Invalid params.");

    const address = await addressesDbService.getByScript(msg.data.address);
    if (address?.walletId !== walletId) {
      return invalidRequest("The address is not associated with the connected wallet.");
    }

    return await openWindow(request, msg.data, msg.sender.tabId);
  };
}

onMessageAuth(InternalRequest.SignTx, async (msg) => {
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
  graphQLService.setUrl(msg.data);
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
