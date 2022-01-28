import { RpcMessage, RpcReturn } from "./types/connector";
import { getBoundsForTabWindow } from "@/utils/uiHelpers";
import { find, isEmpty } from "lodash";

const POPUP_SIZE = { width: 365, height: 630 };

type RequestQueueItem = {
  message: RpcMessage;
  isWindowOpened: boolean;
  resolve: (value: RpcReturn) => void;
  // reject: (value: unknown) => void;
};

type Session = {
  origin: string;
  favicon?: string;
  port: chrome.runtime.Port;
  walletId?: number;
  requestQueue: RequestQueueItem[];
};

const currentSessions = new Map<number, Session>();

chrome.runtime.onConnect.addListener(port => {
  console.log(`connected with ${port.sender?.origin}`);

  if (port.name === "nautilus-ui") {
    port.onDisconnect.addListener(port => {
      console.log("closed");
    });

    port.onMessage.addListener(async (message: RpcMessage, port) => {
      if (message.type !== "rpc/nautilus-response") {
        return;
      }

      if (message.function === "loaded") {
        for (const [key, value] of currentSessions.entries()) {
          if (isEmpty(value.requestQueue)) {
            continue;
          }

          for (const request of value.requestQueue.filter(r => !r.isWindowOpened)) {
            if (request.message.function === "requestAccess") {
              request.isWindowOpened = true;
              port.postMessage({
                type: "rpc/nautilus-request",
                sessionId: key,
                requestId: request.message.requestId,
                function: "requestAccess",
                params: [value.origin, value.favicon]
              } as RpcMessage);
            }
          }
        }
      } else if (message.function === "requestAccess") {
        console.log(message);
        console.log(currentSessions);
        const session = currentSessions.get(message.sessionId);
        if (!session) {
          return;
        }

        const request = find(session.requestQueue, r => r.message.requestId === message.requestId);
        request?.resolve(message?.return || { isSuccess: false });
      }
    });
  } else {
    port.onMessage.addListener(async (message: RpcMessage, port) => {
      if (message.type !== "rpc/connector-request") {
        return;
      }

      if (message.function === "requestAccess") {
        const response = await requestAccess(message, port);
        if (response.isSuccess) {
          const session = currentSessions.get(message.sessionId);
          if (session) {
            session.walletId = response.data.walletId;
          }
        }

        port.postMessage({
          type: "rpc/connector-response",
          sessionId: message.sessionId,
          requestId: message.requestId,
          function: message.function,
          return: { isSuccess: response.isSuccess, data: response.data?.walletId !== undefined }
        } as RpcMessage);
      }
    });
  }
});

async function requestAccess(message: RpcMessage, port: chrome.runtime.Port): Promise<RpcReturn> {
  return new Promise((resolve, reject) => {
    const tabId = port.sender?.tab?.id;
    if (!tabId || !port.sender?.origin) {
      return;
    }

    currentSessions.set(tabId, {
      port,
      origin: port.sender.origin,
      favicon: port.sender.tab?.favIconUrl,
      requestQueue: [{ isWindowOpened: false, message: message, resolve }]
    });

    openWindow(port.sender?.tab?.id);
  });
}

async function openWindow(tabId?: number) {
  const bounds = await getBoundsForTabWindow(tabId);
  chrome.windows.create({
    ...POPUP_SIZE,
    focused: true,
    type: "popup",
    url: chrome.extension.getURL("index.html"),
    left: bounds.width + bounds.positionX - (POPUP_SIZE.width + 10),
    top: bounds.positionY + 50
  });
}
