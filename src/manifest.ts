import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json" assert { type: "json" };

type Network = "mainnet" | "testnet";
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

export const buildManifest = (network: Network) =>
  defineManifest(async (env) => ({
    manifest_version: 3,
    name: getTitle(env.mode, network),
    short_name: "Nautilus",
    description: getDescription(env.mode, network),
    version: pkg.version,
    icons: getIcons(env.mode, network),
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
    },
    permissions: ["storage", "tabs"],
    action: {
      default_popup: "index.html",
      default_title: "Nautilus Wallet"
    },
    web_accessible_resources:
      env.mode === "development"
        ? [
            {
              resources: [
                "src/extension/content-scripts/contentScript.ts",
                "src/extension/content-scripts/injected.ts"
              ],
              matches: ["<all_urls>"],
              extension_ids: []
            }
          ]
        : undefined,
    background: {
      service_worker: "src/extension/background/background.ts",
      type: "module"
    },
    content_scripts: [
      {
        js: ["src/extension/content-scripts/contentScript.ts"],
        matches: ["<all_urls>"],
        run_at: "document_start",
        all_frames: true
      }
    ]
  }));
