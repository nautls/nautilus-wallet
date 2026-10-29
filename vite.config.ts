/* eslint-disable no-console */
/// <reference types="vitest/config" />
import { execSync } from "child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { constants, deflateRawSync } from "node:zlib";
import vueI18n from "@intlify/unplugin-vue-i18n/vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, PluginOption } from "vite";
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
const REPORT_ZIP_SIZE = process.env.ZIP_SIZE === "true";

function r(...paths: string[]): string {
  return path.resolve(import.meta.dirname, ...paths);
}

function defEnv(obj: Record<string, unknown>): Record<string, string> {
  const entries = Object.entries(obj).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]);
  return Object.fromEntries(entries);
}

const plugins = [
  vue(),
  vueI18n({ include: r("src/i18n/locales/*.json"), dropMessageCompiler: true }),
  tailwindcss(),
  svgLoader(),
  wasmLoader(),
  objectLogger(env),
  INSPECT_BUNDLE ? visualizer({ open: true, filename: "dist/bundle-stats.html" }) : undefined
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      clsx: "cn" // dedupe class-variance-authority's clsx import
    }
  },
  define: defEnv(env),
  plugins: [
    ...(mode === "development" ? plugins : []),
    webExtension({
      manifest: () => buildManifest(env.NETWORK, env.TARGET, mode),
      skipManifestValidation: true, // skip for now
      watchFilePaths: [r("src/manifest.ts")],
      additionalInputs: [
        `${EXT_ENTRY_ROOT}/content-scripts/injected.ts`,
        `${EXT_ENTRY_ROOT}/connector/index.html`
      ],
      disableAutoLaunch: true,
      browser: env.TARGET,
      htmlViteConfig: { plugins }
    }),
    REPORT_ZIP_SIZE ? zipSizeReporter(r("dist")) : undefined
  ],
  build: {
    rollupOptions: {
      output: {
        sanitizeFileName(name) {
          // a custom sanitizer replaces the default one, so mirror its invalid char handling
          // eslint-disable-next-line no-control-regex
          name = name.replace(/[\x00-\x1F"#$%&*+,:;<=>?[\]^`{|}\x7F]/g, "_");
          // chromium: filenames starting with "_" are reserved for use by the system.
          return name.replace(/^_+/, "");
        }
      }
    },
    // chromium refuses to preload with "cross-world extension resource mismatch" warnings.
    // as extension pages load from disk, preloading gains nothing
    modulePreload: false,
    chunkSizeWarningLimit: 1024,
    emptyOutDir: true,
    outDir: r("dist")
  },
  server: {
    port,
    strictPort: true,
    hmr: { port }
  },
  test: {
    // end-to-end tests are run by Playwright
    exclude: ["**/node_modules/**", "tests/e2e/**"]
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

function zipSizeReporter(dir: string): PluginOption {
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  return {
    name: "zip-size-reporter",
    apply: "build",
    // runs after vite-plugin-web-extension, which performs all sub-builds during buildStart
    closeBundle() {
      const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter(
        (f) => f.isFile() && f.name !== "bundle-stats.html"
      );

      let raw = 0;
      let zip = 22; // end of central directory record
      for (const file of files) {
        const filePath = path.join(file.parentPath, file.name);
        const nameLength = Buffer.byteLength(path.relative(dir, filePath));
        const data = readFileSync(filePath);
        const deflated = deflateRawSync(data, { level: constants.Z_BEST_COMPRESSION }).length;

        raw += data.length;
        // local file header (30) + central directory header (46) + file name in both + data
        zip += 76 + nameLength * 2 + Math.min(deflated, data.length);
      }

      console.log(
        `\n\x1b[32m✓\x1b[0m ${files.length} files, ${mb(raw)} │ zip: \x1b[36m${mb(zip)}\x1b[0m`
      );
    }
  };
}
