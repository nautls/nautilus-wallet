/**
 * Captures raw popup/connector screens used to compose the Chrome Web Store listing images.
 * Not part of the e2e suite. Run with:
 *
 *   pnpm build:mainnet:chrome && pnpm exec playwright test -c tests/store
 *
 * Raw captures land in `tests/store/out/raw`, then `compose.spec.ts` builds the final frames.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { buildTransaction } from "../e2e/fixtures/transactions";
import { addressOf, WALLET_A, WALLET_B, xpubOf } from "../e2e/fixtures/wallets";
import { MockChain } from "../e2e/mocks/chain";
import { installServiceMocks } from "../e2e/mocks/services";
import { clickToClose, invoke, withConnectorWindow } from "../e2e/pages/connector";
import { Popup } from "../e2e/pages/popup";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../../dist");
const RAW_DIR = path.resolve(import.meta.dirname, "out/raw");
const ERG_ID = "0".repeat(64);

export const DAPP_ORIGIN = "https://tidepool.example";
export const DAPP_HOST = new URL(DAPP_ORIGIN).host;
const ERG_USD = 1.42;

/** Only used as a read-only (xpub) wallet in the switcher. */
const COLD_WALLET = {
  name: "Cold storage",
  mnemonic:
    "verb bundle leg fine flush kid slight fancy minor isolate cost cave random author elbow",
  password: ""
};

/** Real mainnet tokens with bundled icons, with a price in ERG per whole token. */
const TOKENS = [
  {
    tokenId: "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04",
    name: "SigUSD",
    decimals: 2,
    amount: "125000", // 1,250.00
    ergPrice: 1 / ERG_USD
  },
  {
    tokenId: "8b08cdd5449a9592a9e79711d7d79249d7a03c535d17efaee83e216e80a44c4b",
    name: "RSN",
    decimals: 3,
    amount: "8420500", // 8,420.5
    ergPrice: 0.0042 / ERG_USD
  },
  {
    tokenId: "e023c5f382b6e96fbd878f6811aac73345489032157ad5affb84aefd4956c297",
    name: "rsADA",
    decimals: 6,
    amount: "640000000", // 640
    ergPrice: 0.61 / ERG_USD
  },
  {
    tokenId: "7a51950e5f548549ec1aa63ffdc38279505b11e7e803d01bcf8347e0123c88b0",
    name: "rsBTC",
    decimals: 8,
    amount: "1250000", // 0.0125
    ergPrice: 95_000 / ERG_USD
  },
  {
    tokenId: "c1980d829988229516430a47a5eca376060b6ce859616db0936e78ab25cb6de7",
    name: "LIT",
    decimals: 6,
    amount: "4200000000", // 4,200
    ergPrice: 0.12 / ERG_USD
  }
];

const DAPP_HTML = `<!doctype html><html><head><title>Tidepool</title>
<link rel="icon" href="/favicon.svg"></head><body><h1>Tidepool</h1></body></html>`;
const DAPP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="16" fill="#0ea5e9"/>
<path d="M10 38c6-6 12-6 18 0s12 6 18 0 8-5 8-5v15H10z" fill="#fff" opacity=".9"/>
<path d="M10 28c6-6 12-6 18 0s12 6 18 0 8-5 8-5" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

async function launch(chain: MockChain, colorScheme: "dark" | "light") {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    locale: "en-US",
    colorScheme,
    deviceScaleFactor: 2,
    viewport: { width: 380, height: 680 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
  });

  await installServiceMocks(context);
  await chain.install(context);

  // later routes take precedence over the generic service mocks
  await context.route("https://api.coingecko.com/api/v3/simple/price**", (route) =>
    route.fulfill({ json: { ergo: { usd: ERG_USD } } })
  );
  await context.route("https://dex-api.sigmaspace.io/v1/amm/pools/stats", (route) =>
    route.fulfill({
      json: TOKENS.map((t) => ({
        id: t.tokenId,
        lockedX: { id: ERG_ID, amount: 1, ticker: "ERG", decimals: 9 },
        lockedY: { id: t.tokenId, amount: 1, ticker: t.name, decimals: t.decimals },
        tvl: { value: 1_000_000 }
      }))
    })
  );
  await context.route("https://dex-api.sigmaspace.io/v1/price-tracking/markets**", (route) =>
    route.fulfill({
      json: TOKENS.map((t) => ({
        id: t.tokenId,
        baseId: ERG_ID,
        baseSymbol: "ERG",
        quoteId: t.tokenId,
        quoteSymbol: t.name,
        lastPrice: 1 / t.ergPrice,
        baseVolume: { value: 1000 },
        quoteVolume: { value: 1000 }
      }))
    })
  );
  await context.route(`${DAPP_ORIGIN}/**`, (route) => {
    const isIcon = new URL(route.request().url()).pathname === "/favicon.svg";
    return route.fulfill(
      isIcon
        ? { contentType: "image/svg+xml", body: DAPP_ICON }
        : { contentType: "text/html", body: DAPP_HTML }
    );
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const popup = new Popup(await context.newPage(), new URL(worker.url()).host);

  return { context, popup };
}

async function fund(chain: MockChain) {
  for (const t of TOKENS)
    chain.addToken({ tokenId: t.tokenId, name: t.name, decimals: t.decimals });

  const a0 = await addressOf(WALLET_A, 0);
  const a1 = await addressOf(WALLET_A, 1);

  // a few separate deposits so the history looks lived-in
  chain.fund(a0, { nanoErgs: 119_999_000_000n, creationHeight: chain.height - 700 });
  chain.fund(a0, {
    nanoErgs: 1_000_000n,
    tokens: TOKENS.slice(0, 3).map((t) => ({ tokenId: t.tokenId, amount: t.amount })),
    creationHeight: chain.height - 300
  });
  chain.fund(a1, {
    nanoErgs: 35_830_000_000n,
    tokens: TOKENS.slice(3).map((t) => ({ tokenId: t.tokenId, amount: t.amount })),
    creationHeight: chain.height - 40
  });
  chain.fund(await addressOf(WALLET_B, 0), { nanoErgs: 48_200_000_000n });
  chain.fund(await addressOf(COLD_WALLET, 0), { nanoErgs: 5_000_000_000_000n });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(RAW_DIR, `${name}.png`), animations: "disabled" });
}

