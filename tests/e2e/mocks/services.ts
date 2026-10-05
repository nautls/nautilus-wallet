import type { BrowserContext } from "@playwright/test";
import { GRAPHQL_URLS } from "./chain";

export const DAPP_ORIGIN = "https://dapp.test";
export const DAPP_HOST = "dapp.test";

export const ERG_FIAT_RATES: Record<string, number> = { usd: 2, eur: 1.5, btc: 0.00002 };

export type ServiceOptions = {
  /** Token blacklist served by the sigmanauts blacklist endpoint. */
  blacklist?: { nsfw: string[]; scam: string[] };
};

const DAPP_HTML = `<!doctype html>
<html>
  <head><title>Test dApp</title><link rel="icon" href="data:,"></head>
  <body><h1>Test dApp</h1><iframe id="frame" src="/frame"></iframe></body>
</html>`;

const FRAME_HTML = `<!doctype html><html><head></head><body>frame</body></html>`;

/**
 * Stubs every third-party HTTP service used by the wallet and serves a fake dApp
 * at {@link DAPP_ORIGIN}. Any other outgoing http(s) request is aborted so tests
 * never touch the real network.
 */
export async function installServiceMocks(context: BrowserContext, opt: ServiceOptions = {}) {
  // lowest priority: block everything that isn't explicitly mocked
  const mocked = new Set(GRAPHQL_URLS.map((u) => new URL(u).host));
  await context.route(
    (url) => url.protocol.startsWith("http") && !mocked.has(url.host),
    (route) => route.abort("blockedbyclient")
  );

  await context.route("https://api.coingecko.com/api/v3/simple/price**", (route) => {
    const currency = new URL(route.request().url()).searchParams.get("vs_currencies") ?? "usd";
    return route.fulfill({ json: { ergo: { [currency]: ERG_FIAT_RATES[currency] ?? 1 } } });
  });

  await context.route("https://api.coingecko.com/api/v3/simple/supported_vs_currencies", (route) =>
    route.fulfill({ json: Object.keys(ERG_FIAT_RATES) })
  );

  await context.route("https://api.spectrum.fi/**", (route) => route.fulfill({ json: [] }));

  await context.route("https://raw.githubusercontent.com/sigmanauts/**", (route) =>
    route.fulfill({ json: opt.blacklist ?? { nsfw: [], scam: [] } })
  );

  await context.route("https://nautilus-nft-sandbox.azurewebsites.net/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html><body>sandbox</body></html>" })
  );

  await context.route(`${DAPP_ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: "text/html",
      body: path === "/frame" ? FRAME_HTML : DAPP_HTML
    });
  });
}
