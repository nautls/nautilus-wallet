import { Port } from "../utils/browserApi";
// @ts-ignore
import injected from "./injected.ts?script";

function shouldInject() {
  // not needed but will keep this to have some "usage" and to make sure vite will bundle injected.ts file
  if (!injected) return false;

  const documentElement = document.documentElement.nodeName;
  const docElemCheck = documentElement ? documentElement.toLowerCase() === "html" : true;
  const { doctype } = window.document;
  const docTypeCheck = doctype ? doctype.name === "html" : true;
  return docElemCheck && docTypeCheck;
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
  try {
    const path = getRightScriptPath();
    debug("Injecting script", path);

    var script = document.createElement("script");
    script.async = false;
    script.type = "module";
    script.src = chrome.runtime.getURL(path);
    script.onload = () => (document.head || document.documentElement).removeChild(script);

    (document.head || document.documentElement).appendChild(script);
    return true;
  } catch (e) {
    error(e);
    return false;
  }
}

function log(...content: unknown[]) {
  // eslint-disable-next-line no-console
  console.log("[Nautilus]", ...content);
}

function error(...content: unknown[]) {
  // eslint-disable-next-line no-console
  console.error("[Nautilus]", ...content);
}

function debug(...content: unknown[]) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[Nautilus 🐞]", ...content);
  }
}

let ergoApiInjected = false;
let nautilusPort: Port;

// eslint-disable-next-line no-undef
const browser = chrome;

if (shouldInject()) {
  if (injectScript()) {
    log("Access methods injected.");
  }

  nautilusPort = browser.runtime.connect();
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
        log("Wallet access granted.");
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
}
