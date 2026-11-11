import { SIGMA_USD_PARAMETERS } from "@fleet-sdk/ageusd-plugin";
import { utf8 } from "@fleet-sdk/crypto";
import { ErgoAddress } from "@fleet-sdk/core";
import { SByte, SColl } from "@fleet-sdk/serializer";
import { addBabelBox, addSigmaUsdBoxes, expect, fundWallet, test } from "../fixtures/test";
import { addressOf, TEST_NFT, TEST_TOKEN, WALLET_A } from "../fixtures/wallets";

test.describe("dApps", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("dapps");
  });

  test("lists the built-in dApps", async ({ popup }) => {
    await expect(popup.page.getByRole("button", { name: "SigmaUSD Protocol" })).toBeVisible();
    await expect(popup.page.getByRole("button", { name: "Wallet Optimizer" })).toBeVisible();
    await expect(popup.page.getByRole("button", { name: "Native Tokens" })).toBeVisible();
  });

  test.describe("native tokens", () => {
    test("mints an EIP-4 token to the wallet", async ({ popup, chain }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Native Tokens" }).click();
      await expect(page).toHaveURL(/#\/dapps\/native-tokens\/mint$/);

      await page.getByLabel("Name").fill("Test Token");
      await page.getByLabel("Description").fill("A token minted by e2e tests");
      await page.getByLabel("Emission amount").fill("1000.5");
      await page.getByLabel("Decimals").fill("2");
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
      // incoming assets show the decoded EIP-4 data instead of the bare token ID
      const incoming = drawer
        .locator("[data-slot=card]")
        .filter({ hasText: "Total assets entering your wallet" });
      await expect(incoming.getByText("Test Token")).toBeVisible();
      await expect(incoming.getByText("1,000.5", { exact: true })).toBeVisible();

      await incoming.getByRole("button", { name: "Show new token details" }).click();
      const info = page.getByRole("dialog").filter({ hasText: "Emission amount" });
      await expect(info.getByText("Test Token")).toBeVisible();
      await expect(info.getByText("A token minted by e2e tests")).toBeVisible();
      await expect(info.getByText("This token will be minted in this transaction.")).toBeVisible();
      await expect(info.getByText("1,000.5", { exact: true })).toBeVisible();
      await expect(info.getByText("Decimals")).toBeVisible();
      await info.getByRole("button", { name: "Close", exact: true }).first().click();
      await expect(info).toBeHidden();

      await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
      await drawer.getByRole("button", { name: "Sign" }).click();
      await expect(popup.toast("Transaction sent!")).toBeVisible();

      const [tx] = chain.submitted;
      const ownTree = ErgoAddress.decode(await addressOf(WALLET_A, 0)).ergoTree;
      const tokenId = tx.inputs[0].boxId;
      const minting = tx.outputs.find((o) => o.assets.some((a) => a.tokenId === tokenId));

      expect(minting).toBeDefined();
      expect(minting!.ergoTree).toBe(ownTree);
      expect(minting!.value.toString()).toBe("1000000");
      expect(minting!.assets.find((a) => a.tokenId === tokenId)?.amount.toString()).toBe("100050");
      expect(minting!.additionalRegisters.R4).toBe(SColl(SByte, utf8.decode("Test Token")).toHex());
      expect(minting!.additionalRegisters.R5).toBe(
        SColl(SByte, utf8.decode("A token minted by e2e tests")).toHex()
      );
      expect(minting!.additionalRegisters.R6).toBe(SColl(SByte, utf8.decode("2")).toHex());
    });

    test("rejects invalid token parameters", async ({ popup, chain }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Native Tokens" }).click();

      await page.getByLabel("Name").fill("   ");
      await page.getByLabel("Emission amount").fill("1.555");
      await page.getByLabel("Decimals").fill("2");
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      await expect(page.getByText("Enter a token name")).toBeVisible();
      await expect(page.getByText("Amount can't have more than 2 decimal places")).toBeVisible();

      await page.getByLabel("Emission amount").fill("100000000000000000");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText(/Amount must be .* or less/)).toBeVisible();

      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(chain.submitted).toHaveLength(0);
    });

    test("only accepts numbers as amount and decimals", async ({ popup }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Native Tokens" }).click();

      const amount = page.getByLabel("Emission amount");
      await amount.pressSequentially("1a2b-3.c4");
      await expect(amount).toHaveValue("123.4");

      const decimals = page.getByLabel("Decimals");
      await expect(decimals).toHaveValue("");
      await expect(decimals).toHaveAttribute("placeholder", "0");
      await decimals.pressSequentially("-1.5e");
      await expect(decimals).toHaveValue("15");
    });

    test("brings validation errors into view", async ({ popup }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Native Tokens" }).click();

      await page.getByLabel("Name").fill("Test Token");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Enter an emission amount")).toBeInViewport();
    });
  });

  test.describe("native tokens burning", () => {
    test.beforeEach(async ({ popup }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Native Tokens" }).click();
      await page.getByRole("tab", { name: "Burn" }).click();
      await expect(page).toHaveURL(/#\/dapps\/native-tokens\/burn$/);
    });

    test("burns part of a token balance", async ({ popup, chain }) => {
      const page = popup.page;
      await page.getByRole("combobox").filter({ hasText: "Add asset" }).click();
      await expect(page.getByRole("option", { name: /ERG/ })).toHaveCount(0);
      await page.getByRole("option", { name: /TestToken/ }).click();
      await page.getByPlaceholder("0").fill("12.34");
      await page.getByRole("button", { name: "Burn", exact: true }).click();

      const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
      const password = drawer.getByRole("textbox", { name: / password$/ });
      await expect(drawer.getByText("Burning")).toBeVisible();
      // signing is blocked until the user agrees to burn the tokens
      await expect(password).toBeDisabled();
      await drawer.getByLabel("Burn tokens permanently").click();
      await password.fill(WALLET_A.password);
      await drawer.getByRole("button", { name: "Sign" }).click();
      await expect(popup.toast("Transaction sent!")).toBeVisible();

      const [tx] = chain.submitted;
      // signed inputs only carry box ids, so resolve them against the wallet boxes
      const owned = [
        ...chain.boxesOf(await addressOf(WALLET_A, 0)),
        ...chain.boxesOf(await addressOf(WALLET_A, 1))
      ];
      const inputs = tx.inputs.map((input) => owned.find((box) => box.boxId === input.boxId)!);
      const total = (
        boxes: { assets: { tokenId: string; amount: string | bigint }[] }[],
        id: string
      ) =>
        boxes
          .flatMap((box) => box.assets)
          .filter((asset) => asset.tokenId === id)
          .reduce((acc, asset) => acc + BigInt(asset.amount), 0n);

      expect(total(inputs, TEST_TOKEN.tokenId) - total(tx.outputs, TEST_TOKEN.tokenId)).toBe(1234n);
      // no other token is burned
      expect(total(tx.outputs, TEST_NFT.tokenId)).toBe(total(inputs, TEST_NFT.tokenId));
    });

    test("requires a token to be selected", async ({ popup, chain }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "Burn", exact: true }).click();

      await expect(page.getByText("Select at least one token to burn")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(chain.submitted).toHaveLength(0);
    });

    test("disables blacklist actions when no flagged token is held", async ({ popup }) => {
      const page = popup.page;
      await page.getByRole("combobox").filter({ hasText: "Add asset" }).click();
      await expect(page.getByRole("option", { name: /TestToken/ })).toBeVisible();
      for (const name of [/Add all scam tokens/, /Add all NSFW tokens/]) {
        await expect(page.getByRole("option", { name })).toHaveAttribute("data-disabled");
      }
      await expect(page.getByText("You don't hold any blacklisted scam tokens.")).toBeVisible();
    });

    test.describe("with blacklisted tokens", () => {
      test.use({
        serviceOptions: { blacklist: { nsfw: [TEST_NFT.tokenId], scam: [TEST_TOKEN.tokenId] } }
      });

      test("burns every held scam token", async ({ popup, chain }) => {
        const page = popup.page;
        const picker = page.getByRole("combobox").filter({ hasText: "Add asset" });
        await picker.click();
        await expect(page.getByRole("option", { name: /Add all NSFW tokens/ })).toBeVisible();
        await page.getByRole("option", { name: /Add all scam tokens/ }).click();
        // the full balance is set, even though the token is hidden from the wallet
        await expect(page.getByPlaceholder("0")).toHaveValue("1,000");

        // queued tokens are no longer offered
        await picker.click();
        await expect(page.getByRole("option", { name: /Add all scam tokens/ })).toHaveAttribute(
          "data-disabled"
        );
        await expect(page.getByRole("option", { name: /Add all NSFW tokens/ })).not.toHaveAttribute(
          "data-disabled"
        );
        // dismisses the picker by clicking outside of it
        await page.mouse.click(5, 5);
        await expect(page.getByRole("option")).toHaveCount(0);

        await page.getByRole("button", { name: "Burn", exact: true }).click();
        const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
        await drawer.getByLabel("Burn tokens permanently").click();
        await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
        await drawer.getByRole("button", { name: "Sign" }).click();
        await expect(popup.toast("Transaction sent!")).toBeVisible();

        const [tx] = chain.submitted;
        const outputTokens = tx.outputs.flatMap((o) => o.assets.map((a) => a.tokenId));
        expect(outputTokens).not.toContain(TEST_TOKEN.tokenId);
        expect(outputTokens).toContain(TEST_NFT.tokenId);
      });
    });
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
      await page.getByRole("button", { name: "Optimize", exact: true }).click();

      const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
      await expect(drawer.getByText("Sending to your address").first()).toBeVisible();
      await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
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
      await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
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

    test("shows one error for the last edited amount", async ({ popup }) => {
      const page = popup.page;
      await page.getByRole("button", { name: "SigmaUSD Protocol" }).click();
      await expect(page.getByText(/^\d+%$/)).toBeVisible();

      await page.getByRole("button", { name: "Select" }).click();
      await page.getByRole("option", { name: /SigRSV/ }).click();
      await expect(page.getByRole("option")).toHaveCount(0);

      const error = page.locator("#sigmausd-error");
      const [ergAmount, rsvAmount] = await page.getByPlaceholder("0").all();

      await ergAmount.fill("999999999");
      await expect(error).toHaveText(/Amount must be .* ERG or less$/);
      await expect(ergAmount).toHaveAttribute("aria-invalid", "true");
      await expect(ergAmount).toHaveAttribute("aria-describedby", "sigmausd-error");
      await expect(rsvAmount).not.toHaveAttribute("aria-invalid");

      await rsvAmount.fill("99999999999999");
      await expect(error).toHaveText(/Bank reserves allow up to .* SigRSV$/);
      await expect(rsvAmount).toHaveAttribute("aria-invalid", "true");
      await expect(ergAmount).not.toHaveAttribute("aria-invalid");
      await expect(page.locator("[data-form-error]")).toHaveCount(1);
      await expect(page.locator("button", { hasText: "Swap" })).toBeDisabled();
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

test("a token fee pays for the minting box", async ({ chain, popup }) => {
  chain.addToken(TEST_TOKEN);
  // only the ERG locked in the token box, which the change box takes back
  chain.fund(await addressOf(WALLET_A, 0), {
    nanoErgs: 1_000_000n,
    tokens: [{ tokenId: TEST_TOKEN.tokenId, amount: "100000" }]
  });
  // 1,000 nanoERGs per TestToken unit
  addBabelBox(chain, TEST_TOKEN.tokenId, 1000n);
  await popup.importWallet(WALLET_A);
  await popup.navigate("dapps");

  const page = popup.page;
  await page.getByRole("button", { name: "Native Tokens" }).click();
  await page.getByLabel("Name").fill("Test Token");
  await page.getByLabel("Emission amount").fill("1");

  // the fee asset selector is in the footer, after the page's own ERG button
  await page.getByRole("button", { name: "ERG", exact: true }).last().click();
  await page.getByRole("option", { name: /TestToken/ }).click();
  // the miner fee plus the minting box: 1,100,000 + 1,000,000 nanoERGs
  await expect(page.getByRole("button", { name: /^Adjust fee/ })).toHaveText(/21$/);

  await page.getByRole("button", { name: "Mint", exact: true }).click();
  const drawer = page.getByRole("dialog").filter({ hasText: "Transaction Review" });
  await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
  await drawer.getByRole("button", { name: "Sign" }).click();
  await expect(popup.toast("Transaction sent!")).toBeVisible();

  const [tx] = chain.submitted;
  const tokenId = tx.inputs[0].boxId;
  const minting = tx.outputs.find((o) => o.assets.some((a) => a.tokenId === tokenId));
  expect(minting?.value.toString()).toBe("1000000");

  const ownTree = ErgoAddress.decode(await addressOf(WALLET_A, 0)).ergoTree;
  const change = tx.outputs.find((o) => o !== minting && o.ergoTree === ownTree);
  expect(change?.value.toString()).toBe("1000000");
});
