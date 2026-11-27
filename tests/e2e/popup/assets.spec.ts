import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, TEST_NFT, TEST_TOKEN, WALLET_A, WALLET_B, xpubOf } from "../fixtures/wallets";

test.describe("assets", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
  });

  test("shows the wallet balance and tokens", async ({ popup }) => {
    const page = popup.page;

    // 12.5 ERG at 2 USD
    await expect(page.getByRole("heading", { name: /\$\s?25\.00/ })).toBeVisible();
    await expect(page.getByText("Wallet balance")).toBeVisible();

    const tokens = page.getByRole("tabpanel").locator("[data-token-list] > *");
    await expect(tokens).toHaveCount(2);

    // ERG always comes first
    await expect(tokens.nth(0)).toContainText("ERG");
    await expect(tokens.nth(0)).toContainText("12.5");
    await expect(tokens.nth(0)).toContainText(/\$\s?25\.00/);
    await tokens.nth(0).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(tokens.nth(1)).toContainText("TestToken");
    await expect(tokens.nth(1)).toContainText("1,000");
    await expect(tokens.nth(1)).toContainText(TEST_TOKEN.tokenId.slice(0, 7));
  });

  test("lists collectibles in their own tab", async ({ popup }) => {
    const page = popup.page;

    await page.getByRole("tab", { name: "Collectibles" }).click();
    await expect(page.getByRole("tabpanel")).toContainText(TEST_NFT.name);
    await expect(page.getByRole("tabpanel")).not.toContainText("TestToken");
  });

  test("filters assets by name", async ({ popup }) => {
    const page = popup.page;
    const tokens = page.getByRole("tabpanel").locator("[data-token-list] > *");
    await expect(tokens).toHaveCount(2);

    await page.locator("svg.lucide-search").click();
    await page.getByPlaceholder("Search").fill("test");

    await expect(tokens).toHaveCount(1);
    await expect(tokens.first()).toContainText("TestToken");
  });

  test("shows token details", async ({ popup }) => {
    const page = popup.page;

    await page
      .getByRole("tabpanel")
      .getByRole("button", { name: /TestToken/ })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("TestToken");
    await expect(dialog).toContainText("Emission amount");
    await expect(dialog).toContainText(TEST_TOKEN.tokenId);
  });

  test("hides balances", async ({ popup }) => {
    const page = popup.page;
    await expect(page.getByRole("heading", { name: /\$\s?25\.00/ })).toBeVisible();

    await page.locator("#toggle-balances").click();

    await expect(page.getByRole("heading", { name: "Balance hidden" })).toBeVisible();
    await expect(page.getByText(/\$\s?25\.00/)).toHaveCount(0);
    await expect(page.getByText("12.5", { exact: true })).toHaveCount(0);

    await page.locator("#toggle-balances").click();
    await expect(page.getByText("12.5", { exact: true })).toBeVisible();
  });
});

test.describe("assets without a fiat rate", () => {
  test.use({ serviceOptions: { failPrices: true } });

  test("shows the wallet balance in ERG", async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);

    await expect(popup.page.getByRole("heading", { name: /Σ\s?12\.50/ })).toBeVisible();
    await expect(popup.page.getByText("Wallet balance in ERG, USD rate unavailable")).toBeVisible();
  });
});

test("follows balances pushed by the relay", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  await popup.importWallet(WALLET_A);
  await expect(popup.page.getByText("12.5", { exact: true })).toBeVisible();

  // address #2 is the unused one past the last used, so funding it also makes the wallet
  // follow address #3
  const next = await addressOf(WALLET_A, 3);
  chain.fund(await addressOf(WALLET_A, 2), { nanoErgs: 1_000_000_000n });

  await expect(popup.page.getByText("13.5", { exact: true })).toBeVisible();
  await expect.poll(() => chain.follows(next)).toBe(true);

  // 1 ERG at 2 USD
  const delta = popup.page.locator("[data-balance-delta]");
  await expect(delta).toHaveText(/\+\$\s?2\.00/);
  await expect(delta).toHaveClass(/text-success/);
  await expect(popup.page.getByText(/Balance changed by \+\$\s?2\.00/)).toHaveCount(1);
});

test("shows a balance drop without the gain color", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  await popup.importWallet(WALLET_A);
  await expect(popup.page.getByText("12.5", { exact: true })).toBeVisible();

  const address = await addressOf(WALLET_A, 1);
  const [box] = chain.boxesOf(address);
  chain.receivePending(
    [
      [address, { nanoErgs: 1_500_000_000n }],
      [await addressOf(WALLET_B, 0), { nanoErgs: 1_000_000_000n }]
    ],
    [box]
  );

  // 1 ERG at 2 USD
  const delta = popup.page.locator("[data-balance-delta]");
  await expect(delta).toHaveText(/\u2212\$\s?2\.00/);
  await expect(delta).not.toHaveClass(/text-success/);
});

