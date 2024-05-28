import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";
import { buildNamespaceFor } from "../background/messagingUtils";
// @ts-expect-error ?script is needed to force vite to bundle the script
import injected from "./injected.ts?script";
import { ExternalRequest, InternalRequest } from "../background/messaging";

allowWindowMessaging(buildNamespaceFor(location.origin));

// eslint-disable-next-line no-undef
const browser = chrome;
const CONSOLE_PREFIX = "[Nautilus]";
const BACKGROUND = "background";

/**
 * Checks if the current document supports script injection.
 */
function canInject() {
  const docEl = document.documentElement.nodeName;
  const docElCheck = docEl ? docEl.toLowerCase() === "html" : true;
  const { doctype } = window.document;
  const docTypeCheck = doctype ? doctype.name === "html" : true;
  return docElCheck && docTypeCheck;
}

/**
 * Workaround for Vite's/CRXJS output file naming.
 */
function getRightScriptPath() {
  const index = injected.indexOf("injected");
  if (index === -1) return injected;

  const path = injected.slice(0, index);
  return path + (import.meta.env.PROD ? "injected.js" : "injected.ts.js");
}

function injectScript() {
  if (!canInject()) error("Cannot inject script.");

  const path = getRightScriptPath();
  debug("Injecting script", path);

  const parent = document.head || document.documentElement;
  const script = document.createElement("script");
  script.async = false;
  script.type = "module";
  script.src = chrome.runtime.getURL(path);
  script.onload = () => parent.removeChild(script);

  try {
    parent.appendChild(script);
    return true;
  } catch (e) {
    error(e);
    return false;
  }
}

function log(...content: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(CONSOLE_PREFIX, ...content);
}

function error(...content: unknown[]) {
  // eslint-disable-next-line no-console
  console.error(CONSOLE_PREFIX, ...content);
}

function debug(...content: unknown[]) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[Nautilus 🐞]", ...content);
  } else {
    // eslint-disable-next-line no-console
    console.debug(CONSOLE_PREFIX, ...content);
  }
}

function getHost(origin: string) {
  return new URL(origin).host;
}

(() => {
  if (!injectScript()) return;
  else log("Access methods injected.");

  let ergoApiInjected = false;
  const payload = { origin: getHost(location.origin) };

  onMessage(ExternalRequest.Connect, async () => {
    return await sendMessage(InternalRequest.Connect, { payload }, BACKGROUND);
  });

  onMessage(ExternalRequest.CheckConnection, async () => {
    return await sendMessage(InternalRequest.CheckConnection, { payload }, BACKGROUND);
  });

  onMessage(ExternalRequest.Disconnect, async () => {
    return await sendMessage(InternalRequest.Disconnect, { payload }, BACKGROUND);
  });

  const nautilusPort = browser.runtime.connect();
  nautilusPort.onMessage.addListener((msg) => {
    if (!msg.type.startsWith("rpc/connector-response") && msg.type !== "rpc/nautilus-event") {
      return;
    }

    if (msg.type === "rpc/connector-response") {
      // chrome.runtime.sendMessage(msg);
      window.postMessage(msg, location.origin);
    } else if (msg.type === "rpc/connector-response/auth") {
      if (
        !ergoApiInjected &&
        msg.function === "connect" &&
        msg.return.isSuccess &&
        msg.return.data === true
      ) {
        debug("Wallet access granted.");
        ergoApiInjected = true;
      }

      window.postMessage(msg, location.origin);
    } else if (msg.type === "rpc/nautilus-event") {
      if (msg.name === "disconnected") {
        window.dispatchEvent(new Event("ergo_wallet_disconnected"));
      }
    }
  });

  window.addEventListener("message", function (event) {
    if (event.data.type !== "rpc/connector-request") {
      return;
    }

    nautilusPort.postMessage(event.data);
  });
})();
