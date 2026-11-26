import { expect, fundWallet, test } from "../fixtures/test";
import { WALLET_A } from "../fixtures/wallets";

const SHOTS = process.env.RELAY_STATUS_SHOTS;

test.describe("relay status", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
  });

  test("shows no badge while the relay is live", async ({ popup }) => {
    await popup.navigate("send");
    await expect(popup.page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
    await expect(popup.page.locator("[data-relay-status]")).toHaveCount(0);
    if (SHOTS) await popup.page.screenshot({ path: `${SHOTS}/live.png` });
  });

  test("shows a reconnecting badge and holds txs while the socket is down", async ({
    popup,
    chain
  }) => {
    const page = popup.page;
    await popup.navigate("send");
    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeEnabled();

    chain.setSocketsDown(true);
    const badge = page.locator("[data-relay-status]").first();
    await expect(badge).toHaveAttribute("data-health", "reconnecting");
    await expect(badge.locator("[data-relay-ripple]")).toBeVisible();
    await expect(send).toBeDisabled();
    await expect(send.locator("[data-boxes-status]")).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reconnecting.png` });

    await page.getByRole("combobox").first().click();
    await expect(page.locator("[data-relay-message]")).toContainText("Reconnecting to the relay");
    if (SHOTS)
      await page.screenshot({ path: `${SHOTS}/reconnecting-menu.png`, animations: "disabled" });
    await page.mouse.click(5, 450);
    await expect(page.locator("[data-relay-message]")).toHaveCount(0);

    chain.setSocketsDown(false);
    await expect(badge).toHaveAttribute("data-health", "connected", { timeout: 15_000 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/connected.png` });
    await expect(send).toBeEnabled();
    await expect(page.locator("[data-relay-status]")).toHaveCount(0);
  });

  test("shows a still waiting badge when the relay asks to try later", async ({ popup, chain }) => {
    const page = popup.page;
    chain.boxesError = "capacity_exceeded";
    chain.boxesRetryAfter = 30;
    await popup.navigate("send");

    const badge = page.locator("[data-relay-status]").first();
    await expect(badge).toHaveAttribute("data-health", "waiting");
    await expect(badge.locator("[data-relay-ripple]")).toHaveCount(0);
    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeDisabled();
    await expect(send.locator("[data-boxes-status]")).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/waiting.png`, animations: "disabled" });

    await page.getByRole("combobox").first().click();
    await expect(page.locator("[data-relay-message]")).toContainText("try again later");
  });

  test("shows an error badge when the relay refuses the wallet's boxes", async ({
    popup,
    chain
  }) => {
    const page = popup.page;
    chain.boxesError = "too_many_boxes";
    await popup.navigate("send");

    const badge = page.locator("[data-relay-status]").first();
    await expect(badge).toHaveAttribute("data-health", "error");
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/error.png` });

    await page.getByRole("combobox").first().click();
    await expect(page.locator("[data-relay-message]")).toContainText("too many boxes");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/error-menu.png`, animations: "disabled" });

    await page.locator("[data-relay-link]").click();
    await expect(page).toHaveURL(/#\/dapps\/wallet-optimization$/);
    await expect(page.locator("[data-relay-message]")).toHaveCount(0);
  });

  test("wallet optimizer reads the boxes over REST when the relay refuses them", async ({
    popup,
    chain
  }) => {
    const page = popup.page;
    chain.boxesError = "too_many_boxes";
    await popup.navigate("dapps");
    await page.getByRole("button", { name: "Wallet Optimizer" }).click();

    await expect(page.getByRole("button", { name: "Optimize", exact: true })).toBeEnabled();
    await expect(page.getByText("Healthy", { exact: true })).toBeVisible();
  });
});

test("shows an error badge when the relay runs an older version than Nautilus needs", async ({
  popup,
  chain
}) => {
  const page = popup.page;
  chain.relayVersion = "0.2.9";
  await fundWallet(chain, WALLET_A);
  await popup.importWallet(WALLET_A);

  const badge = page.locator("[data-relay-status]").first();
  await expect(badge).toHaveAttribute("data-health", "error");

  await page.getByRole("combobox").first().click();
  const message = page.locator("[data-relay-message]");
  await expect(message).toContainText("runs version 0.2.9");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/outdated-menu.png`, animations: "disabled" });

  await message.locator("[data-relay-link]").click();
  await expect(page).toHaveURL(/#\/settings$/);
});

test("shows no badge for a relay that runs a supported version", async ({ popup, chain }) => {
  await fundWallet(chain, WALLET_A);
  await popup.importWallet(WALLET_A);
  await expect(popup.page.getByText("Wallet balance")).toBeVisible();
  await expect(popup.page.locator("[data-relay-status]")).toHaveCount(0);
});
