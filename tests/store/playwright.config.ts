import { defineConfig } from "@playwright/test";

// Lets Playwright intercept requests made by the extension's background service worker.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

/** Chrome Web Store listing images. See `capture.spec.ts`. */
export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: "list",
  projects: [
    { name: "capture", testMatch: "capture.spec.ts" },
    { name: "compose", testMatch: "compose.spec.ts", dependencies: ["capture"] }
  ]
});
