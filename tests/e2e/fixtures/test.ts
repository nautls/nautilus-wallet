import { readFileSync } from "node:fs";
import path from "node:path";
import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";
import { MockChain, type GqlBox } from "../mocks/chain";
import { DAPP_ORIGIN, installServiceMocks, type ServiceOptions } from "../mocks/services";
import { Popup } from "../pages/popup";
import { addressOf, TEST_NFT, TEST_TOKEN, type TestWallet } from "./wallets";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../../../dist");

type Fixtures = {
  serviceOptions: ServiceOptions;
  chain: MockChain;
  context: BrowserContext;
  extensionId: string;
  popup: Popup;
  dapp: Page;
};

export const test = base.extend<Fixtures>({
  serviceOptions: [{}, { option: true }],

  chain: async ({}, use) => {
    await use(new MockChain());
  },

  context: async ({ chain, serviceOptions }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      locale: "en-US",
      colorScheme: "light",
      viewport: { width: 380, height: 680 },
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
    });

    await installServiceMocks(context, serviceOptions);
    await chain.install(context);

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");

    await use(new URL(worker.url()).host);
  },

  popup: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await use(new Popup(page, extensionId));
  },

  dapp: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto(DAPP_ORIGIN);
    await page.waitForFunction(() => window.ergoConnector?.nautilus !== undefined);
    await use(page);
  }
});

export { expect } from "@playwright/test";

/**
 * Funds a wallet on the mock chain with:
 *  - address #0: 10 ERG + 1000.00 TestToken + 1 NFT
 *  - address #1: 2.5 ERG
 */
export async function fundWallet(chain: MockChain, wallet: TestWallet) {
  chain.addToken(TEST_TOKEN);
  chain.addToken(TEST_NFT);

  chain.fund(await addressOf(wallet, 0), {
    nanoErgs: 10_000_000_000n,
    tokens: [
      { tokenId: TEST_TOKEN.tokenId, amount: "100000" },
      { tokenId: TEST_NFT.tokenId, amount: "1" }
    ]
  });

  chain.fund(await addressOf(wallet, 1), { nanoErgs: 2_500_000_000n });
}

/** Adds mainnet snapshots of the SigmaUSD bank and oracle boxes to the chain. */
export function addSigmaUsdBoxes(chain: MockChain) {
  const { bank, oracle } = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, "data/sigmausd.json"), "utf8")
  ) as { bank: GqlBox; oracle: GqlBox };

  chain.addBox(bank);
  chain.addBox(oracle);
  return { bank, oracle };
}
