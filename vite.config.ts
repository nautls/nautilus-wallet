import { execSync } from "child_process";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import wasmLoader from "vite-plugin-wasm";
import windiCSS from "vite-plugin-windicss";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { crx } from "@crxjs/vite-plugin";
import { buildManifest } from "./src/manifest";

const gitHash = execSync("git rev-parse HEAD").toString().trim();
const network = (process.env.VITE_NETWORK as "mainnet" | "testnet") ?? "mainnet";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: { "@": "/src" }
  },
  define: {
    "import.meta.env.GIT_COMMIT_HASH": JSON.stringify(gitHash)
  },
  plugins: [
    vue(),
    crx({ manifest: buildManifest(network) }),
    nodePolyfills({ include: ["buffer"], globals: { Buffer: true } }),
    svgLoader(),
    wasmLoader(),
    windiCSS(),
    topLevelAwait()
  ],
  esbuild: { keepNames: true },
  build: {
    emptyOutDir: true,
    outDir: "dist",
    assetsInlineLimit(filePath) {
      // prevent content scripts from being inlined as base64
      if (filePath.includes("content-script")) return false;
    },
    rollupOptions: {
      output: {
        chunkFileNames(info) {
          if (info.name === "contentScript.ts") return "assets/contentScript.js";
          if (info.name === "injected.ts") return "assets/injected.js";
          return "assets/[name]-[hash].js";
        }
      }
    }
  },
  optimizeDeps: {
    include: ["vue", "vue-router", "vuex"]
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: { port: 5174 }
  }
});
