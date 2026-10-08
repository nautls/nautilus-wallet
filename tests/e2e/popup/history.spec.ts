import { expect, fundWallet, test } from "../fixtures/test";
import { RECIPIENT_ADDRESS, WALLET_A, WALLET_B } from "../fixtures/wallets";

test.describe("transaction history", () => {
  test("lists confirmed transactions", async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("history");

    const page = popup.page;
    const links = page.getByRole("link", { name: /^Transaction / });
    await expect(links).toHaveCount(2);
    await expect(page.getByText("11 confirmations")).toHaveCount(2);

    // received amounts
    await expect(page.getByText("TestToken")).toBeVisible();
    await expect(page.getByText("1,000", { exact: true })).toBeVisible();
    await expect(page.getByText("2.5", { exact: true })).toBeVisible();
    await expect(page.getByText("10", { exact: true })).toBeVisible();
  });

  test("shows an empty state", async ({ popup }) => {
    await popup.importWallet(WALLET_B);
    await popup.navigate("history");

    await expect(popup.page.getByText("You have no transaction history yet.")).toBeVisible();
  });

  test("shows pending transactions and allows canceling them", async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    const page = popup.page;

    // send a transaction
    await popup.navigate("send");
    await page.locator("#recipient").fill(RECIPIENT_ADDRESS);
    await page.getByPlaceholder("0").first().fill("1");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
    await page.getByRole("button", { name: "Sign" }).click();
    await expect(popup.toast("Transaction sent!")).toBeVisible();
    const [sent] = chain.submitted;

    // the mempool is polled every 10 seconds
    await popup.navigate("history");
    const pending = page.getByRole("link", { name: `Transaction ${sent.id.slice(0, 7)}` });
    await expect(pending).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Pending")).toBeVisible();

    // replace-by-fee cancellation
    await page.getByRole("button", { name: "Cancel" }).click();
    const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
    await expect(drawer.getByText("Sending to your address").first()).toBeVisible();
    await drawer.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
    await drawer.getByRole("button", { name: "Sign" }).click();
    await expect(popup.toast("Transaction sent!")).toBeVisible();

    expect(chain.submitted).toHaveLength(2);
    const [, cancel] = chain.submitted;
    const sentInputs = sent.inputs.map((i) => i.boxId);
    // double spends the original inputs, paying a higher fee and sending nothing out
    expect(cancel.inputs.map((i) => i.boxId)).toEqual(expect.arrayContaining(sentInputs));
    expect(cancel.outputs.some((o) => o.ergoTree === sent.outputs[0].ergoTree)).toBe(false);
  });
});
