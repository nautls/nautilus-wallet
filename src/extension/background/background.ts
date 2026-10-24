import type { SignedTransaction, UnsignedTransaction } from "@fleet-sdk/common";
import { blake2b256, hex, utf8 } from "@fleet-sdk/crypto";
import { serializeTransaction } from "@fleet-sdk/serializer";
import type { JsonValue } from "type-fest";
import { BridgeMessage, GetDataType, GetReturnType, isInternalEndpoint } from "webext-bridge";
import { onMessage, sendMessage } from "webext-bridge/background";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { browser } from "@/common/browser";
import { log } from "@/common/logger";
import { createWindow } from "@/common/uiHelpers";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { addressesDbService } from "@/database/addressesDbService";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { walletsDbService } from "@/database/walletsDbService";
import { APIErrorCode, TxSendErrorCode } from "@/types/connector";
import { AsyncRequestQueue, AsyncRequestType } from "../connector/rpc/asyncRequestQueue";
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

type AuthenticatedMessageHandler<T extends InternalRequest> = (
  // @ts-expect-error webext-bridge uses an older version of type-fest, so JsonValue is not recognized
  message: BridgeMessage<GetDataType<T, JsonValue>>,
  walletId: number
) => GetReturnType<T> | Promise<GetReturnType<T>>;

const NOT_CONNECTED_ERROR = error(APIErrorCode.InvalidRequest, "Not connected.");
const KEEP_ALIVE_INTERVAL = 20_000;
const requests = new AsyncRequestQueue();
const pendingRequests = new Map<string, Promise<unknown>>();
let windowLock = Promise.resolve();
let keepAliveTimer: ReturnType<typeof setInterval> | undefined;

// `storage.local` holds the encrypted wallets and, unlike IndexedDB, is readable from
// content scripts by default. So we restrict it to extension pages and the service
// worker on supported browsers
(browser?.storage.local as Partial<Pick<chrome.storage.StorageArea, "setAccessLevel">>)
  ?.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" })
  .catch((e) => log.error(e));

browser?.runtime.onInstalled.addListener(() => {
  walletsDbService.migrate().catch((e) => log.error(e));
});

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
  if (msg.data.filter === "change" && !addresses) {
    return error(APIErrorCode.InternalError, "No addresses found.");
  }

  return success(addresses ?? []);
});

onMessageAuth(InternalRequest.GetCurrentHeight, async () => {
  const height = await getCurrentHeight();
  return height
    ? success(height)
    : error(APIErrorCode.InternalError, "The height returned by the backend is invalid.");
});

onMessageAuth(InternalRequest.SubmitTransaction, async (msg, walletId) => {
  if (!msg.data.transaction) return invalidRequest("Invalid params.");
  if (!isValidSignedTx(msg.data.transaction)) return invalidRequest("Invalid signed transaction.");

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

  let txHash: string;
  try {
    txHash = hashTransaction(msg.data.transaction);
  } catch {
    return invalidRequest("Invalid transaction.");
  }

  return await openWindow(InternalRequest.SignTx, msg.data, msg.sender.tabId, txHash);
});

onMessageAuth(InternalRequest.SignTxInputs, async (msg) => {
  const { transaction, indexes } = msg.data;
  if (!transaction || !Array.isArray(indexes) || indexes.length === 0) {
    return invalidRequest("Invalid params.");
  }

  let txHash: string;
  try {
    txHash = hashTransaction(transaction);
  } catch {
    return invalidRequest("Invalid transaction.");
  }

  const isValidIndex = (i: unknown) =>
    Number.isInteger(i) && (i as number) >= 0 && (i as number) < transaction.inputs.length;
  if (!indexes.every(isValidIndex) || new Set(indexes).size !== indexes.length) {
    return invalidRequest("Invalid input indexes.");
  }

  const argsHash = `${txHash}:${indexes.join(",")}`;
  return await openWindow(InternalRequest.SignTxInputs, msg.data, msg.sender.tabId, argsHash);
});

