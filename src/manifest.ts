import type { Manifest } from "webextension-polyfill";
import pkg from "../package.json" assert { type: "json" };
import { EXT_ENTRY_ROOT } from "./constants/extension";

type Network = "mainnet" | "testnet";

const r = (path: string) => `${EXT_ENTRY_ROOT}/${path}`;

function getIcons(mode: string, network: Network) {
  let prefix = "m";
  if (mode === "staging") prefix = "s";
  else if (network === "testnet") prefix = "t";

  return {
    48: `icons/app/${prefix}-48.png`,
    128: `icons/app/${prefix}-128.png`,
    512: `icons/app/${prefix}-512.png`
  };
}

function getTitle(mode: string, network: Network) {
  if (mode === "staging") return "Nautilus Abyss";
  return network === "mainnet" ? "Nautilus Wallet" : "Nautilus (Testnet)";
}

function getDescription(mode: string, network: Network) {
  if (mode === "staging")
    return "Canary distribution of Nautilus Wallet, for testing and development purposes.";
  return network === "mainnet"
    ? "Privacy Wallet Designed for Ergo Network"
    : "Testnet distribution of Nautilus Wallet";
}

export const buildManifest = (network: Network, mode: string): Manifest.WebExtensionManifest => ({
  manifest_version: 3,
  name: getTitle(mode, network),
  short_name: "Nautilus",
  description: getDescription(mode, network),
  version: pkg.version,
  icons: getIcons(mode, network),
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  permissions: ["storage", "tabs"],
  action: {
    default_popup: r("popup/index.html"),
    default_title: "Nautilus Wallet"
  },
  web_accessible_resources: [
    {
      resources: [r("content-scripts/contentScript.js"), r("content-scripts/injected.js")],
      matches: ["<all_urls>"],
      extension_ids: []
    }
  ],
  background: {
    service_worker: r("background/background.ts")
  },
  content_scripts: [
    {
      js: [r("content-scripts/contentScript.ts")],
      matches: ["<all_urls>"],
      run_at: "document_start",
      all_frames: true
    }
  ]
});
