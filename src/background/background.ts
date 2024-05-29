import { APIErrorCode, RpcEvent, RpcMessage, Session } from "../types/connector";
import { openWindow } from "@/utils/uiHelpers";
import { find, isEmpty } from "lodash-es";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import { postConnectorResponse } from "./messagingUtils";
import {
  handleAuthRequest,
  handleGetAddressesRequest,
  handleGetBalanceRequest,
  handleGetChangeAddressRequest,
  handleGetCurrentHeightRequest,
  handleNotImplementedRequest,
  handleSignTxRequest,
  handleSubmitTxRequest
} from "./ergoApiHandlers";
import { AddressState } from "@/types/internal";
import { browser, Port } from "@/utils/browserApi";
import { graphQLService } from "@/api/explorer/graphQlService";
import { onMessage, sendMessage } from "webext-bridge/background";
import { isInternalEndpoint } from "webext-bridge";
import {
  ErrorResult,
  InternalEvent,
  InternalMessagePayload,
  InternalRequest,
  SuccessResult
} from "./messaging";
import { AsyncRequestQueue } from "./asyncRequestQueue";
import { Box, isDefined } from "@fleet-sdk/common";
import { SelectionTarget } from "@nautilus-js/eip12-types";
import { BoxSelector, ErgoUnsignedInput } from "@fleet-sdk/core";
import { fetchBoxes } from "../api/ergo/boxFetcher";

const ORIGIN_MATCHER = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;

const sessions = new Map<number, Session>();
const requests = new AsyncRequestQueue();

onMessage(InternalRequest.Connect, async ({ data, sender }) => {
  if (!isInternalEndpoint(sender)) return false;

  const authorized = await checkConnection(data.payload.origin);
  if (authorized) return true;

  return await openConnectionWindow(data.payload.origin, sender.tabId);
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

onMessage(InternalRequest.GetUTxOs, async ({ sender, data }) => {
  if (!isInternalEndpoint(sender)) return error(APIErrorCode.InvalidRequest, "Not connected.");

  const connection = await connectedDAppsDbService.getByOrigin(data.payload.origin);
  if (!connection) return error(APIErrorCode.InvalidRequest, "Not connected.");

  const utxos = await getUTxOs(connection.walletId, data.target);
  return success(utxos);
});

async function getUTxOs(walletId: number, target?: SelectionTarget): Promise<Box<string>[]> {
  const boxes = await fetchBoxes(walletId);
  const selector = new BoxSelector(boxes.map((box) => new ErgoUnsignedInput(box))).orderBy(
    (box) => box.creationHeight
  );

  let selection!: ErgoUnsignedInput[];
  const selectionTarget = {
    nanoErgs: target?.nanoErgs ? BigInt(target.nanoErgs) : undefined,
    tokens:
      target?.tokens?.map((x) => ({
        tokenId: x.tokenId,
        amount: x.amount ? BigInt(x.amount) : undefined
      })) || []
  };

  try {
    selection = selector.select(selectionTarget);
  } catch {
    selection = [];
  }

  return selection.map((box) => ({
    ...box.toPlainObject("EIP-12"),
    confirmed: boxes.find((x) => x.boxId === box.boxId)?.confirmed || false
  }));
}

onMessage(InternalEvent.Loaded, async ({ sender }) => {
  if (!isInternalEndpoint(sender)) return;

  let request = requests.pop();
  while (request) {
    const payload: InternalMessagePayload = {
      origin: request.origin,
      requestId: request.id,
      favicon: request.favicon
    };

    switch (request.type) {
      case InternalRequest.Connect: {
        const granted = await sendMessage(InternalRequest.Connect, { payload }, "popup");
        request.resolve(granted);
        break;
      }
    }

    request = requests.pop();
  }
});

/**
 * Creates a success result object with the specified data.
 *
 * @template T - The type of the data.
 * @param data - The data to be included in the success result.
 * @returns A success result object containing the specified data.
 */
function success<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

/**
 * Creates an ErrorResult object with the specified API error code and information.
 * @param code - The API error code.
 * @param info - Additional information about the error.
 * @returns An ErrorResult object with the specified error code and information.
 */
function error(code: APIErrorCode, info: string): ErrorResult {
  return { success: false, error: { code, info } };
}

async function openConnectionWindow(origin: string, tabId: number): Promise<boolean> {
  const favicon = await getFavicon(tabId);
  const promise = requests.push<boolean>({ type: InternalRequest.Connect, origin, favicon });
  await openWindow(tabId);
  return promise;
}

async function checkConnection(origin: string): Promise<boolean> {
  const connection = await connectedDAppsDbService.getByOrigin(origin);
  return isDefined(connection) && isDefined(connection?.walletId);
}

async function getFavicon(tabId: number) {
  return (await browser?.tabs.get(tabId))?.favIconUrl;
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
    port.onMessage.addListener(async (message: RpcMessage | RpcEvent, port) => {
      if (message.type === "rpc/nautilus-event") {
        switch (message.name) {
          case "loaded":
            sendRequestsToUI(port);
            break;
          case "updated:graphql-url":
            graphQLService.updateServerUrl(message.data);
            break;
        }
      } else if (message.type === "rpc/nautilus-response") {
        handleNautilusResponse(message);
      }
    });
  } else {
    port.onMessage.addListener(async (message: RpcMessage, port) => {
      const origin = getHost(port.sender?.url);
      const tabId = port.sender?.tab?.id;
      if (message.type !== "rpc/connector-request" || !port.sender || !origin || !tabId) {
        return;
      }

      const session = sessions.get(tabId);
      switch (message.function) {
        case "disconnect":
          await handleDisconnectRequest(message, port, origin);
          break;
        case "checkConnection":
          handleCheckConnectionRequest(message, port);
          break;
        case "getBalance":
          await handleGetBalanceRequest(message, port, session);
          break;
        case "getUsedAddresses":
          await handleGetAddressesRequest(message, port, session, AddressState.Used);
          break;
        case "getUnusedAddresses":
          await handleGetAddressesRequest(message, port, session, AddressState.Unused);
          break;
        case "getChangeAddress":
          await handleGetChangeAddressRequest(message, port, session);
          break;
        case "auth":
          await handleAuthRequest(message, port, session);
          break;
        case "signTxInputs":
        case "signTx":
          await handleSignTxRequest(message, port, session);
          break;
        case "signData":
          await handleNotImplementedRequest(message, port, session);
          break;
        case "getCurrentHeight":
          await handleGetCurrentHeightRequest(message, port, session);
          break;
        case "submitTx":
          await handleSubmitTxRequest(message, port, sessions.get(tabId));
          break;
      }
    });
  }
});

