import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";
import { buildNamespaceFor } from "../background/messagingUtils";
// @ts-expect-error ?script is needed to force vite to bundle the script
import injected from "./injected.ts?script";
import { ExternalRequest, InternalRequest } from "../background/messaging";

allowWindowMessaging(buildNamespaceFor(location.origin));

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

function error(...content: unknown[]) {
  // eslint-disable-next-line no-console
  console.error(CONSOLE_PREFIX, ...content);
}

function debug(...content: unknown[]) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(CONSOLE_PREFIX, ...content);
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
  else debug("Access methods injected.");

  const payload = { origin: getHost(location.origin) };

  // auth requests
  onMessage(ExternalRequest.Connect, async () => {
    return await sendMessage(InternalRequest.Connect, { payload }, BACKGROUND);
  });

  onMessage(ExternalRequest.CheckConnection, async () => {
    return await sendMessage(InternalRequest.CheckConnection, { payload }, BACKGROUND);
  });

  onMessage(ExternalRequest.Disconnect, async () => {
    return await sendMessage(InternalRequest.Disconnect, { payload }, BACKGROUND);
  });

  // context requests
  onMessage(ExternalRequest.GetUTxOs, async ({ data }) => {
    return await sendMessage(InternalRequest.GetUTxOs, { payload, ...data }, BACKGROUND);
  });

  onMessage(ExternalRequest.GetBalance, async ({ data }) => {
    return await sendMessage(InternalRequest.GetBalance, { payload, ...data }, BACKGROUND);
  });

  onMessage(ExternalRequest.GetAddresses, async ({ data }) => {
    return await sendMessage(InternalRequest.GetAddresses, { payload, filter: data }, BACKGROUND);
  });

  onMessage(ExternalRequest.GetCurrentHeight, async () => {
    return await sendMessage(InternalRequest.GetCurrentHeight, { payload }, BACKGROUND);
  });

  onMessage(ExternalRequest.SignData, async () => {
    return await sendMessage(InternalRequest.SignData, { payload }, BACKGROUND);
  });

  onMessage(ExternalRequest.Auth, async ({ data }) => {
    return await sendMessage(InternalRequest.Auth, { payload, ...data }, BACKGROUND);
  });

  onMessage(ExternalRequest.SignTx, async ({ data }) => {
    return await sendMessage(InternalRequest.SignTx, { payload, ...data }, BACKGROUND);
  });

  onMessage(ExternalRequest.SignTxInputs, async ({ data }) => {
    return await sendMessage(InternalRequest.SignTxInputs, { payload, ...data }, BACKGROUND);
  });
})();
