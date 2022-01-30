import { RpcEvent, RpcMessage, RpcReturn, Session } from "../types/connector";
import { getBoundsForTabWindow } from "@/utils/uiHelpers";
import { find, isEmpty } from "lodash";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import { postResponse } from "./messagingUtils";
import {
  handleGetBalanceRequest,
  handleGetBoxesRequest,
  handleGetChangeAddressRequest,
  handleGetUsedAddressesRequest as handleGetAddressesRequest
} from "./ergoApiHadlers";
import { AddressState } from "@/types/internal";

const POPUP_SIZE = { width: 365, height: 630 };

const sessions = new Map<number, Session>();

chrome.runtime.onConnect.addListener((port) => {
  console.log(`connected with ${port.sender?.origin}`);

  if (port.name === "nautilus-ui") {
    port.onMessage.addListener(async (message: RpcMessage | RpcEvent, port) => {
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
        switch (message.function) {
          case "connect":
            handleConnectionResponse(message);
            break;
        }
      }
    });
  } else {
    port.onMessage.addListener(async (message: RpcMessage, port) => {
      if (message.type !== "rpc/connector-request" || !port.sender || !port.sender.origin) {
        return;
      }

      const tabId = port.sender?.tab?.id;
      if (!tabId || !port.sender?.origin) {
        return;
      }

      switch (message.function) {
        case "connect":
          await handleConnectionRequest(message, port, port.sender.origin);
          break;
        case "checkConnection":
          handleCheckConnectionRequest(message, port);
          break;
        case "getBoxes":
          await handleGetBoxesRequest(message, port, sessions.get(tabId));
          break;
        case "getBalance":
          await handleGetBalanceRequest(message, port, sessions.get(tabId));
          break;
        case "getUsedAddresses":
          await handleGetAddressesRequest(message, port, sessions.get(tabId), AddressState.Used);
          break;
        case "getUnusedAddresses":
          await handleGetAddressesRequest(message, port, sessions.get(tabId), AddressState.Unused);
          break;
        case "getChangeAddress":
          await handleGetChangeAddressRequest(message, port, sessions.get(tabId));
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
        request.handled = true;
        port.postMessage({
          type: "rpc/nautilus-request",
          sessionId: key,
          requestId: request.message.requestId,
          function: "connect",
          params: [value.origin, value.favicon]
        } as RpcMessage);
      }
    }
  }
}

async function handleConnectionRequest(
  message: RpcMessage,
  port: chrome.runtime.Port,
  origin: string
) {
  let response: RpcReturn = { isSuccess: true, data: true };
  const connection = await connectedDAppsDbService.getFromOrigin(origin);
  if (connection) {
    const tabId = port.sender?.tab?.id;
    if (!tabId || !port.sender?.origin) {
      return;
    }

    response.data = { walletId: connection.walletId };
    sessions.set(tabId, {
      port,
      origin: connection.origin,
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

  postResponse(response, message, port);
}

function handleCheckConnectionRequest(request: RpcMessage, port: chrome.runtime.Port) {
  const tabId = port.sender?.tab?.id;
  const session = tabId !== undefined ? sessions.get(tabId) : undefined;

  postResponse(
    {
      isSuccess: true,
      data: session !== undefined && session.walletId !== undefined
    },
    request,
    port
  );
}

function handleConnectionResponse(message: RpcMessage) {
  const session = sessions.get(message.sessionId);
  if (!session) {
    return;
  }

  if (message.return && message.return.isSuccess) {
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
    if (!tabId || !port.sender?.origin) {
      return;
    }

    sessions.set(tabId, {
      port,
      origin: port.sender.origin,
      favicon: port.sender.tab?.favIconUrl,
      requestQueue: [{ handled: false, message: message, resolve }]
    });

    openWindow(port.sender?.tab?.id);
  });
}

function findSessionKeyByOrigin(origin: string): number | undefined {
  for (const [key, value] of sessions.entries()) {
    if (value.origin === origin) {
      return key;
    }
  }
}

async function openWindow(tabId?: number) {
  const bounds = await getBoundsForTabWindow(tabId);
  chrome.windows.create({
    ...POPUP_SIZE,
    focused: true,
    type: "popup",
    url: chrome.extension.getURL("index.html"),
    left: bounds.width + bounds.positionX - (POPUP_SIZE.width + 10),
    top: bounds.positionY + 40
  });
}