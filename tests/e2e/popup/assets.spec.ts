import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, TEST_NFT, TEST_TOKEN, WALLET_A } from "../fixtures/wallets";

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

    const tokens = page.getByRole("tabpanel").locator("div.pt-1 > button");
    await expect(tokens).toHaveCount(2);

    // ERG always comes first
    await expect(tokens.nth(0)).toContainText("ERG");
    await expect(tokens.nth(0)).toContainText("12.5");
    await expect(tokens.nth(0)).toContainText(/\$\s?25\.00/);

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
    const tokens = page.getByRole("tabpanel").locator("div.pt-1 > button");
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

    await popup.walletSwitcher.click();
    await page.locator("button:has(svg.lucide-eye-off)").click();

    await expect(page.getByText(/\$\s?25\.00/)).toHaveCount(0);
    await expect(page.getByText("12.5", { exact: true })).toHaveCount(0);

    await page.locator("button:has(svg.lucide-eye)").click();
    await expect(page.getByText("12.5", { exact: true })).toBeVisible();
  });
});

test("refreshes balances when a new block is mined", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  await popup.page.clock.install();
  await popup.importWallet(WALLET_A);
  await expect(popup.page.getByText("12.5", { exact: true })).toBeVisible();

  chain.fund(await addressOf(WALLET_A, 2), { nanoErgs: 1_000_000_000n });
  chain.mine();

  // height is polled every 10s and wallets are synced at most every 30s
  await popup.page.clock.fastForward("00:40");
  await expect(popup.page.getByText("13.5", { exact: true })).toBeVisible();
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
});

test.describe("token blacklists", () => {
  test.use({ serviceOptions: { blacklist: { nsfw: [], scam: [TEST_TOKEN.tokenId] } } });

  test("hides blacklisted tokens", async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);

    const tokens = popup.page.getByRole("tabpanel").locator("div.pt-1 > button");
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
