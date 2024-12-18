/* eslint-disable no-console */
import { execSync } from "child_process";
import path from "node:path";
import { defineConfig, PluginOption } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import wasmLoader from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import webExtension from "vite-plugin-web-extension";
import { buildManifest } from "./src/extension/manifest.ts";
import { EXT_ENTRY_ROOT } from "./src/constants/extension.ts";

const port = 5173;
const env = {
  NETWORK: (process.env.NETWORK as "mainnet" | "testnet") ?? "mainnet",
  TARGET: (process.env.TARGET as "firefox" | "chrome") ?? "chrome",
  GIT_COMMIT_HASH: execSync("git rev-parse HEAD").toString().trim()
};

function r(...paths: string[]): string {
  return path.resolve(import.meta.dirname, ...paths);
}

function defEnv(obj: Record<string, unknown>): Record<string, string> {
  const entries = Object.entries(obj).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]);
  return Object.fromEntries(entries);
}

const plugins = [
  vue(),
  svgLoader(),
  topLevelAwait(),
  wasmLoader(),
  objectLogger(env),
  nodePolyfills({ include: ["buffer"] }) // required by @ledgerhq/* packages
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": "/src" }
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
          // chromium: filenames starting with "_" are reserved for use by the system.
          if (name.startsWith("_")) return name.replace("_", "");
          // avoid invalid filenames such as FeeSelector.vue?vue&type=script&setup=true&lang.js
          if (name.includes(".vue?")) return name.slice(0, name.indexOf(".vue?"));
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
      "@ledgerhq/hw-transport-webusb",
      "ledger-ergo-js",
      "@vuelidate/core",
      "@vuelidate/validators",
      "vue-json-pretty",
      "@fleet-sdk/babel-fees-plugin",
      "ergo-lib-wasm-browser"
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
