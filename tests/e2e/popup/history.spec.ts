import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, RECIPIENT_ADDRESS, WALLET_A, WALLET_B } from "../fixtures/wallets";

test.describe("transaction history", () => {
  test("lists confirmed transactions", async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("history");

    const page = popup.page;
    const links = page.getByRole("link", { name: /^Transaction / });
    await expect(links).toHaveCount(2);
    await expect(page.locator('[data-confirmations="11"]')).toHaveCount(2);

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
    await page.locator("#recipient-0").fill(RECIPIENT_ADDRESS);
    await page.getByPlaceholder("0").first().fill("1");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
    await page.getByRole("button", { name: "Sign" }).click();
    await expect(popup.toast("Transaction sent")).toBeVisible();
    const [sent] = chain.submitted;

    await popup.navigate("history");
    const pending = page.getByRole("link", { name: `Transaction ${sent.id.slice(0, 7)}` });
    await expect(pending).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();

    // replace-by-fee cancellation
    await page.getByRole("button", { name: "Cancel" }).click();
    const drawer = page.getByRole("dialog").filter({ hasText: "Transaction review" });
    await expect(drawer.getByText("Sending to your address").first()).toBeVisible();
    await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
    await drawer.getByRole("button", { name: "Sign" }).click();
    await expect(popup.toast("Transaction sent")).toBeVisible();

    expect(chain.submitted).toHaveLength(2);
    const [, cancel] = chain.submitted;
    const sentInputs = sent.inputs.map((i) => i.boxId);
    // double spends the original inputs, paying a higher fee and sending nothing out
    expect(cancel.inputs.map((i) => i.boxId)).toEqual(expect.arrayContaining(sentInputs));
    expect(cancel.outputs.some((o) => o.ergoTree === sent.outputs[0].ergoTree)).toBe(false);
  });

  test("lists a tx paying several own addresses once, with its amounts summed", async ({
    chain,
    popup
  }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("history");
    const page = popup.page;
    const links = page.getByRole("link", { name: /^Transaction / });
    await expect(links).toHaveCount(2);

    const tx = chain.receivePending([
      [await addressOf(WALLET_A, 0), { nanoErgs: 1_000_000_000n }],
      [await addressOf(WALLET_A, 1), { nanoErgs: 2_000_000_000n }]
    ]);

    // shown as the history follows the addresses, without leaving the page
    const card = page.locator(`[data-tx-id="${tx.transactionId}"]`);
    await expect(card).toHaveCount(1);
    await expect(card.getByText("Pending")).toBeVisible();
    await expect(card.getByText("3", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await expect(links).toHaveCount(3);
  });

  test("pages through several addresses' histories in order", async ({ chain, popup }) => {
    const top = chain.height;
    // 30 txs on the first address, past the relay's 25 per page, and 3 on the second among them
    const first = await addressOf(WALLET_A, 0);
    for (let i = 1; i <= 30; i++) {
      chain.fund(first, { nanoErgs: 1_000_000_000n, creationHeight: top - 2 * i });
    }
    const second = await addressOf(WALLET_A, 1);
    for (const i of [5, 27, 29]) {
      chain.fund(second, { nanoErgs: 1_000_000_000n, creationHeight: top - 2 * i - 1 });
    }

    await popup.importWallet(WALLET_A);
    await popup.navigate("history");
    const page = popup.page;
    const cards = page.locator("[data-tx-id]");
    const more = page.locator("#history-more");

    // the first address's first page reaches 50 blocks back: the second's two older txs wait
    await expect(more).toBeVisible();
    await expect(cards).toHaveCount(25);

    await more.click();
    await expect(more).toBeHidden();
    await expect(cards).toHaveCount(33);

    const confirmations = await cards
      .locator("[data-confirmations]")
      .evaluateAll((els) => els.map((x) => Number(x.getAttribute("data-confirmations"))));
    const expected = [
      ...Array.from({ length: 30 }, (_, i) => 2 * (i + 1) + 1),
      ...[5, 27, 29].map((i) => 2 * i + 2)
    ].sort((a, b) => a - b);
    expect(confirmations).toEqual(expected);
  });

  test("warns that canceling a tx also cancels the txs spending its outputs", async ({
    chain,
    popup
  }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    const page = popup.page;

    // 12.5 ERG in all: the second send needs the first's change
    for (const amount of ["1", "11"]) {
      await popup.navigate("send");
      await page.locator("#recipient-0").fill(RECIPIENT_ADDRESS);
      await page.getByPlaceholder("0").first().fill(amount);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const password = page.getByRole("textbox", { name: / password$/ });
      const sign = page.getByRole("button", { name: "Sign" });
      await expect(password.or(sign).first()).toBeVisible();
      if (await password.isVisible()) await password.fill(WALLET_A.password);
      await sign.click();
      await expect(popup.toast("Transaction sent").last()).toBeVisible();
    }
    const [first, second] = chain.submitted;
    expect(second.inputs.some((i) => first.outputs.some((o) => o.boxId === i.boxId))).toBe(true);

    await popup.navigate("history");
    const drawer = page.getByRole("dialog").filter({ hasText: "Transaction review" });

    await page
      .locator(`[data-tx-id="${first.id}"]`)
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(drawer.locator("#tx-sign-notice")).toContainText(
      `This replaces transaction ${first.id.slice(0, 7)}`
    );
    await expect(drawer.locator("#tx-sign-warning")).toContainText(
      `This cancels pending transaction ${second.id.slice(0, 7)}`
    );
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    await page
      .locator(`[data-tx-id="${second.id}"]`)
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(drawer.getByText("Network fee")).toBeVisible();
    await expect(drawer.locator("#tx-sign-notice")).toContainText(
      `This replaces transaction ${second.id.slice(0, 7)}`
    );
    await expect(drawer.locator("#tx-sign-warning")).toHaveCount(0);
  });

  test("lets a tx spending a wallet's box be canceled though it pays the wallet back more", async ({
    chain,
    popup
  }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    const page = popup.page;
    await popup.navigate("history");
    await expect(page.locator("[data-tx-id]")).toHaveCount(2);

    // spends the second address's 2.5 ERG and pays the first 3 ERG: the wallet gains 0.5
    const [spent] = chain.boxesOf(await addressOf(WALLET_A, 1));
    const tx = chain.receivePending(
      [
        [await addressOf(WALLET_A, 0), { nanoErgs: 3_000_000_000n }],
        [RECIPIENT_ADDRESS, { nanoErgs: 1_000_000_000n }]
      ],
      [spent]
    );

    const card = page.locator(`[data-tx-id="${tx.transactionId}"]`);
    await expect(card.getByText("0.5", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Cancel" }).click();
    const drawer = page.getByRole("dialog").filter({ hasText: "Transaction review" });
    await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
    await drawer.getByRole("button", { name: "Sign" }).click();
    await expect(popup.toast("Transaction sent")).toBeVisible();

    const [cancel] = chain.submitted;
    const inputs = cancel.inputs.map((i) => i.boxId);
    expect(inputs).toContain(spent.boxId);
    expect(inputs).not.toContain(tx.inputs[0].box.boxId);
  });

  test("reads again a history whose refresh failed", async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    const page = popup.page;
    await popup.navigate("history");
    const cards = page.locator("[data-tx-id]");
    await expect(cards).toHaveCount(2);

    // both histories are read to their end, so only reading the first page again recovers
    chain.historyError = "internal_error";
    const tx = chain.receivePending([[await addressOf(WALLET_A, 0), { nanoErgs: 1_000_000_000n }]]);
    await expect(page.getByText("Some transactions couldn't be loaded.")).toBeVisible();

    chain.historyError = undefined;
    await page.locator("#history-retry").click();
    await expect(page.locator(`[data-tx-id="${tx.transactionId}"]`)).toBeVisible();
    await expect(page.getByText("Some transactions couldn't be loaded.")).toBeHidden();
    await expect(cards).toHaveCount(3);
  });
});
