import { execSync } from "child_process";
import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import wasmLoader from "vite-plugin-wasm";
import windiCSS from "vite-plugin-windicss";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import webExtension from "vite-plugin-web-extension";
import { buildManifest } from "./src/extension/manifest.ts";
import { EXT_ENTRY_ROOT } from "./src/constants/extension.ts";

const gitHash = execSync("git rev-parse HEAD").toString().trim();
const network = (process.env.VITE_NETWORK as "mainnet" | "testnet") ?? "mainnet";
const port = 5173;

function r(...paths: string[]): string {
  return path.resolve(import.meta.dirname, ...paths);
}

const plugins = [
  vue(),
  windiCSS(),
  svgLoader(),
  topLevelAwait(),
  wasmLoader(),
  nodePolyfills({ include: ["buffer"] }) // required by @ledgerhq/* packages
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": "/src" }
  },
  define: {
    "import.meta.env.GIT_COMMIT_HASH": JSON.stringify(gitHash)
  },
  plugins: [
    ...(mode === "development" ? plugins : []),
    webExtension({
      manifest: () => buildManifest(network, mode),
      watchFilePaths: [r("src/manifest.ts")],
      additionalInputs: [
        `${EXT_ENTRY_ROOT}/content-scripts/injected.ts`,
        `${EXT_ENTRY_ROOT}/connector/index.html`
      ],
      disableAutoLaunch: true,
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
