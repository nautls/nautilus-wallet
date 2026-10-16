import { ErgoAddress } from "@fleet-sdk/core";
import type { Page } from "@playwright/test";
import { addBabelBox, expect, fundWallet, test } from "../fixtures/test";
import { addressOf, RECIPIENT_ADDRESS, TEST_TOKEN, WALLET_A, xpubOf } from "../fixtures/wallets";
import type { Popup } from "../pages/popup";

const RECIPIENT_TREE = ErgoAddress.decode(RECIPIENT_ADDRESS).ergoTree;

function reviewDrawer(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Transaction Review" });
}

async function fillSendForm(popup: Popup, recipient: string, ergAmount?: string) {
  await popup.page.locator("#recipient").fill(recipient);
  if (ergAmount) await popup.page.getByPlaceholder("0").first().fill(ergAmount);
}

async function signInDrawer(popup: Popup, password: string) {
  const drawer = reviewDrawer(popup.page);
  await drawer.getByRole("textbox", { name: "Spending password" }).fill(password);
  await drawer.getByRole("button", { name: "Sign" }).click();
}

test.describe("send", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("send");
  });

  test("sends ERG to an address", async ({ popup, chain }) => {
    const page = popup.page;
    await fillSendForm(popup, RECIPIENT_ADDRESS, "1.5");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    const drawer = reviewDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Sending to external address")).toBeVisible();
    await expect(drawer.getByText("Total assets leaving your wallet")).toBeVisible();
    await expect(drawer.getByText("Network fee")).toBeVisible();

    await signInDrawer(popup, WALLET_A.password);

    await expect(popup.toast("Transaction sent!")).toBeVisible();
    await expect(drawer).toBeHidden();

    expect(chain.submitted).toHaveLength(1);
    const [tx] = chain.submitted;
    const payment = tx.outputs.find((o) => o.ergoTree === RECIPIENT_TREE);
    expect(payment?.value.toString()).toBe("1500000000");
    expect(payment?.assets).toHaveLength(0);

    // change goes back to the default address
    const changeTree = ErgoAddress.decode(await addressOf(WALLET_A, 0)).ergoTree;
    expect(tx.outputs.some((o) => o.ergoTree === changeTree)).toBe(true);

    // the form is reset
    await expect(page.locator("#recipient")).toHaveValue("");
  });

  test("sends tokens", async ({ popup, chain }) => {
    const page = popup.page;
    await fillSendForm(popup, RECIPIENT_ADDRESS);

    await page.getByRole("combobox").filter({ hasText: "Add asset" }).click();
    await page.getByRole("option", { name: /TestToken/ }).click();

    const amounts = page.getByPlaceholder("0");
    await expect(amounts).toHaveCount(2);
    // ERG is set to the minimum box value when adding a token
    await expect(amounts.first()).toHaveValue("0.001");
    await amounts.last().fill("12.34");

    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(reviewDrawer(page).getByText("TestToken").first()).toBeVisible();
    await signInDrawer(popup, WALLET_A.password);
    await expect(popup.toast("Transaction sent!")).toBeVisible();

    const payment = chain.submitted[0].outputs.find((o) => o.ergoTree === RECIPIENT_TREE);
    expect(payment?.value.toString()).toBe("1000000");
    expect(payment?.assets).toEqual([{ tokenId: TEST_TOKEN.tokenId, amount: "1234" }]);
  });

  test("validates the form", async ({ popup, chain }) => {
    const page = popup.page;
    const send = page.getByRole("button", { name: "Send", exact: true });

    await send.click();
    await expect(page.getByText("Please enter the recipient address.")).toBeVisible();
    await expect(page.getByText("Please enter an amount.")).toBeVisible();

    await fillSendForm(popup, "9notAnAddress", "1");
    await send.click();
    await expect(page.getByText("Please enter a valid Ergo address.")).toBeVisible();

    await fillSendForm(popup, RECIPIENT_ADDRESS, "1000");
    await send.click();
    await expect(page.getByText(/The amount should be less than or equal to/)).toBeVisible();
    await expect(page.getByText("Please enter the recipient address.")).toHaveCount(0);
    await expect(page.getByText("Please enter a valid Ergo address.")).toHaveCount(0);
    await expect(reviewDrawer(page)).toHaveCount(0);

    expect(chain.submitted).toHaveLength(0);
  });

  test("validates every selected asset amount", async ({ popup, chain }) => {
    const page = popup.page;
    const send = page.getByRole("button", { name: "Send", exact: true });
    const maxAmountError = page.getByText(/The amount should be less than or equal to/);

    await fillSendForm(popup, RECIPIENT_ADDRESS, "1");
    await page.getByRole("combobox").filter({ hasText: "Add asset" }).click();
    await page.getByRole("option", { name: /TestToken/ }).click();

    const amounts = page.getByPlaceholder("0");
    await expect(amounts).toHaveCount(2);

    // more than the 1,000 TestToken held by the wallet
    const tokenAmount = amounts.last();
    await tokenAmount.fill("5000");
    // submit while the input keeps focus, so the error can only come from the form
    // validation, not from the input's own blur validation
    await tokenAmount.press("Enter");
    await expect(maxAmountError).toBeVisible();
    await expect(reviewDrawer(page)).toHaveCount(0);

    // a removed asset no longer blocks sending
    await tokenAmount.hover();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(amounts).toHaveCount(1);
    await expect(maxAmountError).toHaveCount(0);

    await send.click();
    await expect(reviewDrawer(page)).toBeVisible();
    await signInDrawer(popup, WALLET_A.password);
    await expect(popup.toast("Transaction sent!")).toBeVisible();

    const payment = chain.submitted[0].outputs.find((o) => o.ergoTree === RECIPIENT_TREE);
    expect(payment?.value.toString()).toBe("1000000000");
    expect(payment?.assets).toHaveLength(0);
  });

  test("fills the maximum available amount", async ({ popup }) => {
    const page = popup.page;
    const amount = page.getByPlaceholder("0").first();

    // 12.5 ERG minus the reserved fee and change box for the remaining tokens
    await page.getByRole("button", { name: /12\.49/ }).click();
    await expect(amount).toHaveValue(/^12\.49/);
  });

  test("keeps the drawer open on a wrong password", async ({ popup, chain }) => {
    const page = popup.page;
    await fillSendForm(popup, RECIPIENT_ADDRESS, "1");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await signInDrawer(popup, "wrong password");
    await expect(popup.toast("Wrong password")).toBeVisible();
    await expect(reviewDrawer(page)).toBeVisible();

    await signInDrawer(popup, WALLET_A.password);
    await expect(popup.toast("Transaction sent!")).toBeVisible();
    expect(chain.submitted).toHaveLength(1);
  });

  test("can be canceled from the review drawer", async ({ popup, chain }) => {
    const page = popup.page;
    await fillSendForm(popup, RECIPIENT_ADDRESS, "1");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await reviewDrawer(page).getByRole("button", { name: "Cancel" }).click();
    await expect(reviewDrawer(page)).toBeHidden();

    expect(chain.submitted).toHaveLength(0);
    await expect(page.locator("#recipient")).toHaveValue(RECIPIENT_ADDRESS);
  });

  test("reports broadcast errors", async ({ popup, chain }) => {
    const page = popup.page;
    chain.submitError = "Transaction rejected by the mempool";

    await fillSendForm(popup, RECIPIENT_ADDRESS, "1");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await signInDrawer(popup, WALLET_A.password);

    const toast = popup.toast("Transaction broadcast failed");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Transaction rejected by the mempool");

    // retry once the node accepts it
    chain.submitError = undefined;
    // the review drawer hides everything else from the accessibility tree
    await toast.locator("button", { hasText: "Try again" }).click();
    await expect.poll(() => chain.submitted.length).toBe(1);
  });
});

