import type { Locator, Page } from "@playwright/test";
import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, WALLET_A } from "../fixtures/wallets";
import { connectDapp, invoke } from "../pages/connector";

/** Address rows in the receive screen, newest first. */
function addressRows(page: Page): Locator {
  return page
    .getByRole("checkbox")
    .locator("xpath=ancestor::div[contains(@class, 'justify-between')][1]");
}

function shorten(address: string) {
  return `${address.slice(0, 3)}…${address.slice(-3)}`;
}

test.describe("receive", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("receive");
  });

  test("shows the default address and the address list", async ({ popup }) => {
    const page = popup.page;
    const [addr0, addr1, addr2] = await Promise.all([0, 1, 2].map((i) => addressOf(WALLET_A, i)));

    await expect(page.getByText("Default address")).toBeVisible();
    await expect(page.getByText(addr0)).toBeVisible();

    const rows = addressRows(page);
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(shorten(addr2));
    await expect(rows.nth(0)).toContainText("Unused");
    await expect(rows.nth(1)).toContainText(shorten(addr1));
    await expect(rows.nth(1)).toContainText(/2\.50* ERG/);
    await expect(rows.nth(2)).toContainText(shorten(addr0));
    await expect(rows.nth(2)).toContainText(/10(\.0+)? ERG\s*\+2/);

    await expect(rows.nth(2).getByRole("checkbox")).toBeChecked();
  });

  test("filters addresses", async ({ popup }) => {
    const page = popup.page;
    const rows = addressRows(page);

    await page.getByRole("tab", { name: "Active" }).click();
    await expect(rows).toHaveCount(2);
    // can't derive new addresses while filtering active ones
    await expect(page.locator("button:has(svg.lucide-circle-plus)")).toBeDisabled();

    await page.getByRole("tab", { name: "Unused" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Unused");

    await page.getByRole("tab", { name: "All" }).click();
    await expect(rows).toHaveCount(3);
  });

  test("derives new addresses", async ({ popup }) => {
    const page = popup.page;
    const rows = addressRows(page);
    await expect(rows).toHaveCount(3);

    await page.locator("button:has(svg.lucide-circle-plus)").click();

    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText(shorten(await addressOf(WALLET_A, 3)));
    await expect(rows.first()).toContainText("Unused");

    // persisted
    await page.reload();
    await expect(rows).toHaveCount(4);
  });

  test("changes the default address", async ({ popup, context, dapp }) => {
    const page = popup.page;
    const addr1 = await addressOf(WALLET_A, 1);

    await addressRows(page).nth(1).getByRole("button").first().click();

    await expect(addressRows(page).nth(1).getByRole("checkbox")).toBeChecked();
    await expect(page.getByText(addr1, { exact: true })).toBeVisible();

    // the dApp change address follows the default address
    await connectDapp(context, dapp, WALLET_A.name);
    expect(await invoke(dapp, () => window.ergo.get_change_address())).toEqual({
      ok: true,
      value: addr1
    });
  });

  test("shows an address QR code", async ({ popup }) => {
    const page = popup.page;
    const addr2 = await addressOf(WALLET_A, 2);

    await addressRows(page).first().locator("svg.lucide-qr-code").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Address QR code");
    await expect(dialog).toContainText(addr2.slice(0, 9));
    await expect(dialog).toContainText(addr2.slice(-9));
  });

  test("shows the current unused address when avoiding address reuse", async ({ popup }) => {
    const page = popup.page;

    await popup.menu("Settings");
    await page.getByRole("tab", { name: "Wallet" }).click();
    await page.locator("#address-reuse").click();
    await popup.navigate("receive");

    await expect(page.getByText("Current address")).toBeVisible();
    await expect(page.getByText(await addressOf(WALLET_A, 2), { exact: true })).toBeVisible();
  });
});
