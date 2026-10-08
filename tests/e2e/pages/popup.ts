import { expect, type Locator, type Page } from "@playwright/test";
import type { TestWallet } from "../fixtures/wallets";
import { toast } from "./common";

export type NavItem = "assets" | "history" | "receive" | "send" | "dapps";

const NAV_PATHS: Record<NavItem, string> = {
  assets: "#/",
  history: "#/history",
  receive: "#/receive",
  send: "#/send",
  dapps: "#/dapps"
};

/**
 * Page object for the extension popup (`src/extension/popup/index.html`).
 */
export class Popup {
  constructor(
    readonly page: Page,
    readonly extensionId: string
  ) {}

  get baseUrl() {
    return `chrome-extension://${this.extensionId}/src/extension/popup/index.html`;
  }

  /**
   * Opens a popup route. Wallet onboarding routes get `redirect=false` so the app doesn't
   * bounce back to the add wallet index when there are no wallets yet.
   */
  async goto(route = "/") {
    const query = route.startsWith("/add/") ? "?redirect=false" : "";
    await this.page.goto(`${this.baseUrl}#${route}${query}`);
  }

  /** Wallet switcher trigger in the header. */
  get walletSwitcher(): Locator {
    return this.page.locator("[role=combobox][aria-expanded]").first();
  }

  navLink(item: NavItem): Locator {
    return this.page.locator(`nav a[href="${NAV_PATHS[item]}"]`);
  }

  async navigate(item: NavItem) {
    await this.navLink(item).click();
    await expect(this.page).toHaveURL(new RegExp(`${escape(NAV_PATHS[item])}$`));
  }

  /** Opens the wallet switcher popover and selects a menu entry. */
  async menu(entry: "New wallet" | "Settings" | "About") {
    await this.walletSwitcher.click();
    await this.page.getByRole("option", { name: entry }).click();
  }

  async switchWallet(name: string) {
    await this.walletSwitcher.click();
    await this.page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
    await expect(this.walletSwitcher).toContainText(name);
  }

  /** Waits for the assets screen of the given wallet to be loaded and synced. */
  async expectWalletLoaded(name: string) {
    await expect(this.page).toHaveURL(/#\/$/);
    await expect(this.walletSwitcher).toContainText(name);
  }

  /** Fills the first step (wallet information) of the create/import flows. */
  async fillWalletInfo(name: string, password?: string, confirm = password) {
    await this.page.locator("#wallet-name").fill(name);
    if (password !== undefined) await this.page.locator("#password").fill(password);
    if (confirm !== undefined) await this.page.locator("#confirm-password").fill(confirm);
  }

  /** Dispatches a clipboard paste event over the current form. */
  async paste(text: string) {
    await this.page
      .locator("form")
      .first()
      .evaluate((form, text) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text", text);
        form.dispatchEvent(
          new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true })
        );
      }, text);
  }

  async importWallet(wallet: TestWallet) {
    await this.goto("/add/import");
    await this.fillWalletInfo(wallet.name, wallet.password);
    await this.page.getByRole("button", { name: "Insert a recovery phrase" }).click();
    await this.paste(wallet.mnemonic);
    await this.page.getByRole("button", { name: "Import", exact: true }).click();
    await this.expectWalletLoaded(wallet.name);
  }

  async importReadOnlyWallet(name: string, xpub: string) {
    await this.goto("/add/import");
    await this.fillWalletInfo(name);
    await this.selectWalletType("Read-only");
    await this.page.getByRole("button", { name: "Insert a public key" }).click();
    await this.page.locator("#xpk").fill(xpub);
    await this.page.getByRole("button", { name: "Import", exact: true }).click();
    await this.expectWalletLoaded(name);
  }

  async selectWalletType(type: "Standard" | "Read-only") {
    await this.page.locator("#wallet-type").click();
    await this.page.getByRole("option", { name: type }).click();
  }

  /** Reads the words rendered by the non-editable mnemonic grid. */
  async readMnemonic(): Promise<string[]> {
    const cells = this.page.locator("form .grid > div");
    await expect(cells.first()).toBeVisible();
    return cells.evaluateAll((els) =>
      els.map((el) => el.querySelectorAll("span")[1]?.textContent?.trim() ?? "")
    );
  }

  /** Fills editable cells of a mnemonic grid using its word combobox inputs. */
  async fillMnemonicGaps(words: string[]) {
    const cells = this.page.locator("form .grid > div");
    const count = await cells.count();
    for (let i = 0; i < count; i++) {
      const input = cells.nth(i).locator("input");
      if ((await input.count()) === 0) continue;

      await input.click();
      await input.pressSequentially(words[i]);
      await expect(this.page.getByRole("option", { name: words[i], exact: true })).toBeVisible();
      await input.press("Enter");
      // the suggestions list traps focus until its exit animation finishes
      await expect(this.page.getByRole("option")).toHaveCount(0);
      await expect(input).toHaveValue(words[i]);
    }
  }

  /** Spending password input of the transaction signing form. */
  get passwordInput(): Locator {
    return this.page.getByRole("textbox", { name: "Spending password" });
  }

  toast(title: string | RegExp): Locator {
    return toast(this.page, title);
  }
}

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