test("an insufficient fee blocks sending", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  // 1,000 nanoERGs per TestToken unit: the minimum fee plus a change box costs 21 TestToken
  addBabelBox(chain, TEST_TOKEN.tokenId, 1000n);
  await popup.importWallet(WALLET_A);
  await popup.navigate("send");

  const page = popup.page;
  const send = page.getByRole("button", { name: "Send", exact: true });
  const minFeeError = page.getByText(/You need to pay a minimum fee of 21 TestToken/);
  await fillSendForm(popup, RECIPIENT_ADDRESS, "1");

  // the fee asset selector comes after the ERG amount input
  await page.getByRole("button", { name: "ERG", exact: true }).last().click();
  await page.getByRole("option", { name: /TestToken/ }).click();

  // lower the fee multiplier below the required minimum
  const multiplier = page.getByRole("slider");
  await multiplier.focus();
  await multiplier.press("Home");
  await expect(multiplier).toHaveAttribute("aria-valuenow", "1");

  await send.click();
  await expect(minFeeError).toBeVisible();
  await expect(reviewDrawer(page)).toHaveCount(0);

  await multiplier.press("End");
  await expect(minFeeError).toHaveCount(0);
  await send.click();
  await expect(reviewDrawer(page)).toBeVisible();
});

test("read-only wallets can't send", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  await popup.importReadOnlyWallet("Watcher", await xpubOf(WALLET_A));

  await expect(popup.navLink("send")).toHaveClass(/pointer-events-none/);
  await expect(popup.navLink("dapps")).toHaveClass(/pointer-events-none/);
});
