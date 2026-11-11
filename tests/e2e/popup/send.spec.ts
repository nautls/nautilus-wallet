import { ErgoAddress } from "@fleet-sdk/core";
import type { Page } from "@playwright/test";
import { addBabelBox, expect, fundWallet, test } from "../fixtures/test";
import {
  addressOf,
  RECIPIENT_ADDRESS,
  TEST_TOKEN,
  WALLET_A,
  WALLET_B,
  xpubOf
} from "../fixtures/wallets";
import type { MockChain } from "../mocks/chain";
import type { Popup } from "../pages/popup";

const RECIPIENT_TREE = ErgoAddress.decode(RECIPIENT_ADDRESS).ergoTree;

function recipientBox(page: Page, index: number) {
  return page.locator(`[data-recipient="${index}"]`);
}

async function addToken(page: Page, index: number) {
  const box = recipientBox(page, index);
  await box.getByRole("combobox").filter({ hasText: "Add asset" }).click();
  await page.getByRole("option", { name: /TestToken/ }).click();
  await expect(box.getByText("TestToken", { exact: true })).toBeVisible();
}

function reviewDrawer(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Transaction Review" });
}

async function fillSendForm(popup: Popup, recipient: string, ergAmount?: string) {
  await popup.page.locator("#recipient-0").fill(recipient);
  if (ergAmount) await popup.page.getByPlaceholder("0").first().fill(ergAmount);
}

