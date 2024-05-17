import authApi from "./injected.js?url";

function shouldInject() {
  const documentElement = document.documentElement.nodeName;
  const docElemCheck = documentElement ? documentElement.toLowerCase() === "html" : true;
  const { docType } = window.document;
  const docTypeCheck = docType ? docType.name === "html" : true;
  return docElemCheck && docTypeCheck;
}

function injectScript(file) {
  try {
    var script = document.createElement("script");
    script.async = false;
    script.src = chrome.runtime.getURL(file);
    script.onload = function () {
      this.remove();
    };

    (document.head || document.documentElement).appendChild(script);
    return true;
  } catch (error) {
    error("Failed to inject " + file, error);
    return false;
  }
}

function log(content) {
  // eslint-disable-next-line no-console
  console.log(`[Nautilus] ${content}`);
}

function error(content) {
  // eslint-disable-next-line no-console
  console.error(`[Nautilus] ${content}`);
}

let ergoApiInjected = false;
let nautilusPort;

// eslint-disable-next-line no-undef
const browser = chrome;

if (shouldInject()) {
  if (injectScript(authApi)) {
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