test("moves the total on a price change without showing a delta", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  await popup.importWallet(WALLET_A);
  const page = popup.page;
  const total = page.getByRole("heading", { name: /\$\s?25\.00/ });
  await expect(total).toBeVisible();
  await total.locator("span").evaluate((el) => el.setAttribute("data-before", ""));

  // as a price refresh does: 12.5 ERG at 3 USD
  await page.evaluate(async () => {
    const key = "ergoTokenRates";
    const stored = JSON.parse((await chrome.storage.local.get(key))[key] as string);
    for (const [, rate] of stored.prices) rate.fiat = (rate.fiat / 2) * 3;
    await chrome.storage.local.set({ [key]: JSON.stringify(stored) });
  });

  const moved = page.getByRole("heading", { name: /\$\s?37\.50/ });
  await expect(moved).toBeVisible();
  await expect(moved.locator("span[data-before]")).toHaveCount(0);
  await expect(page.getByText("Wallet balance")).toBeVisible();
  await expect(page.locator("[data-balance-delta]")).toHaveCount(0);
});

test("shows no balance change when the balance is first loaded", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  await popup.importWallet(WALLET_A);

  await expect(popup.page.getByRole("heading", { name: /\$\s?25\.00/ })).toBeVisible();
  await expect(popup.page.getByText("Wallet balance")).toBeVisible();
  await expect(popup.page.locator("[data-balance-delta]")).toHaveCount(0);
});

test.describe("pending balance", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await expect(popup.page.getByRole("heading", { name: /\$\s?25\.00/ })).toBeVisible();
  });

  test("marks incoming funds until they confirm", async ({ chain, popup }) => {
    const page = popup.page;
    chain.receivePending([
      [
        await addressOf(WALLET_A, 0),
        {
          nanoErgs: 4_200_000_000n,
          tokens: [{ tokenId: TEST_TOKEN.tokenId, amount: "25000" }]
        }
      ]
    ]);

    // 4.2 ERG at 2 USD; the token has no rate, so it isn't in the total
    await expect(page.getByRole("heading", { name: /\$\s?33\.40/ })).toBeVisible();
    await expect(page.locator("#pending-balance-info")).toHaveText(/Includes \$\s?8\.40 pending/);
    const rows = page.getByRole("tabpanel").locator("[data-token-list] > *");
    await expect(rows.nth(0)).toContainText("16.7");
    await expect(rows.nth(0).locator("[data-pending-amount]")).toHaveText("4.2 pending");
    await expect(rows.nth(1)).toContainText("1,250");
    await expect(rows.nth(1).locator("[data-pending-amount]")).toHaveText("250 pending");

    await rows.nth(0).locator("[data-pending-amount]").hover();
    await expect(page.locator("[data-pending-amount-tooltip]").first()).toContainText(
      "Includes 4.2 pending ERG"
    );
    await page.mouse.move(0, 0);

    await page.locator("#pending-balance-info").click();
    await expect(page.locator("[data-pending-balance-explainer]")).toContainText(
      "the sender can still cancel or replace them"
    );
    const listed = page.locator("[data-pending-asset]");
    await expect(listed).toHaveText(["4.2 ERG", "250 TestToken"]);
    await page.keyboard.press("Escape");

    const delta = page.locator("[data-balance-delta]");
    await expect(delta).toHaveCount(0, { timeout: 10_000 });
    chain.confirmPending();

    await expect(page.locator("#pending-balance-info")).toHaveCount(0);
    await expect(page.locator("[data-pending-amount]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /\$\s?33\.40/ })).toBeVisible();
    await expect(delta).toHaveCount(0);
  });

  test("explains pending tokens that aren't in the total", async ({ chain, popup }) => {
    const page = popup.page;
    chain.receivePending([
      [
        await addressOf(WALLET_A, 0),
        { nanoErgs: 1_000_000n, tokens: [{ tokenId: TEST_TOKEN.tokenId, amount: "25000" }] }
      ]
    ]);

    await expect(page.locator("#pending-balance-info")).toHaveText("Some assets are pending");
    const rows = page.getByRole("tabpanel").locator("[data-token-list] > *");
    await expect(rows.nth(1).locator("[data-pending-amount]")).toHaveText("250 pending");
  });

  test("takes dropped incoming funds out of the balance", async ({ chain, popup }) => {
    const page = popup.page;
    const tx = chain.receivePending([[await addressOf(WALLET_A, 0), { nanoErgs: 1_000_000_000n }]]);
    await expect(page.locator("#pending-balance-info")).toBeVisible();

    chain.dropPending(tx.transactionId);

    await expect(page.locator("#pending-balance-info")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /\$\s?25\.00/ })).toBeVisible();
  });

  test("doesn't mark the change of the wallet's own spend", async ({ chain, popup }) => {
    const page = popup.page;
    const address = await addressOf(WALLET_A, 1);
    const [box] = chain.boxesOf(address);
    chain.receivePending(
      [
        [address, { nanoErgs: 1_500_000_000n }],
        [await addressOf(WALLET_B, 0), { nanoErgs: 1_000_000_000n }]
      ],
      [box]
    );

    await expect(page.getByRole("heading", { name: /\$\s?23\.00/ })).toBeVisible();
    await expect(page.locator("#pending-balance-info")).toHaveCount(0);
    await expect(page.locator("[data-pending-amount]")).toHaveCount(0);
  });

  test("marks incoming collectibles", async ({ chain, popup }) => {
    const page = popup.page;
    const nft = { ...TEST_NFT, tokenId: "b".repeat(64), name: "Pending NFT" };
    chain.addToken(nft);
    chain.receivePending([
      [
        await addressOf(WALLET_A, 0),
        { nanoErgs: 1_000_000n, tokens: [{ tokenId: nft.tokenId, amount: "1" }] }
      ]
    ]);

    await page.getByRole("tab", { name: "Collectibles" }).click();
    const cards = page.getByRole("tabpanel").locator("[data-pending-amount]");
    await expect(cards).toHaveCount(1);
    await expect(cards).toHaveText("Pending");
  });
});

