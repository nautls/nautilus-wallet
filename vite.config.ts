import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import wasmLoader from "vite-plugin-wasm";
import windiCSS from "vite-plugin-windicss";
import topLevelAwait from "vite-plugin-top-level-await";
import manifest from "./src/manifest";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { crx } from "@crxjs/vite-plugin";
import { execSync } from "child_process";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: "/src" }],
    extensions: [".mjs", ".js", ".ts", ".json", ".vue"]
  },
  define: {
    "import.meta.env.GIT_COMMIT_HASH": JSON.stringify(execSync("git rev-parse HEAD").toString())
  },
  plugins: [
    vue(),
    crx({ manifest }),
    nodePolyfills(),
    svgLoader(),
    wasmLoader(),
    windiCSS(),
    topLevelAwait()
  ],
  build: {
    emptyOutDir: true,
    outDir: "dist",
    assetsInlineLimit(filePath) {
      if (filePath.includes("content-script")) return false;
    },
    rollupOptions: {
      // remove non-english wordlists from the final bundle
      external: /^\.\/wordlists\/(?!english)/
    }
  },
  optimizeDeps: {
    include: ["vue", "vue-router", "vuex"]
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 }
  }
});