let ctx: BrowserContext | undefined;
test.afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

test.beforeAll(() => mkdirSync(RAW_DIR, { recursive: true }));

for (const scheme of ["dark", "light"] as const) {
  test.describe(scheme, () => {
    test("popup screens", async () => {
      const chain = new MockChain();
      await fund(chain);
      const { context, popup } = await launch(chain, scheme);
      ctx = context;
      const page = popup.page;

      await popup.importWallet(WALLET_B);
      await popup.importReadOnlyWallet(COLD_WALLET.name, await xpubOf(COLD_WALLET));
      await popup.importWallet(WALLET_A);
      await page.waitForTimeout(1500);
      await expect(page.getByRole("tabpanel")).toContainText("SigUSD");
      await shot(page, `${scheme}-assets`);

      await popup.walletSwitcher.click();
      await expect(page.getByRole("option", { name: /^Cold storage/ })).toBeVisible();
      await shot(page, `${scheme}-wallets`);
      await popup.walletSwitcher.click({ force: true });
      await expect(page.getByRole("option")).toHaveCount(0);

      await popup.navigate("history");
      await shot(page, `${scheme}-history`);

      await popup.navigate("receive");
      await shot(page, `${scheme}-receive`);

      await popup.navigate("send");
      await page.locator("#recipient").fill("9hoMQn9KqARhFHkgn3ua1rzDfrXDFife5iBFFa3pzYwgKVhvXBT");
      await page.getByRole("combobox").filter({ hasText: "Add asset" }).click();
      await page.getByRole("option", { name: /SigUSD/ }).click();
      await expect(page.getByRole("option")).toHaveCount(0);
      const amounts = page.getByPlaceholder("0");
      await expect(amounts).toHaveCount(2);
      await amounts.first().fill("25");
      await amounts.last().fill("150");
      await page.locator("#recipient").blur();
      await shot(page, `${scheme}-send`);

      await popup.navigate("dapps");
      await shot(page, `${scheme}-dapps`);
    });

    test("connector screens", async () => {
      const chain = new MockChain();
      await fund(chain);
      const { context, popup } = await launch(chain, scheme);
      ctx = context;

      await popup.importWallet(WALLET_B);
      await popup.importWallet(WALLET_A);

      const dapp = await context.newPage();
      await dapp.goto(DAPP_ORIGIN);
      await dapp.waitForFunction(() => window.ergoConnector?.nautilus !== undefined);

      const connect = await withConnectorWindow(context, "connect", () =>
        invoke(dapp, () => window.ergoConnector.nautilus.connect())
      );
      await connect.win.setViewportSize({ width: 380, height: 680 });
      await connect.win.getByRole("button", { name: /Alice/ }).click();
      await shot(connect.win, `${scheme}-connect`);
      await clickToClose(connect.win.getByRole("button", { name: "Connect", exact: true }));
      await connect.result;

      const tx = await buildTransaction(chain, WALLET_A, {
        nanoErgs: 2_500_000_000n,
        tokens: [{ tokenId: TOKENS[0].tokenId, amount: "15000" }]
      });
      const sign = await withConnectorWindow(context, "sign/tx", () =>
        invoke(dapp, ({ tx }) => window.ergo.sign_tx(tx), { tx })
      );
      await sign.win.setViewportSize({ width: 380, height: 680 });
      await expect(sign.win.getByText("Network fee")).toBeVisible();
      await shot(sign.win, `${scheme}-sign`);
      sign.result.catch(() => undefined);
    });
  });
}