onMessage(InternalEvent.Loaded, async ({ sender }) => {
  if (!isInternalEndpoint(sender)) return;

  const request = requests.pop();
  if (!request) return;

  const payload = { origin: request.origin, favicon: request.favicon };
  const data = request.data ? { payload, ...request.data } : { payload };

  try {
    request.resolve(await sendMessage(request.type, data, "popup"));
  } catch (e) {
    request.reject(e);
  }
});

onMessage(InternalEvent.UpdatedBackendUrl, (msg) => {
  if (!isInternalEndpoint(msg.sender) || !msg.data) return;
  graphQLService.setUrl(msg.data);
});

/**
 * Opens a connector window for the request. Identical requests made while the first
 * one is still pending share its result instead of opening a new window.
 */
function openWindow<T extends AsyncRequestType>(
  request: T,
  data: DataWithPayload,
  tabId: number,
  argsHash = hashArgs(data)
): Promise<GetReturnType<T>> {
  const key = `${request}:${data.payload.origin}:${argsHash}`;
  const pending = pendingRequests.get(key);
  if (pending) return pending as Promise<GetReturnType<T>>;

  const promise = enqueueWindow(request, data, tabId).finally(() => {
    pendingRequests.delete(key);
    if (pendingRequests.size === 0) stopKeepAlive();
  });

  pendingRequests.set(key, promise);
  startKeepAlive();
  return promise;
}

/**
 * MV3 service workers are terminated after ~30 seconds without events, which would drop
 * pending requests while the user is still interacting with the connector window. Calling
 * an extension API periodically resets the idle timer.
 * https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#keep_a_service_worker_alive_until_a_long-running_operation_is_finished
 */
function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => browser?.runtime.getPlatformInfo(), KEEP_ALIVE_INTERVAL);
}

function stopKeepAlive() {
  clearInterval(keepAliveTimer);
  keepAliveTimer = undefined;
}

function hashArgs(data: DataWithPayload) {
  const args = JSON.stringify({ ...data, payload: undefined });
  return hex.encode(blake2b256(utf8.decode(args)));
}

function hashTransaction(transaction: UnsignedTransaction) {
  return hex.encode(blake2b256(serializeTransaction(transaction).toBytes()));
}

function isValidSignedTx(transaction: SignedTransaction) {
  if (!transaction.id) return false;

  try {
    serializeTransaction(transaction);

    const inputs = transaction.inputs.map((input) => ({
      boxId: input.boxId,
      extension: input.spendingProof?.extension ?? {}
    }));

    return hashTransaction({ ...transaction, inputs }) === transaction.id;
  } catch {
    return false;
  }
}

async function enqueueWindow<T extends AsyncRequestType>(
  request: T,
  data: DataWithPayload,
  tabId: number
): Promise<GetReturnType<T>> {
  const previous = windowLock;
  let release!: () => void;
  windowLock = new Promise((resolve) => (release = resolve));

  await previous;
  try {
    return await showWindow(request, data, tabId, release);
  } catch (e) {
    release();
    throw e;
  }
}

async function showWindow<T extends AsyncRequestType>(
  request: T,
  data: DataWithPayload,
  tabId: number,
  onClose: () => void
) {
  if (!data.payload.favicon) {
    data.payload.favicon = await getFavicon(tabId);
  }

  const promise = requests.push<GetReturnType<T>>({
    type: request,
    origin: data.payload.origin,
    data
  });

  let window: Awaited<ReturnType<typeof createWindow>>;
  try {
    window = await createWindow(tabId);
  } catch (e) {
    requests.pop();
    throw e;
  }

  const onRemoved = (windowId: number) => {
    if (windowId !== window.id) return;
    browser?.windows.onRemoved.removeListener(onRemoved);

    // the window was closed before the request could be delivered to it
    requests.pop()?.reject(new Error("Connector window closed."));
    onClose();
  };

  browser?.windows.onRemoved.addListener(onRemoved);
  return promise;
}

async function getFavicon(tabId: number) {
  return (await browser?.tabs.get(tabId))?.favIconUrl;
}

function invalidRequest(info: string) {
  return error(APIErrorCode.InvalidRequest, info);
}
