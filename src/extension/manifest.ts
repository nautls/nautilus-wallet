import type { Manifest } from "webextension-polyfill";
import pkg from "../../package.json";
import { EXT_ENTRY_ROOT } from "../constants/extension";

type Network = "mainnet" | "testnet";
type Browser = "chrome" | "firefox";

const r = (path: string) => `${EXT_ENTRY_ROOT}/${path}`;

function buildIcons(mode: string, network: Network) {
  const prefix = mode === "staging" || network === "testnet" ? "t" : "m";

  return {
    48: `icons/app/${prefix}-48.png`,
    128: `icons/app/${prefix}-128.png`,
    512: `icons/app/${prefix}-512.png`
  };
}

function buildTitle(mode: string, network: Network) {
  if (mode === "staging") return "Nautilus Abyss";
  return network === "mainnet" ? "Nautilus Wallet" : "Nautilus Wallet (Testnet)";
}

function buildDescription(mode: string, network: Network) {
  if (mode === "staging")
    return "Canary distribution of Nautilus Wallet, for testing and development purposes.";
  return network === "mainnet"
    ? "Privacy Wallet Designed for Ergo Network"
    : "Testnet distribution of Nautilus Wallet";
}

function buildVersion() {
  const [major, minor, patch, label] = pkg.version
    // can only contain digits or dots
    .replace(/[^\d.]+/g, "")
    .split(".");

  return label ? `${major}.${minor}.${patch}.${label}` : `${major}.${minor}.${patch}`;
}

export function buildManifest(
  network: Network,
  browser: Browser,
  mode: string
): Manifest.WebExtensionManifest {
  return {
    manifest_version: 3,
    name: buildTitle(mode, network),
    short_name: "Nautilus",
    description: buildDescription(mode, network),
    version: buildVersion(),
    icons: buildIcons(mode, network),
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
    },
    permissions: ["storage", "tabs", ...(browser === "chrome" ? ["sidePanel"] : [])],
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
    content_scripts: [
      {
        js: [r("content-scripts/contentScript.ts")],
        matches: ["<all_urls>"],
        run_at: "document_start",
        all_frames: true
      }
    ],

    ...(browser === "chrome"
      ? // chrome specific manifest fields
        {
          version_name: pkg.version,
          background: { service_worker: r("background/background.ts") },
          side_panel: { default_path: r("popup/index.html") }
        }
      : // firefox specific manifest fields
        {
          background: { scripts: [r("background/background.ts")] },
          browser_specific_settings: {
            gecko: { id: "{35bc2a66-11b8-410d-8c0e-463db6744795}" }
          },
          sidebar_action: {
            default_panel: r("popup/index.html"),
            default_icon: buildIcons(mode, network),
            default_title: "Nautilus Wallet",
            open_at_install: false
          }
        })
  };
}
