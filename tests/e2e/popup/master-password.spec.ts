import { expect, test } from "../fixtures/test";
import { WALLET_A, WALLET_B } from "../fixtures/wallets";

const masterPassword = "master password 123";

test.describe("master password set up for existing wallets", () => {
  test.beforeEach(async ({ popup }) => {
    await popup.importWallet(WALLET_A);
    await popup.importWallet(WALLET_B);
  });

  test("moves the chosen wallets, naming a wrong password", async ({ popup }) => {
    const page = popup.page;
    const alert = page.locator("[data-master-password-alert]");

    await popup.goto("/");
    await expect(alert).toContainText("One password for all your wallets");
    await alert.getByRole("button", { name: "Set up" }).click();

    await page.locator("#new-password").fill(masterPassword);
    await page.locator("#confirm-new-password").fill(masterPassword);
    await page.getByRole("button", { name: "Choose wallets" }).click();

    await expect(
      page.getByRole("button", { name: WALLET_A.name }).getByRole("checkbox")
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: WALLET_B.name }).getByRole("checkbox")
    ).toBeChecked();
    const setUp = page.getByRole("button", { name: "Set up master password" });
    await setUp.click();
    await expect(page.getByText(`Please enter the "${WALLET_A.name}" password.`)).toBeVisible();

    await page
      .getByRole("textbox", { name: `"${WALLET_A.name}" password` })
      .fill(WALLET_A.password);
    await page.getByRole("textbox", { name: `"${WALLET_B.name}" password` }).fill("wrong password");

    // a short one is only checked once the field is left
    const passwordB = page.getByRole("textbox", { name: `"${WALLET_B.name}" password` });
    await passwordB.fill("short");
    await page.waitForTimeout(500);
    const wrongB = page.getByRole("button", { name: WALLET_B.name }).getByLabel("Wrong password.");
    await expect(wrongB).toHaveCount(0);
    await passwordB.blur();
    await expect(wrongB).toBeVisible();
    await page.getByRole("textbox", { name: `"${WALLET_B.name}" password` }).fill("wrong password");

    // checked once typing stops, before submitting
    const rowA = page.getByRole("button", { name: WALLET_A.name });
    const rowB = page.getByRole("button", { name: WALLET_B.name });
    await expect(rowA.getByLabel("Correct password")).toBeVisible();
    await expect(rowB.getByLabel("Wrong password.")).toBeVisible();
    await expect(page.getByText("Wrong password.")).toHaveCount(1);
    await setUp.click();
    await expect(page.getByText("Wrong password.")).toHaveCount(1);

    await page
      .getByRole("textbox", { name: `"${WALLET_B.name}" password` })
      .fill(WALLET_B.password);
    await expect(page.getByText("Wrong password.")).toHaveCount(0);
    await expect(rowB.getByLabel("Correct password")).toBeVisible();
    await setUp.click();
    await expect(popup.toast("Master password set up")).toBeVisible();
    await expect(alert).toHaveCount(0);

    await popup.goto("/settings");
    await expect(page.locator("[data-master-password-settings]")).toContainText(
      "Used by 2 of 2 wallets."
    );
  });

  test("sets it up without moving unchosen wallets", async ({ popup }) => {
    const page = popup.page;

    await popup.goto("/");
    await page
      .locator("[data-master-password-alert]")
      .getByRole("button", { name: "Set up" })
      .click();
    await page.locator("#new-password").fill(masterPassword);
    await page.locator("#confirm-new-password").fill(masterPassword);
    await page.getByRole("button", { name: "Choose wallets" }).click();
    await page.getByRole("button", { name: WALLET_A.name }).getByRole("checkbox").click();

    await expect(page.getByRole("textbox", { name: `"${WALLET_A.name}" password` })).toHaveCount(0);
    await page
      .getByRole("textbox", { name: `"${WALLET_B.name}" password` })
      .fill(WALLET_B.password);
    await page.getByRole("button", { name: "Set up master password" }).click();
    await expect(popup.toast("Master password set up")).toBeVisible();

    await popup.goto("/settings");
    await expect(page.locator("[data-master-password-settings]")).toContainText(
      "Used by 1 of 2 wallets."
    );
  });

  test("tabs through each wallet's checkbox and password only", async ({ popup }) => {
    const page = popup.page;
    await popup.goto("/master-password/setup");
    await page.locator("#new-password").fill(masterPassword);
    await page.locator("#confirm-new-password").fill(masterPassword);
    await page.getByRole("button", { name: "Choose wallets" }).click();

    const rowA = page.getByRole("button", { name: WALLET_A.name });
    const rowB = page.getByRole("button", { name: WALLET_B.name });
    const passwordA = page.getByRole("textbox", { name: `"${WALLET_A.name}" password` });

    await rowA.getByRole("checkbox").focus();
    await page.keyboard.press("Tab");
    await expect(passwordA).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rowB.getByRole("checkbox")).toBeFocused();

    // space on the checkbox unticks the wallet
    await page.keyboard.press("Space");
    await expect(rowB.getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByRole("textbox", { name: `"${WALLET_B.name}" password` })).toHaveCount(0);
  });

  test("isn't offered again once declined", async ({ popup }) => {
    const page = popup.page;
    const alert = page.locator("[data-master-password-alert]");

    await popup.goto("/");
    await alert.getByRole("button", { name: "Don't ask again" }).click();
    await expect(alert).toHaveCount(0);

    await page.reload();
    await popup.expectWalletLoaded(WALLET_B.name);
    await expect(alert).toHaveCount(0);
  });

  test("is offered with a single wallet", async ({ popup }) => {
    const page = popup.page;
    await popup.goto("/settings");
    await page.getByRole("tab", { name: "Wallet" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await page.locator("#remove-confirmation-input").fill(WALLET_B.name);
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();

    await popup.goto("/");
    await popup.expectWalletLoaded(WALLET_A.name);
    await expect(page.locator("[data-master-password-alert]")).toBeVisible();
  });
});
