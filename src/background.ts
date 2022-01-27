import { RpcMessage } from "./types/connector";
import { getBoundsForTabWindow } from "@/utils/uiHelpers";

const POPUP_SIZE = { width: 365, height: 630 };

type SignQueueItem = {
  request: RpcMessage;
  isWindowOpened: boolean;
  resolve: (data: any) => {};
  reject: (data: any) => {};
};

type Session = {
  url: string;
  favicon?: string;
  port: chrome.runtime.Port;
  walletId?: number;
  signQueue: SignQueueItem[];
};

const currentSessions = new Map<number, Session>();

chrome.runtime.onConnect.addListener(port => {
  console.log(`connected with ${port.sender?.origin}`);

  if (port.name === "nautilus-ui") {
    port.onDisconnect.addListener(port => {
      console.log("closed");
    });

    port.onMessage.addListener(async (message: RpcMessage, port) => {
      if (message.type !== "rpc/nautilus-request") {
        return;
      }

      if (message.function === "loaded") {
        console.log("loaded");

        for (const [key, value] of currentSessions.entries()) {
          if (!value.walletId) {
            port.postMessage({
              type: "rpc/nautilus-request",
              id: key,
              function: "requestAccess",
              params: [key, value.url, value.favicon]
            } as RpcMessage);
          }
        }
      }
    });
  } else {
    port.onMessage.addListener(async (message: RpcMessage, port) => {
      if (message.type !== "rpc/connector-request") {
        return;
      }

      if (message.function === "requestAccess") {
        const response = await requestAccess(message, port);
        // sender.postMessage({
        //   type: "rpc/connector-response",
        //   id: message.id,
        //   function: message.function,
        //   return: { isSuccess: true, data: "hello from background" }
        // } as RpcMessage);
      }
    });
  }
});

async function requestAccess(message: RpcMessage, port: chrome.runtime.Port) {
  const tabId = port.sender?.tab?.id;
  if (!tabId || !port.sender?.origin) {
    return;
  }

  currentSessions.set(tabId, {
    port,
    url: port.sender.origin,
    favicon: port.sender.tab?.favIconUrl,
    signQueue: []
  });
  openWindow(port.sender?.tab?.id);
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
