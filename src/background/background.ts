import { RpcEvent, RpcMessage, RpcReturn, Session } from "../types/connector";
import { openWindow } from "@/utils/uiHelpers";
import { find, isEmpty } from "lodash";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import { postConnectorResponse } from "./messagingUtils";
import {
  handleGetBalanceRequest,
  handleGetBoxesRequest,
  handleGetChangeAddressRequest,
  handleGetAddressesRequest,
  handleNotImplementedRequest,
  handleSignTxRequest,
  handleSubmitTxRequest
} from "./ergoApiHandlers";
import { AddressState } from "@/types/internal";
import { Browser } from "@/utils/browserApi";
import "@/config/axiosConfig";

const sessions = new Map<number, Session>();
const ORIGIN_MATCHER = /^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i;

function getOrigin(url?: string) {
  if (!url) {
    return;
  }

  const matches = url.match(ORIGIN_MATCHER);
  if (matches) {
    return matches[1];
  }
}

Browser.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  console.log(`connected with ${getOrigin(port.sender?.url)}`);

  if (port.name === "nautilus-ui") {
    port.onMessage.addListener(
      async (message: RpcMessage | RpcEvent, port: chrome.runtime.Port) => {
        if (message.type === "rpc/nautilus-event") {
          switch (message.name) {
            case "loaded":
              sendRequestsToUI(port);
              break;
            case "disconnected":
              handleOriginDisconnect(message);
              break;
          }
        } else if (message.type === "rpc/nautilus-response") {
          handleNautilusResponse(message);
        }
      }
    );
  } else {
    port.onMessage.addListener(async (message: RpcMessage, port: chrome.runtime.Port) => {
      const origin = getOrigin(port.sender?.url);
      const tabId = port.sender?.tab?.id;
      if (message.type !== "rpc/connector-request" || !port.sender || !origin || !tabId) {
        return;
      }

      const session = sessions.get(tabId);
      switch (message.function) {
        case "connect":
          await handleConnectionRequest(message, port, origin);
          break;
        case "disconnect":
          await handleDisconnectRequest(message, port, origin);
          break;
        case "checkConnection":
          handleCheckConnectionRequest(message, port);
          break;
        case "getBoxes":
          await handleGetBoxesRequest(message, port, session);
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
        case "signTx":
          await handleSignTxRequest(message, port, session);
          break;
        case "signTxInput":
        case "signData":
          await handleNotImplementedRequest(message, port, session);
          break;
        case "submitTx":
          await handleSubmitTxRequest(message, port, sessions.get(tabId));
          break;
      }
    });
  }
});

function sendRequestsToUI(port: chrome.runtime.Port) {
  for (const [key, value] of sessions.entries()) {
    if (isEmpty(value.requestQueue)) {
      continue;
    }

    for (const request of value.requestQueue.filter((r) => !r.handled)) {
      if (request.message.function === "connect") {
        port.postMessage({
          type: "rpc/nautilus-request",
          sessionId: key,
          requestId: request.message.requestId,
          function: request.message.function,
          params: [value.origin, value.favicon]
        } as RpcMessage);
      } else if (request.message.function === "signTx") {
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
      } else {
        continue;
      }

      request.handled = true;
      return;
    }
  }
}

async function handleConnectionRequest(
  message: RpcMessage,
  port: chrome.runtime.Port,
  origin: string
) {
  let response: RpcReturn = { isSuccess: true, data: true };
  const connection = await connectedDAppsDbService.getByOrigin(origin);
  if (connection) {
    const tabId = port.sender?.tab?.id;
    if (!tabId || !port.sender?.url) {
      return;
    }

    response.data = { walletId: connection.walletId };
    sessions.set(tabId, {
      port,
      origin: connection.origin,
      favicon: port.sender.tab?.favIconUrl,
      walletId: connection.walletId,
      requestQueue: []
    });
  } else {
    response = await showConnectionWindow(message, port);
  }

  response = {
    isSuccess: response.isSuccess,
    data: response.data.walletId !== undefined
  };

  postConnectorResponse(response, message, port, "auth");
}

async function handleDisconnectRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  origin?: string
) {
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

function handleCheckConnectionRequest(request: RpcMessage, port: chrome.runtime.Port) {
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

function handleOriginDisconnect(event: RpcEvent) {
  const key = findSessionKeyByOrigin(event.data);
  if (key === undefined) {
    return;
  }

  const session = sessions.get(key);
  if (!session) {
    return;
  }

  sessions.delete(key);
  session.port.postMessage({
    type: "rpc/nautilus-event",
    name: event.name
  } as RpcEvent);
}

async function showConnectionWindow(
  message: RpcMessage,
  port: chrome.runtime.Port
): Promise<RpcReturn> {
  return new Promise((resolve, reject) => {
    const tabId = port.sender?.tab?.id;
    const origin = getOrigin(port.sender?.url);
    if (!tabId || !origin) {
      reject("invalid port");
      return;
    }

    sessions.set(tabId, {
      port,
      origin: origin,
      favicon: port.sender?.tab?.favIconUrl,
      requestQueue: [{ handled: false, message, resolve }]
    });

    openWindow(tabId);
  });
}

function findSessionKeyByOrigin(origin: string): number | undefined {
  for (const [key, value] of sessions.entries()) {
    if (value.origin === origin) {
      return key;
    }
  }
}
