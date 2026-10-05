import { defineConfig } from "@playwright/test";

// Lets Playwright intercept requests made by the extension's background service worker,
// which is required to serve the mocked blockchain to it.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

/**
 * End-to-end tests run against the built Chrome extension in `dist/`.
 * Build it first with `pnpm build:mainnet:chrome`, or use `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium" }]
});
