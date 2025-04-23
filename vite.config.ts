/* eslint-disable no-console */
import { execSync } from "child_process";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import vueI18n from "@intlify/unplugin-vue-i18n/vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, PluginOption } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import topLevelAwait from "vite-plugin-top-level-await";
import wasmLoader from "vite-plugin-wasm";
import webExtension from "vite-plugin-web-extension";
import svgLoader from "vite-svg-loader";
import { EXT_ENTRY_ROOT } from "./src/constants/extension.ts";
import { buildManifest } from "./src/extension/manifest.ts";

const port = 5173;
const env = {
  NETWORK: (process.env.NETWORK as "mainnet" | "testnet") ?? "mainnet",
  TARGET: (process.env.TARGET as "firefox" | "chrome") ?? "chrome",
  GIT_COMMIT_HASH: execSync("git rev-parse HEAD").toString().trim()
};

const INSPECT_BUNDLE = process.env.INSPECT === "true";

function r(...paths: string[]): string {
  return path.resolve(import.meta.dirname, ...paths);
}

function defEnv(obj: Record<string, unknown>): Record<string, string> {
  const entries = Object.entries(obj).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]);
  return Object.fromEntries(entries);
}

const plugins = [
  vue(),
  vueI18n({ include: r("src/i18n/locales/*.json") }),
  tailwindcss(),
  svgLoader(),
  topLevelAwait(),
  wasmLoader(),
  objectLogger(env),
  nodePolyfills({ include: ["buffer"] }), // required by @ledgerhq/* packages
  INSPECT_BUNDLE ? visualizer({ open: true, filename: "dist/bundle-stats.html" }) : undefined
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  define: defEnv(env),
  plugins: [
    ...(mode === "development" ? plugins : []),
    webExtension({
      manifest: () => buildManifest(env.NETWORK, env.TARGET, mode),
      watchFilePaths: [r("src/manifest.ts")],
      additionalInputs: [
        `${EXT_ENTRY_ROOT}/content-scripts/injected.ts`,
        `${EXT_ENTRY_ROOT}/connector/index.html`
      ],
      disableAutoLaunch: true,
      browser: env.TARGET,
      htmlViteConfig: { plugins }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        sanitizeFileName(name) {
          // avoid "The argument 'path' must be a string, Uint8Array, or URL without null bytes. Received [...]\x00[...]" error
          if (name.includes("\x00")) name = name.replace("\x00", "");
          // chromium: filenames starting with "_" are reserved for use by the system.
          if (name.startsWith("_")) name = name.replace("_", "");
          // avoid invalid filenames such as FeeSelector.vue?vue&type=script&setup=true&lang.js
          if (name.includes(".vue?")) name = name.slice(0, name.indexOf(".vue?"));
          return name;
        }
      }
    },
    chunkSizeWarningLimit: 1024,
    emptyOutDir: true,
    outDir: r("dist")
  },
  optimizeDeps: {
    include: [
      "vue",
      "vue-router",
      "pinia",
      "@fleet-sdk/babel-fees-plugin",
      "ledger-ergo-js",
      "@ledgerhq/hw-transport-webusb",
      "ergo-lib-wasm-browser",
      "vue-json-pretty",
      "uqr"
    ]
  },
  server: {
    port,
    strictPort: true,
    hmr: { port }
  }
}));

function objectLogger(obj: Record<string, string>): PluginOption {
  const li = (k: string, v: string) => `\x1b[32m➜\x1b[0m ${k} \x1b[36m${v}\x1b[0m`;

  return {
    name: "object-logger",
    buildStart() {
      console.log();
      for (const key in obj) console.log(li(key, obj[key]));
      console.log();
    }
  };
}
