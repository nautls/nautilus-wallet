import { expect, fundWallet, test } from "../fixtures/test";
import { WALLET_A, WALLET_B } from "../fixtures/wallets";

test.describe("wallet switcher", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.importWallet(WALLET_B);
  });

  test("lists wallets and switches between them", async ({ popup }) => {
    const page = popup.page;
    await expect(popup.walletSwitcher).toContainText(WALLET_B.name);
    await expect(page.getByText("12.5", { exact: true })).toHaveCount(0);

    await popup.walletSwitcher.click();
    await expect(page.getByRole("option", { name: /Alice/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Bob/ })).toBeVisible();
    await page.getByRole("option", { name: /Alice/ }).click();

    await popup.expectWalletLoaded(WALLET_A.name);
    await expect(page.getByText("12.5", { exact: true })).toBeVisible();

    // the last opened wallet is restored on the next session
    await page.reload();
    await expect(popup.walletSwitcher).toContainText(WALLET_A.name);
  });

  test("returns to the assets screen after switching", async ({ popup }) => {
    await popup.navigate("receive");
    await popup.switchWallet(WALLET_A.name);

    await expect(popup.page).toHaveURL(/#\/$/);
  });

  test("searches wallets by name", async ({ popup }) => {
    const page = popup.page;
    await popup.walletSwitcher.click();

    const search = page.getByPlaceholder("Search");
    await search.fill("ali");
    await expect(page.getByRole("option", { name: /Alice/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Bob/ })).toHaveCount(0);

    await search.fill("nobody");
    await expect(page.getByText("No wallets found.")).toBeVisible();
  });

  test("navigates to menu entries", async ({ popup }) => {
    await popup.menu("Settings");
    await expect(popup.page).toHaveURL(/#\/settings$/);

    await popup.menu("About");
    await expect(popup.page).toHaveURL(/#\/about$/);

    await popup.menu("New wallet");
    await expect(popup.page).toHaveURL(/#\/add$/);
  });

  test("toggles from auto to the opposite of a light system", async ({ popup }) => {
    const page = popup.page;
    await popup.walletSwitcher.click();

    // the button shows the mode it switches to
    await page.locator("button:has(svg.lucide-moon)").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("button:has(svg.lucide-sun)")).toBeVisible();
  });

  test("toggles from auto to the opposite of a dark system", async ({ popup }) => {
    const page = popup.page;
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await popup.walletSwitcher.click();

    await page.locator("button:has(svg.lucide-sun)").click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator("button:has(svg.lucide-moon)")).toBeVisible();
  });

  test("follows system changes while in auto mode", async ({ popup }) => {
    const page = popup.page;
    await popup.walletSwitcher.click();
    await expect(page.locator("button:has(svg.lucide-moon)")).toBeVisible();

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("button:has(svg.lucide-sun)")).toBeVisible();
  });

  test("only toggles between light and dark", async ({ popup }) => {
    const page = popup.page;
    await popup.walletSwitcher.click();

    for (const [icon, dark] of [
      ["moon", true],
      ["sun", false],
      ["moon", true]
    ] as const) {
      await page.locator(`button:has(svg.lucide-${icon})`).click();
      if (dark) await expect(page.locator("html")).toHaveClass(/dark/);
      else await expect(page.locator("html")).not.toHaveClass(/dark/);
    }

    await expect(page.locator("svg.lucide-sun-moon")).toHaveCount(0);
  });
});
