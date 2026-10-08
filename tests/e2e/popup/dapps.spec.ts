import { SIGMA_USD_PARAMETERS } from "@fleet-sdk/ageusd-plugin";
import { ErgoAddress } from "@fleet-sdk/core";
import { addSigmaUsdBoxes, expect, fundWallet, test } from "../fixtures/test";
import { addressOf, WALLET_A } from "../fixtures/wallets";

test.describe("dApps", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("dapps");
  });

  test("lists the built-in dApps", async ({ popup }) => {
    await expect(popup.page.getByRole("button", { name: "SigmaUSD Protocol" })).toBeVisible();
    await expect(popup.page.getByRole("button", { name: "Wallet Optimizer" })).toBeVisible();
  });

  test.describe("wallet optimizer", () => {
    test("shows wallet health metrics", async ({ popup }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Wallet Optimizer" }).click();
      await expect(page).toHaveURL(/#\/dapps\/wallet-optimization$/);

      await expect(page.getByText("UTxO count")).toBeVisible();
      await expect(page.getByText("Oldest UTxO")).toBeVisible();
      await expect(page.getByText("Wallet size")).toBeVisible();
      await expect(page.getByText("Healthy", { exact: true })).toBeVisible();
    });

    test("consolidates UTxOs into a single box", async ({ popup, chain }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Wallet Optimizer" }).click();
      await page.getByRole("button", { name: "Optimize" }).click();

      const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
      await expect(drawer.getByText("Sending to your address").first()).toBeVisible();
      await drawer.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await drawer.getByRole("button", { name: "Sign" }).click();
      await expect(popup.toast("Transaction sent!")).toBeVisible();

      const [tx] = chain.submitted;
      const ownTree = ErgoAddress.decode(await addressOf(WALLET_A, 0)).ergoTree;
      expect(tx.inputs).toHaveLength(2);
      // a single change box holding every asset, plus the fee box
      expect(tx.outputs).toHaveLength(2);
      const own = tx.outputs.filter((o) => o.ergoTree === ownTree);
      expect(own).toHaveLength(1);
      expect(own[0].assets).toHaveLength(2);
    });
  });

  test.describe("SigmaUSD", () => {
    test.beforeEach(({ chain }) => {
      addSigmaUsdBoxes(chain);
    });

    test("shows bank reserves and the oracle rate", async ({ popup }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "SigmaUSD Protocol" }).click();
      await expect(page).toHaveURL(/#\/dapps\/sigmausd-protocol$/);

      await expect(page.getByText("Bank reserves")).toBeVisible();
      await expect(page.getByText("Current rate")).toBeVisible();
      await expect(page.getByText(/^\d+%$/)).toBeVisible();
    });

    test("mints SigRSV", async ({ popup, chain }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "SigmaUSD Protocol" }).click();
      await expect(page.getByText(/^\d+%$/)).toBeVisible();

      await page.getByRole("button", { name: "Select" }).click();
      await page.getByRole("option", { name: /SigRSV/ }).click();
      // the asset popover traps focus until its exit animation finishes
      await expect(page.getByRole("option")).toHaveCount(0);

      const [ergAmount, rsvAmount] = await page.getByPlaceholder("0").all();
      await ergAmount.fill("1");
      await expect(rsvAmount).not.toHaveValue("");

      const swap = page.getByRole("button", { name: "Swap" });
      await expect(swap).toBeEnabled();
      await swap.click();

      const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
      await expect(drawer.getByText("Sending to contract").first()).toBeVisible();
      await drawer.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await drawer.getByRole("button", { name: "Sign" }).click();
      await expect(popup.toast("Transaction sent!")).toBeVisible();

      const [tx] = chain.submitted;
      const ownTree = ErgoAddress.decode(await addressOf(WALLET_A, 0)).ergoTree;
      // the bank box is spent and recreated
      expect(tx.outputs[0].ergoTree).toBe(SIGMA_USD_PARAMETERS.contract);
      // and the minted reserve coins are sent to the wallet
      const received = tx.outputs.find(
        (o) =>
          o.ergoTree === ownTree &&
          o.assets.some((a) => a.tokenId === SIGMA_USD_PARAMETERS.tokens.reserveCoinId)
      );
      expect(received).toBeDefined();
    });

    test("blocks SigUSD minting when reserves are too low", async ({ popup, chain }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "SigmaUSD Protocol" }).click();
      await expect(page.getByText(/^\d+%$/)).toBeVisible();

      // the reserve ratio of the snapshotted bank is below the 400% needed to mint SigUSD
      await page.getByRole("button", { name: "Select" }).click();
      await expect(page.getByRole("option", { name: /SigUSD/ })).toHaveAttribute("data-disabled");
      await expect(page.getByRole("option", { name: /SigRSV/ })).not.toHaveAttribute(
        "data-disabled"
      );

      // the open popover hides the rest of the page from the accessibility tree
      await expect(page.locator("button", { hasText: "Swap" })).toBeDisabled();
      expect(chain.submitted).toHaveLength(0);
    });
  });
});
