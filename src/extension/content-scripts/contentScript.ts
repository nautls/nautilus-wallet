import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";
import { EXT_ENTRY_ROOT } from "@/constants/extension";
import {
  buildNamespaceFor,
  ExternalEvent,
  ExternalRequest,
  InternalRequest
} from "../connector/rpc/protocol";

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

function injectScript() {
  if (!canInject()) error("cannot inject scripts.");
  const path = `${EXT_ENTRY_ROOT}/content-scripts/injected.js`;
  debug("injecting", `'${path}'...`);

  const parent = document.head || document.body || document.documentElement;
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(path);

  window.addEventListener(ExternalEvent.Injected, () => {
    debug("ready 🚀");
    parent.removeChild(script);
  });

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

function pick<T, K extends keyof T>(data: T, keys: K[]): Pick<T, K> {
  const picked = {} as Pick<T, K>;
  if (!data || typeof data !== "object") return picked;

  for (const key of keys) {
    if (Object.hasOwn(data, key)) picked[key] = data[key];
  }

  return picked;
}

(() => {
  if (!injectScript()) return;

  allowWindowMessaging(buildNamespaceFor(location.origin));
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
    return await sendMessage(
      InternalRequest.GetUTxOs,
      { ...pick(data, ["target"]), payload },
      BACKGROUND
    );
  });

  onMessage(ExternalRequest.GetBalance, async ({ data }) => {
    return await sendMessage(
      InternalRequest.GetBalance,
      { ...pick(data, ["tokenId"]), payload },
      BACKGROUND
    );
  });

  onMessage(ExternalRequest.GetAddresses, async ({ data }) => {
    return await sendMessage(InternalRequest.GetAddresses, { payload, filter: data }, BACKGROUND);
  });

  onMessage(ExternalRequest.GetCurrentHeight, async () => {
    return await sendMessage(InternalRequest.GetCurrentHeight, { payload }, BACKGROUND);
  });

  onMessage(ExternalRequest.SubmitTransaction, async ({ data }) => {
    return await sendMessage(
      InternalRequest.SubmitTransaction,
      { ...pick(data, ["transaction"]), payload },
      BACKGROUND
    );
  });

  onMessage(ExternalRequest.SignData, async ({ data }) => {
    return await sendMessage(
      InternalRequest.SignData,
      { ...pick(data, ["address", "message"]), payload },
      BACKGROUND
    );
  });

  onMessage(ExternalRequest.Auth, async ({ data }) => {
    return await sendMessage(
      InternalRequest.Auth,
      { ...pick(data, ["address", "message"]), payload },
      BACKGROUND
    );
  });

  onMessage(ExternalRequest.SignTx, async ({ data }) => {
    return await sendMessage(
      InternalRequest.SignTx,
      { ...pick(data, ["transaction"]), payload },
      BACKGROUND
    );
  });

  onMessage(ExternalRequest.SignTxInputs, async ({ data }) => {
    return await sendMessage(
      InternalRequest.SignTxInputs,
      { ...pick(data, ["transaction", "indexes"]), payload },
      BACKGROUND
    );
  });
})();