function sendRequestsToUI(port: Port) {
  for (const [key, value] of sessions.entries()) {
    if (isEmpty(value.requestQueue)) {
      continue;
    }

    for (const request of value.requestQueue.filter((r) => !r.handled)) {
      if (request.message.function === "signTx") {
        port.postMessage({
          type: "rpc/nautilus-request",
          sessionId: key,
          requestId: request.message.requestId,
          function: request.message.function,
          params: [
            value.origin,
            value.favicon,
            request.message.params ? request.message.params[0] : undefined
          ]
        } as RpcMessage);
      } else if (request.message.function === "signTxInputs") {
        port.postMessage({
          type: "rpc/nautilus-request",
          sessionId: key,
          requestId: request.message.requestId,
          function: request.message.function,
          params: [
            value.origin,
            value.favicon,
            request.message.params ? request.message.params[0] : undefined,
            request.message.params ? request.message.params[1] : undefined
          ]
        } as RpcMessage);
      } else if (request.message.function === "auth") {
        port.postMessage({
          type: "rpc/nautilus-request",
          sessionId: key,
          requestId: request.message.requestId,
          function: request.message.function,
          params: [value.origin, value.favicon].concat(
            request.message.params ? request.message.params : undefined
          )
        } as RpcMessage);
      } else {
        continue;
      }

      request.handled = true;
      return;
    }
  }
}

async function handleDisconnectRequest(request: RpcMessage, port: Port, origin?: string) {
  if (!origin) {
    postConnectorResponse(
      {
        isSuccess: true,
        data: false
      },
      request,
      port,
      "auth"
    );

    return;
  }

  await connectedDAppsDbService.deleteByOrigin(origin);
  sessions.forEach((value, key) => {
    if (value.origin === origin) {
      sessions.delete(key);
    }
  });

  postConnectorResponse(
    {
      isSuccess: true,
      data: true
    },
    request,
    port,
    "auth"
  );
}

function handleCheckConnectionRequest(request: RpcMessage, port: Port) {
  const tabId = port.sender?.tab?.id;
  const session = tabId !== undefined ? sessions.get(tabId) : undefined;

  postConnectorResponse(
    {
      isSuccess: true,
      data: session !== undefined && session.walletId !== undefined
    },
    request,
    port,
    "auth"
  );
}

function handleNautilusResponse(message: RpcMessage) {
  const session = sessions.get(message.sessionId);
  if (!session) {
    return;
  }

  if (message.function === "connect" && message.return && message.return.isSuccess) {
    session.walletId = message.return.data.walletId;
  }

  const request = find(session.requestQueue, (r) => r.message.requestId === message.requestId);
  request?.resolve(message?.return || { isSuccess: false });
}
