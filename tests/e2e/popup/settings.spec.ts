import { expect, fundWallet, test } from "../fixtures/test";
import { RECIPIENT_ADDRESS, WALLET_A, WALLET_B, xpubOf } from "../fixtures/wallets";

test.describe("settings", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
  });

  test.describe("global", () => {
    test("toggles developer mode", async ({ popup }) => {
      await popup.goto("/settings");
      const devMode = popup.page.locator("#dev-mode");

      await expect(devMode).not.toBeChecked();
      await devMode.click();
      await expect(devMode).toBeChecked();

      await popup.page.reload();
      await expect(devMode).toBeChecked();
    });

    test("keeps settings changed right after onboarding", async ({ popup }) => {
      await popup.importWallet(WALLET_B);
      await popup.goto("/settings");
      const page = popup.page;
      await page.locator("#dev-mode").click();
      await page.getByRole("button", { name: "usd" }).click();
      await page.getByRole("option", { name: "eur" }).click();

      await page.reload();
      await expect(page.locator("#dev-mode")).toBeChecked();
      await expect(page.getByRole("button", { name: "eur" })).toBeVisible();
      // the last opened wallet is kept too, instead of falling back to the first one
      await expect(popup.walletSwitcher).toContainText(WALLET_B.name);
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

    test("changes the color theme", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;
      const html = page.locator("html");

      await expect(page.getByRole("tab", { name: "System" })).toHaveAttribute(
        "data-state",
        "active"
      );
      await expect(html).not.toHaveClass(/dark/);

      await page.getByRole("tab", { name: "Dark" }).click();
      await expect(html).toHaveClass(/dark/);
      await page.reload();
      await expect(html).toHaveClass(/dark/);
      await expect(page.getByRole("tab", { name: "Dark" })).toHaveAttribute("data-state", "active");

      await page.getByRole("tab", { name: "Light" }).click();
      await expect(html).not.toHaveClass(/dark/);

      // "System" follows the OS preference
      await page.getByRole("tab", { name: "System" }).click();
      await page.emulateMedia({ colorScheme: "dark" });
      await expect(html).toHaveClass(/dark/);
      await page.emulateMedia({ colorScheme: "light" });
      await expect(html).not.toHaveClass(/dark/);
    });

    test("changes the display language", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;

      await page.getByRole("button", { name: "System default" }).click();
      await page.getByRole("option", { name: "Deutsch (DE)" }).click();

      await expect(page.getByRole("tab", { name: "Allgemein" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Verbindungen" })).toBeVisible();
      // labels built in script are translated without reloading
      await expect(page.getByRole("tab", { name: "Hell" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Dunkel" })).toBeVisible();
    });

    test("validates the GraphQL server", async ({ popup, chain }) => {
      await popup.goto("/settings");
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

      // visible errors are translated when the display language changes
      await page.getByRole("button", { name: "System default" }).click();
      await page.getByRole("option", { name: "Deutsch (DE)" }).click();
      await expect(page.getByText("Ungültige URL.")).toBeVisible();
      await expect(page.getByText("Invalid URL.")).toHaveCount(0);
    });

    test("toggles token blacklists and 0-conf", async ({ popup }) => {
      await popup.goto("/settings");
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

    test("changes the spending password", async ({ popup, chain }) => {
      const page = popup.page;
      const newPassword = "new spending password";

      await popup.goto("/settings");
      await page.getByRole("tab", { name: "Wallet" }).click();
      await page.getByRole("button", { name: "Change" }).click();

      const drawer = page.getByRole("dialog");
      await expect(drawer).toContainText("Change spending password");

      // validates the new password
      await drawer.locator("#current-password").fill(WALLET_A.password);
      await drawer.locator("#new-password").fill("short");
      await drawer.locator("#confirm-new-password").fill("mismatch");
      await drawer.getByRole("button", { name: "Confirm" }).click();
      await expect(
        drawer.getByText("Spending password must be at least 10 characters long.")
      ).toBeVisible();
      await expect(
        drawer.getByText("'New password' and 'Confirm new password' must match.")
      ).toBeVisible();

      // rejects a wrong current password and keeps the drawer open
      await drawer.locator("#current-password").fill("wrong password");
      await drawer.locator("#new-password").fill(newPassword);
      await drawer.locator("#confirm-new-password").fill(newPassword);
      await drawer.getByRole("button", { name: "Confirm" }).click();
      await expect(popup.toast("Wrong password")).toBeVisible();
      await expect(drawer).toBeVisible();

      await drawer.locator("#current-password").fill(WALLET_A.password);
      await drawer.getByRole("button", { name: "Confirm" }).click();
      await expect(popup.toast("Spending password changed")).toBeVisible();
      await expect(drawer).toBeHidden();

      // fields are cleared when reopening
      await page.getByRole("button", { name: "Change" }).click();
      await expect(drawer.locator("#current-password")).toHaveValue("");
      await drawer.getByRole("button", { name: "Cancel" }).last().click();
      await expect(drawer).toBeHidden();

      // the old password no longer signs transactions, the new one does
      await popup.navigate("send");
      await page.locator("#recipient").fill(RECIPIENT_ADDRESS);
      await page.getByPlaceholder("0").first().fill("1");
      await page.getByRole("button", { name: "Send", exact: true }).click();

      const review = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
      await review.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await review.getByRole("button", { name: "Sign" }).click();
      await expect(popup.toast("Wrong password").last()).toBeVisible();

      await review.getByRole("textbox", { name: "Spending password" }).fill(newPassword);
      await review.getByRole("button", { name: "Sign" }).click();
      await expect(popup.toast("Transaction sent!")).toBeVisible();
      expect(chain.submitted).toHaveLength(1);
    });

    test("backs up the recovery phrase", async ({ popup }) => {
      const page = popup.page;

      await popup.goto("/settings");
      await page.getByRole("tab", { name: "Wallet" }).click();
      await page.getByRole("button", { name: "Back up" }).click();

      const drawer = page.getByRole("dialog");
      await expect(drawer).toContainText("Mnemonic backup");

      // requires the spending password
      await drawer.getByRole("button", { name: "Show recovery phrase" }).click();
      await expect(drawer.getByText("Please enter your spending password.")).toBeVisible();

      // rejects a wrong password and keeps the drawer open
      await drawer.locator("#backup-password").fill("wrong password");
      await drawer.getByRole("button", { name: "Show recovery phrase" }).click();
      await expect(popup.toast("Wrong password")).toBeVisible();
      await expect(drawer.locator("#backup-password")).toBeVisible();

      // submits with enter
      await drawer.locator("#backup-password").fill(WALLET_A.password);
      await drawer.locator("#backup-password").press("Enter");
      await expect(drawer).toContainText("Recovery phrase");
      expect(await popup.readMnemonic()).toEqual(WALLET_A.mnemonic.split(" "));

      await drawer.getByRole("button", { name: "Copy" }).click();
      await expect(drawer.getByRole("button", { name: "Copied" })).toBeVisible();

      await drawer.getByRole("button", { name: "I've saved these words" }).click();
      await expect(drawer).toContainText("Confirm your recovery phrase");
      await expect(drawer.locator("form .grid input")).toHaveCount(3);

      await popup.fillMnemonicGaps(WALLET_A.mnemonic.split(" "));
      await drawer.getByRole("button", { name: "Confirm" }).click();
      await expect(popup.toast("Recovery phrase backed up")).toBeVisible();
      await expect(drawer).toBeHidden();

      // starts over from the password step when reopening
      await page.getByRole("button", { name: "Back up" }).click();
      await expect(drawer.locator("#backup-password")).toHaveValue("");
      await expect(drawer.locator("form .grid")).toHaveCount(0);
      await drawer.getByRole("button", { name: "Cancel" }).last().click();
      await expect(drawer).toBeHidden();
    });

    test("rejects a wrong recovery phrase confirmation on backup", async ({ popup }) => {
      const page = popup.page;
      const words = WALLET_A.mnemonic.split(" ");

      await popup.goto("/settings");
      await page.getByRole("tab", { name: "Wallet" }).click();
      await page.getByRole("button", { name: "Back up" }).click();

      const drawer = page.getByRole("dialog");
      await drawer.locator("#backup-password").fill(WALLET_A.password);
      await drawer.getByRole("button", { name: "Show recovery phrase" }).click();
      await drawer.getByRole("button", { name: "I've saved these words" }).click();

      // fill the gaps with a word that's not in the phrase
      const wrong = ["zoo", "zone", "youth"].find((w) => !words.includes(w))!;
      await popup.fillMnemonicGaps(words.map(() => wrong));
      await drawer.getByRole("button", { name: "Confirm" }).click();

      await expect(
        drawer.getByText("The recovery phrase does not match the original one.")
      ).toBeVisible();
      await expect(drawer).toContainText("Confirm your recovery phrase");
    });

    test("hides the spending password and backup options for read-only wallets", async ({
      popup
    }) => {
      await popup.importReadOnlyWallet(WALLET_B.name, await xpubOf(WALLET_B));
      await popup.goto("/settings");
      const page = popup.page;
      await page.getByRole("tab", { name: "Wallet" }).click();

      await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Change" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Back up" })).toHaveCount(0);
    });

    test("removes the only wallet", async ({ popup }) => {
      await popup.goto("/settings");
      const page = popup.page;
      await page.getByRole("tab", { name: "Wallet" }).click();

      await page.getByRole("button", { name: "Remove" }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toContainText("Are you absolutely sure?");
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