test.describe("assets alerts", () => {
  test("warns about demurrage and links to the wallet optimizer", async ({ chain, popup }) => {
    chain.fund(await addressOf(WALLET_A, 0), {
      nanoErgs: 1_000_000_000n,
      creationHeight: chain.height - 800_000 // older than 3 years
    });
    await popup.importWallet(WALLET_A);

    await expect(popup.page.getByText("You may soon incur demurrage")).toBeVisible();
    await popup.page.getByRole("button", { name: "Consolidate" }).click();
    await expect(popup.page).toHaveURL(/#\/dapps\/wallet-optimization$/);
  });

  test("warns again after switching back to the wallet", async ({ chain, popup }) => {
    chain.fund(await addressOf(WALLET_A, 0), {
      nanoErgs: 1_000_000_000n,
      creationHeight: chain.height - 800_000
    });
    await popup.importWallet(WALLET_A);
    await popup.importWallet(WALLET_B);

    await popup.switchWallet(WALLET_A.name);
    await expect(popup.page.getByText("You may soon incur demurrage")).toBeVisible();
  });

  test("keeps token rows in place when an alert goes away", async ({ chain, popup }) => {
    chain.fund(await addressOf(WALLET_A, 0), {
      nanoErgs: 1_000_000_000n,
      creationHeight: chain.height - 800_000
    });
    await popup.importWallet(WALLET_B);
    await popup.importWallet(WALLET_A);
    const page = popup.page;
    await expect(page.getByText("You may soon incur demurrage")).toBeVisible();

    await page.evaluate(() => {
      const w = window as unknown as { rowTransforms: string[] };
      w.rowTransforms = [];
      const sample = () => {
        for (const row of document.querySelectorAll<HTMLElement>("[data-token-list] > *")) {
          const { transform } = getComputedStyle(row);
          if (transform !== "none") w.rowTransforms.push(transform);
        }
        requestAnimationFrame(sample);
      };
      sample();
    });

    await popup.switchWallet(WALLET_B.name);
    await expect(page.getByText("You may soon incur demurrage")).toHaveCount(0);
    await page.waitForTimeout(500);

    const transforms = await page.evaluate(
      () => (window as unknown as { rowTransforms: string[] }).rowTransforms
    );
    expect(transforms).toEqual([]);
  });

  test("warns a read-only wallet without offering to consolidate", async ({ chain, popup }) => {
    chain.fund(await addressOf(WALLET_A, 0), {
      nanoErgs: 1_000_000_000n,
      creationHeight: chain.height - 800_000
    });
    await popup.importReadOnlyWallet("Watcher", await xpubOf(WALLET_A));

    await expect(popup.page.getByText("You may soon incur demurrage")).toBeVisible();
    await expect(popup.page.getByRole("button", { name: "Consolidate" })).toHaveCount(0);
  });
});

test.describe("token blacklists", () => {
  test.use({ serviceOptions: { blacklist: { nsfw: [], scam: [TEST_TOKEN.tokenId] } } });

  test("hides blacklisted tokens", async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);

    const tokens = popup.page.getByRole("tabpanel").locator("[data-token-list] > *");
    await expect(tokens).toHaveCount(1);
    await expect(tokens.first()).toContainText("ERG");

    // disabling the scam list shows the token again
    await popup.menu("Settings");
    await popup.page.locator("#scam-blacklist").click();
    await popup.navigate("assets");
    await expect(tokens).toHaveCount(2);
    await expect(tokens.nth(1)).toContainText("TestToken");
  });
});
