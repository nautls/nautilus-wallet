import {
  APIError,
  APIErrorCode,
  RpcEvent,
  RpcMessage,
  RpcReturn,
  Session
} from "../types/connector";
import { getBoundsForTabWindow } from "@/utils/uiHelpers";
import { find, isEmpty } from "lodash";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import { assestsDbService } from "@/api/database/assetsDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { explorerService } from "@/api/explorer/explorerService";
import { ErrorCodes } from "vue/node_modules/@vue/compiler-core";

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
      }
    });
  }
});

async function handleGetBoxesRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateRequest(session, request, port)) {
    return;
  }

  let tokenId = ERG_TOKEN_ID;

  if (request.params) {
    tokenId = request.params[1] as string;
    if (!tokenId || tokenId === "ERG") {
      tokenId = ERG_TOKEN_ID;
    }

    let error: APIError | undefined = undefined;

    if (request.params[0]) {
      error = {
        code: APIErrorCode.InvalidRequest,
        info: "box query per amount is not implemented"
      };
    }
    if (request.params[2]) {
      error = {
        code: APIErrorCode.InvalidRequest,
        info: "pagination is not implemented"
      };
    }

    if (error) {
      postErrorMessage(error, request, port);
    }
  }

  const addresses = await assestsDbService.getAssetHoldingAddresses(session!.walletId!, tokenId);
  const boxes = await explorerService.getUnspentBoxes(addresses);
  postResponse({ isSuccess: true, data: boxes.map((b) => b.data).flat() }, request, port);
}

function validateRequest(
  session: Session | undefined,
  request: RpcMessage,
  port: chrome.runtime.Port
): boolean {
  let error: APIError | undefined;

  if (!session) {
    error = { code: APIErrorCode.InvalidRequest, info: "not connected" };
  } else if (session.walletId === undefined) {
    error = { code: APIErrorCode.Refused, info: "not authorized" };
  }

  if (error) {
    postErrorMessage(error, request, port);
    return false;
  }

  return true;
}

function postErrorMessage(error: APIError, request: RpcMessage, port: chrome.runtime.Port) {
  postResponse(
    {
      isSuccess: false,
      data: error
    },
    request,
    port
  );
}

function sendRequestsToUI(port: chrome.runtime.Port) {
  for (const [key, value] of sessions.entries()) {
    if (isEmpty(value.requestQueue)) {
      continue;
    }

    for (const request of value.requestQueue.filter((r) => !r.isWindowOpened)) {
      if (request.message.function === "connect") {
        request.isWindowOpened = true;
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

function postResponse(response: RpcReturn, message: RpcMessage, port: chrome.runtime.Port) {
  port.postMessage({
    type: "rpc/connector-response",
    sessionId: message.sessionId,
    requestId: message.requestId,
    function: message.function,
    return: response
  });
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
      requestQueue: [{ isWindowOpened: false, message: message, resolve }]
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