async function signInDrawer(popup: Popup, password: string) {
  const drawer = reviewDrawer(popup.page);
  await drawer.getByRole("textbox", { name: / password$/ }).fill(password);
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
    await expect(page.locator("#recipient-0")).toHaveValue("");
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
    await expect(page.getByText("Enter a recipient address")).toBeVisible();
    await expect(page.getByText("Enter an amount")).toBeVisible();

    await fillSendForm(popup, "9notAnAddress", "1");
    await send.click();
    await expect(page.getByText("Enter a valid Ergo address")).toBeVisible();

    await fillSendForm(popup, RECIPIENT_ADDRESS, "1000");
    await send.click();
    await expect(page.getByText(/Amount must be .* or less/)).toBeVisible();
    await expect(page.getByText("Enter a recipient address")).toHaveCount(0);
    await expect(page.getByText("Enter a valid Ergo address")).toHaveCount(0);
    await expect(reviewDrawer(page)).toHaveCount(0);

    expect(chain.submitted).toHaveLength(0);
  });

  test("validates every selected asset amount", async ({ popup, chain }) => {
    const page = popup.page;
    const send = page.getByRole("button", { name: "Send", exact: true });
    const maxAmountError = page.getByText(/Amount must be .* or less/);

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

  test("sends to multiple recipients", async ({ popup, chain }) => {
    const page = popup.page;
    const secondRecipient = await addressOf(WALLET_B, 0);
    await fillSendForm(popup, RECIPIENT_ADDRESS, "1.5");

    await page.locator("#add-recipient").click();
    await expect(page.locator("#recipient-1")).toBeFocused();
    await page.locator("#recipient-1").fill(secondRecipient);
    await recipientBox(page, 1).getByPlaceholder("0").first().fill("2");
    await addToken(page, 1);
    await recipientBox(page, 1).getByPlaceholder("0").last().fill("10");

    await page.getByRole("button", { name: "Send", exact: true }).click();
    await signInDrawer(popup, WALLET_A.password);
    await expect(popup.toast("Transaction sent!")).toBeVisible();

    const [tx] = chain.submitted;
    const first = tx.outputs.find((o) => o.ergoTree === RECIPIENT_TREE);
    expect(first?.value.toString()).toBe("1500000000");
    expect(first?.assets).toHaveLength(0);

    const secondTree = ErgoAddress.decode(secondRecipient).ergoTree;
    const second = tx.outputs.find((o) => o.ergoTree === secondTree);
    expect(second?.value.toString()).toBe("2000000000");
    expect(second?.assets).toEqual([{ tokenId: TEST_TOKEN.tokenId, amount: "1000" }]);

    // the form is reset to a single recipient
    await expect(page.locator("[data-recipient]")).toHaveCount(1);
    await expect(page.locator("#recipient-0")).toHaveValue("");
  });

  test("caps an asset split across recipients by the balance", async ({ popup, chain }) => {
    const page = popup.page;
    const send = page.getByRole("button", { name: "Send", exact: true });
    const maxAmountError = page.getByText(/Amount must be .* or less/);

    await fillSendForm(popup, RECIPIENT_ADDRESS);
    await addToken(page, 0);
    await recipientBox(page, 0).getByPlaceholder("0").last().fill("600");

    await page.locator("#add-recipient").click();
    await page.locator("#recipient-1").fill(await addressOf(WALLET_B, 0));
    await recipientBox(page, 1).getByPlaceholder("0").first().fill("1");
    await addToken(page, 1);

    // only what the first recipient left of the 1,000 TestToken is available
    await expect(recipientBox(page, 1).getByRole("button", { name: /^400$/ })).toBeVisible();
    await recipientBox(page, 1).getByPlaceholder("0").last().fill("600");
    await send.click();
    await expect(maxAmountError.first()).toBeVisible();
    await expect(reviewDrawer(page)).toHaveCount(0);

    await recipientBox(page, 1).getByPlaceholder("0").last().fill("400");
    await send.click();
    await expect(maxAmountError).toHaveCount(0);
    await expect(reviewDrawer(page)).toBeVisible();
    expect(chain.submitted).toHaveLength(0);
  });

  test("removes a recipient", async ({ popup }) => {
    const page = popup.page;
    const send = page.getByRole("button", { name: "Send", exact: true });
    await fillSendForm(popup, RECIPIENT_ADDRESS, "1");

    await expect(page.getByRole("button", { name: "Remove recipient" })).toHaveCount(0);
    await page.locator("#add-recipient").click();
    await send.click();
    await expect(page.getByText("Enter a recipient address")).toBeVisible();

    // an invalid recipient no longer blocks sending once removed
    await recipientBox(page, 1).getByRole("button", { name: "Remove recipient" }).click();
    await expect(page.locator("[data-recipient]")).toHaveCount(1);
    await expect(page.getByText("Enter a recipient address")).toHaveCount(0);

    await send.click();
    await expect(reviewDrawer(page)).toBeVisible();
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
    await expect(popup.toast(`Wrong "${WALLET_A.name}" password`)).toBeVisible();
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
    await expect(page.locator("#recipient-0")).toHaveValue(RECIPIENT_ADDRESS);
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

/**
 * Funds WALLET_A with TestToken in a box holding only the minimum ERG, and adds a Babel box
 * at 1,000 nanoERGs per TestToken unit, so the 1,100,000 nanoERGs miner fee costs 11 TestToken.
 */
async function fundTokenOnlyWallet(chain: MockChain) {
  chain.addToken(TEST_TOKEN);
  chain.fund(await addressOf(WALLET_A, 0), {
    nanoErgs: 1_000_000n,
    tokens: [{ tokenId: TEST_TOKEN.tokenId, amount: "100000" }]
  });
  addBabelBox(chain, TEST_TOKEN.tokenId, 1000n);
}

async function payFeeInTestToken(page: Page) {
  // the fee asset selector comes after the ERG amount input
  await page.getByRole("button", { name: "ERG", exact: true }).last().click();
  await page.getByRole("option", { name: /TestToken/ }).click();
}

test("a token fee covers the recipient boxes even when the wallet has ERG", async ({
  chain,
  popup
}) => {
  await fundWallet(chain, WALLET_A);
  addBabelBox(chain, TEST_TOKEN.tokenId, 1000n);
  await popup.importWallet(WALLET_A);
  await popup.navigate("send");

  const page = popup.page;
  const adjustFee = page.getByRole("button", { name: /^Adjust fee/ });
  await fillSendForm(popup, RECIPIENT_ADDRESS);
  await payFeeInTestToken(page);
  // the miner fee plus a 79 bytes box at 396 nanoERGs per byte: 1,100,000 + 79 * 396
  await expect(adjustFee).toHaveText(/11\.32$/);

  await page.locator("#add-recipient").click();
  await page.locator("#recipient-1").fill(await addressOf(WALLET_B, 0));
  // and a second one
  await expect(adjustFee).toHaveText(/11\.63$/);
});

test("a token fee follows the chain's minimum value per byte", async ({ chain, popup }) => {
  chain.minValuePerByte = 400;
  await fundWallet(chain, WALLET_A);
  addBabelBox(chain, TEST_TOKEN.tokenId, 1000n);
  await popup.importWallet(WALLET_A);
  await popup.navigate("send");

  const page = popup.page;
  await fillSendForm(popup, RECIPIENT_ADDRESS);
  await payFeeInTestToken(page);
  // the miner fee plus a 79 bytes box at 440 nanoERGs per byte: 1,100,000 + 79 * 440
  await expect(page.getByRole("button", { name: /^Adjust fee/ })).toHaveText(/11\.35$/);
});

test("a token fee funds the recipient boxes of a wallet without spare ERG", async ({
  chain,
  popup
}) => {
  await fundTokenOnlyWallet(chain);
  await popup.importWallet(WALLET_A);
  await popup.navigate("send");

  const page = popup.page;
  const secondRecipient = await addressOf(WALLET_B, 0);
  const adjustFee = page.getByRole("button", { name: /^Adjust fee/ });

  await fillSendForm(popup, RECIPIENT_ADDRESS);
  await payFeeInTestToken(page);
  await addToken(page, 0);
  await recipientBox(page, 0).getByPlaceholder("0").last().fill("10");

  await page.locator("#add-recipient").click();
  await page.locator("#recipient-1").fill(secondRecipient);
  await addToken(page, 1);
  await recipientBox(page, 1).getByPlaceholder("0").last().fill("20");
  // the miner fee plus two 113 bytes boxes holding a token: 1,100,000 + 2 * 113 * 396
  await expect(adjustFee).toHaveText(/11\.9$/);

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await signInDrawer(popup, WALLET_A.password);
  await expect(popup.toast("Transaction sent!")).toBeVisible();

  const [tx] = chain.submitted;
  const first = tx.outputs.find((o) => o.ergoTree === RECIPIENT_TREE);
  expect(first?.value.toString()).toBe("44748");
  expect(first?.assets).toEqual([{ tokenId: TEST_TOKEN.tokenId, amount: "1000" }]);

  const secondTree = ErgoAddress.decode(secondRecipient).ergoTree;
  const second = tx.outputs.find((o) => o.ergoTree === secondTree);
  expect(second?.value.toString()).toBe("44748");
  expect(second?.assets).toEqual([{ tokenId: TEST_TOKEN.tokenId, amount: "2000" }]);

  // the ERG of the spent token box
  const changeTree = ErgoAddress.decode(await addressOf(WALLET_A, 0)).ergoTree;
  const change = tx.outputs.find((o) => o.ergoTree === changeTree);
  expect(change?.value.toString()).toBe("1000000");

  // the swapped 1,190,000 nanoERGs minus what the recipient boxes took
  const minerFee = tx.outputs.find((o) => o.assets.length === 0);
  expect(minerFee?.value.toString()).toBe("1100504");
});

test("read-only wallets can't send", async ({ chain, popup }) => {
  await fundWallet(chain, WALLET_A);
  await popup.importReadOnlyWallet("Watcher", await xpubOf(WALLET_A));

  await expect(popup.navLink("send")).toHaveClass(/pointer-events-none/);
  await expect(popup.navLink("dapps")).toHaveClass(/pointer-events-none/);
});
