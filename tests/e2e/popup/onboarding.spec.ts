import { expect, fundWallet, test } from "../fixtures/test";
import { WALLET_A, WALLET_B, xpubOf } from "../fixtures/wallets";

test.describe("onboarding", () => {
  test("redirects to the add wallet screen when there are no wallets", async ({ popup }) => {
    await popup.goto();

    await expect(popup.page).toHaveURL(/#\/add$/);
    await expect(popup.page.getByText("Welcome to Nautilus Wallet")).toBeVisible();
    await expect(popup.page.getByRole("button", { name: /Create a new wallet/ })).toBeVisible();
    await expect(popup.page.getByRole("button", { name: /Connect a Ledger wallet/ })).toBeVisible();
    await expect(popup.page.getByRole("button", { name: /Import a wallet/ })).toBeVisible();
    await expect(popup.page.getByRole("link", { name: "Terms of Use" })).toBeVisible();
    // no cancel button when there's no wallet to go back to
    await expect(popup.page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  });

  test.describe("create wallet", () => {
    test("creates a wallet after confirming the recovery phrase", async ({ popup }) => {
      await popup.goto("/add");
      await popup.page.getByRole("button", { name: /Create a new wallet/ }).click();
      await expect(popup.page).toHaveURL(/#\/add\/new$/);
      await expect(popup.page.getByText("Wallet information").first()).toBeVisible();

      await popup.fillWalletInfo("Fresh wallet", "a very long password");
      await popup.page.getByRole("button", { name: "Back up recovery phrase" }).click();

      // step 2: recovery phrase, 15 words by default
      await expect(popup.page.getByText("Recovery phrase").first()).toBeVisible();
      let words = await popup.readMnemonic();
      expect(words).toHaveLength(15);

      // switching to 24 words generates a new phrase
      await popup.page.getByRole("tab", { name: "24 words" }).click();
      await expect.poll(async () => (await popup.readMnemonic()).length).toBe(24);
      await popup.page.getByRole("tab", { name: "15 words" }).click();
      await expect.poll(async () => (await popup.readMnemonic()).length).toBe(15);
      words = await popup.readMnemonic();

      await popup.page.getByRole("button", { name: "I've stored my recovery phrase safely" }).click();

      // step 3: confirm three random words
      await expect(popup.page.getByText("Confirm your recovery phrase").first()).toBeVisible();
      await expect(popup.page.locator("form .grid input")).toHaveCount(3);
      await popup.fillMnemonicGaps(words);
      await popup.page.getByRole("button", { name: "Confirm" }).click();

      await popup.expectWalletLoaded("Fresh wallet");
      await expect(popup.walletSwitcher).toContainText("Standard");
      await expect(popup.page.getByText("Your wallet isn't backed up")).toHaveCount(0);
    });

    test("creates a wallet without a backup and asks to back it up", async ({ popup }) => {
      const page = popup.page;

      await popup.goto("/add/new");

      // still requires the wallet information
      await page.getByRole("button", { name: "Skip" }).click();
      await expect(page.getByText("Wallet name is required.")).toBeVisible();

      await popup.fillWalletInfo("Unsafe wallet", "a very long password");
      await page.getByRole("button", { name: "Back up recovery phrase" }).click();
      const words = await popup.readMnemonic();
      await page.getByRole("button", { name: "Skip" }).click();

      await popup.expectWalletLoaded("Unsafe wallet");
      const alert = page.getByRole("alert").filter({ hasText: "Your wallet isn't backed up" });
      await expect(alert).toBeVisible();

      // keeps asking until backed up
      await page.reload();
      await expect(alert).toBeVisible();

      await alert.getByRole("button", { name: "Back up now" }).click();
      const drawer = page.getByRole("dialog");
      await drawer.locator("#backup-password").fill("a very long password");
      await drawer.getByRole("button", { name: "Show recovery phrase" }).click();
      await expect(drawer.locator("form .grid")).toBeVisible();
      expect(await popup.readMnemonic()).toEqual(words);
      await drawer.getByRole("button", { name: "I've stored my recovery phrase safely" }).click();
      await popup.fillMnemonicGaps(words);
      await drawer.getByRole("button", { name: "Confirm" }).click();

      await expect(popup.toast("Recovery phrase backed up")).toBeVisible();
      await expect(alert).toHaveCount(0);
    });

    test("validates wallet information", async ({ popup }) => {
      await popup.goto("/add/new");
      const next = popup.page.getByRole("button", { name: "Back up recovery phrase" });

      await next.click();
      await expect(popup.page.getByText("Wallet name is required.")).toBeVisible();
      await expect(popup.page.getByText("Spending password is required.")).toBeVisible();

      await popup.fillWalletInfo("My wallet", "short", "short");
      await next.click();
      await expect(
        popup.page.getByText("Spending password must be at least 10 characters long.")
      ).toBeVisible();

      await popup.fillWalletInfo("My wallet", "long enough password", "another password");
      await next.click();
      await expect(
        popup.page.getByText("'Spending password' and 'Confirm password' must match.")
      ).toBeVisible();

      // still on the first step
      await expect(popup.page.locator("#wallet-name")).toBeVisible();
    });

    test("rejects a wrong recovery phrase confirmation", async ({ popup }) => {
      await popup.goto("/add/new");
      await popup.fillWalletInfo("My wallet", "long enough password");
      await popup.page.getByRole("button", { name: "Back up recovery phrase" }).click();

      const words = await popup.readMnemonic();
      await popup.page.getByRole("button", { name: "I've stored my recovery phrase safely" }).click();

      // fill the gaps with a word that's not in the phrase
      const wrong = ["zoo", "zone", "youth"].find((w) => !words.includes(w))!;
      await popup.fillMnemonicGaps(words.map(() => wrong));
      await popup.page.getByRole("button", { name: "Confirm" }).click();

      await expect(
        popup.page.getByText("The recovery phrase does not match the original one.")
      ).toBeVisible();
      await expect(popup.page).toHaveURL(/#\/add\/new/);
    });
  });

  test.describe("import wallet", () => {
    test("imports a standard wallet by pasting its recovery phrase", async ({ popup, chain }) => {
      await fundWallet(chain, WALLET_A);

      await popup.goto("/add");
      await popup.page.getByRole("button", { name: /Import a wallet/ }).click();
      await expect(popup.page).toHaveURL(/#\/add\/import$/);

      await popup.fillWalletInfo(WALLET_A.name, WALLET_A.password);
      await popup.page.getByRole("button", { name: "Insert a recovery phrase" }).click();
      await popup.paste(WALLET_A.mnemonic);

      // pasting fills every word
      const words = popup.page.locator("form .grid input");
      await expect(words).toHaveCount(15);
      await expect(words.first()).toHaveValue("enough");
      await expect(words.last()).toHaveValue("nominee");

      await popup.page.getByRole("button", { name: "Import", exact: true }).click();

      await popup.expectWalletLoaded(WALLET_A.name);
      await expect(popup.page.getByText("12.5", { exact: true })).toBeVisible();
    });

    test("adjusts the word count to the pasted phrase", async ({ popup }) => {
      await popup.goto("/add/import");
      await popup.fillWalletInfo(WALLET_B.name, WALLET_B.password);
      await popup.page.getByRole("button", { name: "Insert a recovery phrase" }).click();

      await expect(popup.page.locator("form .grid > div")).toHaveCount(15);
      await popup.paste(WALLET_B.mnemonic);
      await expect(popup.page.locator("form .grid > div")).toHaveCount(12);
      await expect(popup.page.getByRole("combobox").filter({ hasText: "12 words" })).toBeVisible();

      await popup.page.getByRole("button", { name: "Import", exact: true }).click();
      await popup.expectWalletLoaded(WALLET_B.name);
    });

    test("ignores pasted text that isn't a valid phrase", async ({ popup }) => {
      await popup.goto("/add/import");
      await popup.fillWalletInfo(WALLET_A.name, WALLET_A.password);
      await popup.page.getByRole("button", { name: "Insert a recovery phrase" }).click();

      await popup.paste("this is definitely not a recovery phrase at all ok");
      await popup.page.getByRole("button", { name: "Import", exact: true }).click();

      await expect(popup.page.getByText("Recovery phrase is required.")).toBeVisible();
      await expect(popup.page).toHaveURL(/#\/add\/import/);
    });

    test("imports a read-only wallet from an extended public key", async ({ popup, chain }) => {
      await fundWallet(chain, WALLET_A);
      await popup.goto("/add/import");

      await popup.fillWalletInfo("Watcher");
      await popup.selectWalletType("Read-only");
      await expect(popup.page.locator("#password")).toBeDisabled();
      await expect(popup.page.locator("#confirm-password")).toBeDisabled();

      await popup.page.getByRole("button", { name: "Insert a public key" }).click();
      await popup.page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(popup.page.getByText("Extended public key is required.")).toBeVisible();

      await popup.page.locator("#xpk").fill("not a key");
      await popup.page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(popup.page.getByText("Invalid public key")).toBeVisible();

      await popup.page.locator("#xpk").fill(await xpubOf(WALLET_A));
      await popup.page.getByRole("button", { name: "Import", exact: true }).click();

      await popup.expectWalletLoaded("Watcher");
      await expect(popup.walletSwitcher).toContainText("Read-only");
      await expect(popup.page.getByText("12.5", { exact: true })).toBeVisible();
    });

    test("shows a cancel button when a wallet already exists", async ({ popup }) => {
      await popup.importWallet(WALLET_A);
      await popup.menu("New wallet");

      await expect(popup.page).toHaveURL(/#\/add$/);
      await popup.page.getByRole("button", { name: "Cancel" }).click();
      await popup.expectWalletLoaded(WALLET_A.name);
    });
  });

  test("opens the Ledger connection flow in a new tab", async ({ popup, context }) => {
    await popup.goto("/add");

    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      popup.page.getByRole("button", { name: /Connect a Ledger wallet/ }).click()
    ]);

    await tab.waitForURL(/#\/add\/hw\/ledger\?redirect=false$/);
    await expect(tab.getByText("Connect a Ledger wallet").first()).toBeVisible();
  });
});
