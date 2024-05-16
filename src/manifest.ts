import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json" assert { typ: "json" };

export default defineManifest(async (env) => ({
  name: "Nautilus Wallet",
  short_name: "Nautilus",
  description: "Privacy Wallet Designed for Ergo Network",
  version: pkg.version,
  icons: { 48: "icons/app/m-48.png", 128: "icons/app/m-128.png", 512: "icons/app/m-512.png" },
  manifest_version: 3,
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  permissions: ["storage", "activeTab", "scripting", "tabs"],
  host_permissions: ["<all_urls>"],
  action: {
    default_popup: "index.html",
    default_title: "Nautilus Wallet"
  },
  web_accessible_resources:
    env.mode === "development"
      ? [
          {
            resources: ["src/content-scripts/injector.js", "src/content-scripts/authApi.js"],
            matches: ["*://*/*"],
            extension_ids: []
          }
        ]
      : undefined,
  // background: {
  //   service_worker: "src/background/background.ts",
  //   type: "module"
  // },
  content_scripts: [
    {
      matches: ["file://*/*", "http://*/*", "https://*/*"],
      js: ["src/content-scripts/injector.js"],
      run_at: "document_start",
      all_frames: true
    }
  ]
}));
