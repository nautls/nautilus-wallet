import { expect, fundWallet, test } from "../fixtures/test";
import { WALLET_A, WALLET_B } from "../fixtures/wallets";
import type { Popup } from "../pages/popup";

/**
 * Reopens the popup once after onboarding. The first reopen migrates settings,
 * see "keeps settings changed right after onboarding" below.
 */
async function reopen(popup: Popup, route = "/") {
  await popup.goto(route);
  await popup.page.reload();
  await expect(popup.walletSwitcher).toBeVisible();
}

test.describe("settings", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
  });

  test.describe("global", () => {
    test("toggles developer mode", async ({ popup }) => {
      await reopen(popup, "/settings");
      const devMode = popup.page.locator("#dev-mode");

      await expect(devMode).not.toBeChecked();
      await devMode.click();
      await expect(devMode).toBeChecked();

      await popup.page.reload();
      await expect(devMode).toBeChecked();
    });

    test("keeps settings changed right after onboarding", async ({ popup }) => {
      // `isKyaAccepted` is never set during onboarding, so the next time the popup opens
      // appStore treats it as a legacy install and resets every setting to its default.
      test.fail(true, "settings are reset the first time the popup is reopened");

      await popup.goto("/settings");
      const devMode = popup.page.locator("#dev-mode");
      await devMode.click();
      await expect(devMode).toBeChecked();

      await popup.page.reload();
      await expect(devMode).toBeChecked({ timeout: 3_000 });
    });

    test("changes the conversion currency", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;

      await page.getByRole("button", { name: "usd" }).click();
      await page.getByRole("option", { name: "eur" }).click();
      await expect(page.getByRole("button", { name: "eur" })).toBeVisible();

      // 12.5 ERG at 1.5 EUR
      await popup.navigate("assets");
      await expect(page.getByRole("heading", { name: /€\s?18\.75/ })).toBeVisible();
    });

    test("changes the display language", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;

      await page.getByRole("button", { name: "System default" }).click();
      await page.getByRole("option", { name: "Deutsch (DE)" }).click();

      await expect(page.getByRole("tab", { name: "Allgemein" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Verbindungen" })).toBeVisible();
    });

    test("validates the GraphQL server", async ({ popup, chain }) => {
      await reopen(popup, "/settings");
      const page = popup.page;
      const input = page.locator("#gql-server");

      await input.fill("");
      await expect(page.getByText("GraphQL URL is required.")).toBeVisible();

      chain.network = "testnet";
      await input.fill("https://gql.ergoplatform.com/");
      await expect(page.getByText("Wrong server network.")).toBeVisible();

      chain.network = "mainnet";
      chain.version = "0.3.9";
      await input.fill("https://graphql.erg.zelcore.io/");
      await expect(
        page.getByText("Unsupported server version. Nautilus requires at least version 0.4.4.")
      ).toBeVisible();

      chain.version = "0.5.1";
      await input.fill("https://gql.ergoplatform.com/");
      await expect(page.getByText("Wrong server network.")).toHaveCount(0);
      await expect(page.getByText(/Unsupported server version/)).toHaveCount(0);

      await page.reload();
      await expect(input).toHaveValue("https://gql.ergoplatform.com/");
    });

    test("validates the explorer and IPFS gateway URLs", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;

      await page.locator("#explorer-url").fill("");
      await expect(page.getByText("Explorer URL is required.")).toBeVisible();

      await page.locator("#ipfs-gateway").fill("");
      await expect(page.getByText("IPFS Gateway URL is required.")).toBeVisible();

      await page.locator("#explorer-url").fill("not a url");
      await expect(page.getByText("Invalid URL.")).toBeVisible();
    });

    test("toggles token blacklists and 0-conf", async ({ popup }) => {
      await reopen(popup, "/settings");
      const page = popup.page;

      for (const id of ["#nsfw-blacklist", "#scam-blacklist"]) {
        await expect(page.locator(id)).toBeChecked();
        await page.locator(id).click();
        await expect(page.locator(id)).not.toBeChecked();
      }

      await expect(page.locator("[id='0-conf']")).not.toBeChecked();
      await page.locator("[id='0-conf']").click();
      await expect(page.locator("[id='0-conf']")).toBeChecked();

      await page.reload();
      await expect(page.locator("#nsfw-blacklist")).not.toBeChecked();
      await expect(page.locator("#scam-blacklist")).not.toBeChecked();
      await expect(page.locator("[id='0-conf']")).toBeChecked();
    });
  });

  test.describe("wallet", () => {
    test("renames the wallet", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;
      await page.getByRole("tab", { name: "Wallet" }).click();

      const name = page.locator("#name-input");
      await expect(name).toHaveValue(WALLET_A.name);

      await name.fill("");
      await expect(page.getByText("Wallet name is required.")).toBeVisible();
      await expect(popup.walletSwitcher).toContainText(WALLET_A.name);

      await name.fill("Savings");
      await expect(popup.walletSwitcher).toContainText("Savings");

      await page.reload();
      await expect(popup.walletSwitcher).toContainText("Savings");
    });

    test("exports the extended public key", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;
      await page.getByRole("tab", { name: "Wallet" }).click();
      await page.getByRole("button", { name: "Export" }).click();

      const drawer = page.getByRole("dialog");
      await expect(drawer).toContainText("Extended public key");
      await expect(drawer.locator(".font-mono")).toContainText(/^0488b21e[0-9a-f]{130}/);

      await drawer.getByRole("button", { name: "Close" }).last().click();
      await expect(drawer).toBeHidden();
    });

    test("removes the only wallet", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;
      await page.getByRole("tab", { name: "Wallet" }).click();

      await page.getByRole("button", { name: "Remove" }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toContainText("Are you absolutely sure?");
      // DrawerClose wraps the button in another button
      await drawer.getByRole("button", { name: "Remove" }).last().click();

      await expect(page).toHaveURL(/#\/add$/);
      await expect(page.getByText("Welcome to Nautilus Wallet")).toBeVisible();
    });

    test("removes a wallet and switches to the remaining one", async ({ popup }) => {
      await popup.importWallet(WALLET_B);
      await popup.goto("/settings");
      const page = popup.page;
      await page.getByRole("tab", { name: "Wallet" }).click();

      await page.getByRole("button", { name: "Remove" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Remove" }).last().click();

      await popup.expectWalletLoaded(WALLET_A.name);
      await popup.walletSwitcher.click();
      await expect(page.getByRole("option", { name: /Bob/ })).toHaveCount(0);
    });

    test("can cancel wallet removal", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;
      await page.getByRole("tab", { name: "Wallet" }).click();

      await page.getByRole("button", { name: "Remove" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).last().click();

      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(popup.walletSwitcher).toContainText(WALLET_A.name);
    });
  });

  test("shows an empty connections list", async ({ popup }) => {
    await popup.goto("/settings");
    await popup.page.getByRole("tab", { name: "Connections" }).click();

    await expect(popup.page.getByText("You have no connected apps yet.")).toBeVisible();
  });
});
