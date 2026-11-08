import type { Page } from "@playwright/test";
import { expect, fundWallet, test } from "../fixtures/test";
import { buildTransaction } from "../fixtures/transactions";
import { WALLET_A, WALLET_B } from "../fixtures/wallets";
import { clickToClose, connectDapp, requestSignature } from "../pages/connector";
import type { Popup } from "../pages/popup";

const masterPassword = WALLET_A.password;

async function setStayUnlocked(popup: Popup, on: boolean) {
  await popup.setUnlockTimeout(on ? "Until the browser restarts" : "Off");
}

async function signWithPassword(win: Page, password: string) {
  await win.getByRole("textbox", { name: "Master password" }).fill(password);
  await clickToClose(win.getByRole("button", { name: "Sign" }));
}

test.describe("unlock session", () => {
  test.beforeEach(async ({ chain, popup, context, dapp }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A, { master: true });
    await connectDapp(context, dapp, WALLET_A.name);
  });

  test("signs without the master password once it was typed, by default", async ({
    context,
    dapp,
    chain
  }) => {
    const first = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await signWithPassword(first.win, masterPassword);
    expect((await first.result).ok).toBe(true);

    const second = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await expect(second.win.getByRole("textbox", { name: "Master password" })).toHaveCount(0);
    await clickToClose(second.win.getByRole("button", { name: "Sign" }));
    expect((await second.result).ok).toBe(true);
  });

  test("takes no click on Sign until the window has been in front for a second", async ({
    context,
    dapp,
    chain
  }) => {
    const first = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await signWithPassword(first.win, masterPassword);
    expect((await first.result).ok).toBe(true);

    const { win, result } = await requestSignature(
      context,
      dapp,
      await buildTransaction(chain, WALLET_A)
    );
    const sign = win.getByRole("button", { name: "Sign" });
    await expect(sign).toBeEnabled();

    await win.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(sign).toBeDisabled();

    const disabledOnFocus = await sign.evaluate(async (button: HTMLButtonElement) => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((resolve) => setTimeout(resolve));
      return button.disabled;
    });
    expect(disabledOnFocus).toBe(true);

    await expect(sign).toBeEnabled();
    await clickToClose(sign);
    expect((await result).ok).toBe(true);
  });

  test("keeps asking while turned off", async ({ context, dapp, chain, popup }) => {
    await setStayUnlocked(popup, false);
    const first = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await signWithPassword(first.win, masterPassword);
    expect((await first.result).ok).toBe(true);

    const second = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await expect(second.win.getByRole("textbox", { name: "Master password" })).toBeVisible();
    await signWithPassword(second.win, masterPassword);
    expect((await second.result).ok).toBe(true);
  });

  test("locks again when turned off or the master password changes", async ({
    context,
    dapp,
    chain,
    popup
  }) => {
    const page = popup.page;
    await setStayUnlocked(popup, true);
    const unlock = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await signWithPassword(unlock.win, masterPassword);
    await unlock.result;

    await setStayUnlocked(popup, false);
    const afterOff = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await expect(afterOff.win.getByRole("textbox", { name: "Master password" })).toBeVisible();
    await signWithPassword(afterOff.win, masterPassword);
    await afterOff.result;

    await setStayUnlocked(popup, true);
    const relock = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await signWithPassword(relock.win, masterPassword);
    await relock.result;

    const newMaster = "new master password 456";
    const card = page.locator("[data-master-password-settings]");
    const drawer = page.getByRole("dialog");
    await popup.goto("/settings");
    await card.getByRole("button", { name: "Change", exact: true }).click();
    await drawer.locator("#current-password").fill(masterPassword);
    await drawer.locator("#new-password").fill(newMaster);
    await drawer.locator("#confirm-new-password").fill(newMaster);
    await drawer.getByRole("button", { name: "Confirm" }).click();
    await expect(popup.toast("Master password changed")).toBeVisible();

    const afterChange = await requestSignature(
      context,
      dapp,
      await buildTransaction(chain, WALLET_A)
    );
    await expect(afterChange.win.getByRole("textbox", { name: "Master password" })).toBeVisible();
    await signWithPassword(afterChange.win, newMaster);
    expect((await afterChange.result).ok).toBe(true);
  });

  test("offers the timeouts and keeps the chosen one", async ({ popup }) => {
    const page = popup.page;
    const select = page.locator("#unlock-session");
    await popup.goto("/settings");
    await expect(select).toHaveText("Until the browser restarts");

    await select.click();
    await expect(page.getByRole("option")).toHaveText([
      "Off",
      "5 minutes",
      "15 minutes",
      "30 minutes",
      "1 hour",
      "4 hours",
      "Until the system locks",
      "Until the browser restarts"
    ]);
    await page.getByRole("option", { name: "15 minutes" }).click();
    await expect(select).toHaveText("15 minutes");

    await page.reload();
    await popup.goto("/settings");
    await expect(select).toHaveText("15 minutes");
  });

  test("locks once idle for longer than the timeout, counted from the last signature", async ({
    context,
    dapp,
    chain,
    popup
  }) => {
    const minutes = (n: number) => n * 60 * 1000;
    let now = Date.now();
    await context.clock.install({ time: now });
    const advance = (ms: number) => context.clock.setSystemTime((now += ms));
    const passwordField = (win: Page) => win.getByRole("textbox", { name: "Master password" });

    await popup.setUnlockTimeout("5 minutes");

    const unlock = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await signWithPassword(unlock.win, masterPassword);
    expect((await unlock.result).ok).toBe(true);

    for (const step of [4, 4]) {
      await advance(minutes(step));
      const req = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
      await expect(req.win.getByRole("button", { name: "Sign" })).toBeVisible();
      await expect(passwordField(req.win)).toHaveCount(0);
      await clickToClose(req.win.getByRole("button", { name: "Sign" }));
      expect((await req.result).ok).toBe(true);
    }

    await advance(minutes(6));
    const expired = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await expect(passwordField(expired.win)).toBeVisible();
    await signWithPassword(expired.win, masterPassword);
    expect((await expired.result).ok).toBe(true);
  });

  test("is locked and unlocked from the wallet switcher", async ({
    context,
    dapp,
    chain,
    popup
  }) => {
    const page = popup.page;
    const button = page.locator("[data-unlock-session]");

    await popup.goto("/");
    await expect(button).toHaveCount(0);
    await popup.walletSwitcher.click();
    await expect(button).toHaveAccessibleName("Unlock");
    await button.click();
    const drawer = page.getByRole("dialog", { name: "Unlock Nautilus" });
    const required = drawer.getByText("Master password is required.");
    await expect(drawer.locator("#unlock-password")).toBeFocused();
    await expect(required).toHaveCount(0);
    await drawer.getByRole("button", { name: "Unlock" }).click();
    await expect(required).toBeVisible();
    await drawer.locator("#unlock-password").fill("wrong password");
    await expect(required).toHaveCount(0);
    await drawer.getByRole("button", { name: "Unlock" }).click();
    await expect(drawer.getByText("Wrong master password.")).toBeVisible();
    await drawer.locator("#unlock-password").fill(masterPassword);
    await drawer.getByRole("button", { name: "Unlock" }).click();
    await expect(drawer).toBeHidden();
    await popup.walletSwitcher.click();
    await expect(button).toHaveAccessibleName("Lock");
    await button.hover();
    await expect(page.getByRole("tooltip", { name: "Lock" })).toBeVisible();

    const unlocked = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await expect(unlocked.win.getByRole("textbox", { name: "Master password" })).toHaveCount(0);
    await clickToClose(unlocked.win.getByRole("button", { name: "Sign" }));
    expect((await unlocked.result).ok).toBe(true);

    await button.click();
    await expect(button).toHaveAccessibleName("Unlock");
    const locked = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await expect(locked.win.getByRole("textbox", { name: "Master password" })).toBeVisible();
    await signWithPassword(locked.win, masterPassword);
    expect((await locked.result).ok).toBe(true);

    await setStayUnlocked(popup, false);
    await popup.goto("/");
    await popup.walletSwitcher.click();
    await expect(page.getByRole("option", { name: WALLET_A.name })).toBeVisible();
    await expect(button).toHaveCount(0);
  });

  test("is unlocked and locked from a request window", async ({ context, dapp, chain }) => {
    const { win, result } = await requestSignature(
      context,
      dapp,
      await buildTransaction(chain, WALLET_A)
    );
    const button = win.locator("[data-unlock-session]");
    const passwordField = win.getByRole("textbox", { name: "Master password" });

    await expect(button).toHaveAccessibleName("Unlock");
    await expect(passwordField).toBeVisible();
    await button.click();
    const drawer = win.getByRole("dialog");
    await drawer.locator("#unlock-password").fill(masterPassword);
    await drawer.getByRole("button", { name: "Unlock" }).click();
    await expect(drawer).toBeHidden();
    await expect(button).toHaveAccessibleName("Lock");
    await expect(passwordField).toHaveCount(0);

    await button.click();
    await expect(button).toHaveAccessibleName("Unlock");
    await expect(passwordField).toBeVisible();

    await signWithPassword(win, masterPassword);
    expect((await result).ok).toBe(true);
  });

  test("is shown on wallets with their own password too", async ({ popup }) => {
    await popup.importWallet(WALLET_B);
    await popup.switchWallet(WALLET_B.name);
    await popup.walletSwitcher.click();
    await expect(popup.page.locator("[data-unlock-session]")).toBeVisible();
  });

  test("adds a wallet without typing the master password", async ({
    context,
    dapp,
    chain,
    popup
  }) => {
    await setStayUnlocked(popup, true);
    const unlock = await requestSignature(context, dapp, await buildTransaction(chain, WALLET_A));
    await signWithPassword(unlock.win, masterPassword);
    await unlock.result;

    const page = popup.page;
    await popup.goto("/add/import");
    await page.locator("#wallet-name").fill(WALLET_B.name);
    await popup.setUseMasterPassword(true);
    await expect(page.locator("#password")).toHaveCount(0);
    await page.getByRole("button", { name: "Insert a recovery phrase" }).click();
    await expect(page.getByRole("heading", { name: "Wallet secret" })).toBeVisible();
    await popup.paste(WALLET_B.mnemonic);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await popup.expectWalletLoaded(WALLET_B.name);
  });
});
