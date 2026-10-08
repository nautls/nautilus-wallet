import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, fundWallet, test } from "../fixtures/test";
import { WALLET_A, xpubOf } from "../fixtures/wallets";

const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
const DONATION_ADDRESS = "9iPgSVU3yrRnTxtJC6hYA7bS5mMqZtjeJHrT3fNdLV7JZVpY5By";

test.describe("about", () => {
  test("shows the version and links", async ({ popup }) => {
    await popup.importWallet(WALLET_A);
    await popup.menu("About");
    const page = popup.page;

    const commit = execSync("git rev-parse HEAD").toString().trim();
    await expect(page.getByRole("heading", { name: "Nautilus Wallet" })).toBeVisible();
    await expect(page.getByText(`v${pkg.version}-`)).toBeVisible();
    await expect(page.getByRole("link", { name: commit.slice(0, 7) })).toHaveAttribute(
      "href",
      new RegExp(commit)
    );
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms of Use" })).toBeVisible();
  });

  test("donation link opens the send screen with the recipient", async ({ popup, chain }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.menu("About");

    await popup.page.getByRole("button", { name: /^9iPgSVU/ }).click();

    await expect(popup.page).toHaveURL(/#\/send\?recipient=/);
    await expect(popup.page.locator("#recipient")).toHaveValue(DONATION_ADDRESS);
  });

  test("read-only wallets get a copyable donation address", async ({ popup }) => {
    await popup.importReadOnlyWallet("Watcher", await xpubOf(WALLET_A));
    await popup.menu("About");

    await expect(popup.page.getByText(/9iPgSVU/)).toBeVisible();
    await expect(popup.page.getByRole("button", { name: /^9iPgSVU/ })).toHaveCount(0);
  });
});
