import { expect, test } from "../fixtures/test";

test.describe("mnemonic word input", () => {
  test.beforeEach(async ({ popup }) => {
    await popup.goto("/add/import");
    await popup.fillWalletInfo("Tab", "1234567890");
    await popup.page.getByRole("button", { name: "Insert a recovery phrase" }).click();
  });

  test("tab selects the first suggestion and moves to the next word", async ({ popup }) => {
    const inputs = popup.page.locator("form .grid > div input");
    await inputs.nth(0).click();
    await inputs.nth(0).pressSequentially("acti");
    await expect(popup.page.getByRole("option").first()).toBeVisible();
    await inputs.nth(0).press("Tab");

    await expect(inputs.nth(0)).toHaveValue("action");
    await expect(inputs.nth(1)).toBeFocused();
  });

  test("tab selects the item highlighted with arrow keys", async ({ popup }) => {
    const inputs = popup.page.locator("form .grid > div input");
    await inputs.nth(0).click();
    await inputs.nth(0).pressSequentially("act");
    await expect(popup.page.getByRole("option", { name: "act", exact: true })).toBeVisible();
    await inputs.nth(0).press("ArrowDown");
    await expect(popup.page.locator("[role=option][data-highlighted]")).toHaveText("action");
    await inputs.nth(0).press("Tab");

    await expect(inputs.nth(0)).toHaveValue("action");
    await expect(inputs.nth(1)).toBeFocused();
  });

  test("tab selects an item highlighted with arrow keys without typing", async ({ popup }) => {
    const inputs = popup.page.locator("form .grid > div input");
    await inputs.nth(0).click();
    await inputs.nth(0).press("ArrowDown");
    await inputs.nth(0).press("ArrowDown");
    await inputs.nth(0).press("ArrowDown");
    const highlighted = popup.page.locator("[role=option][data-highlighted]");
    await expect(highlighted).toBeVisible();
    const expected = (await highlighted.textContent())!.trim();
    await inputs.nth(0).press("Tab");

    await expect(inputs.nth(0)).toHaveValue(expected);
    await expect(inputs.nth(1)).toBeFocused();
  });

  test("tabbing through a filled word keeps it", async ({ popup }) => {
    const inputs = popup.page.locator("form .grid > div input");
    await inputs.nth(0).click();
    await inputs.nth(0).pressSequentially("acti");
    await inputs.nth(0).press("Tab");
    await expect(inputs.nth(1)).toBeFocused();

    await inputs.nth(1).press("Shift+Tab");
    await expect(inputs.nth(0)).toBeFocused();
    await inputs.nth(0).press("Tab");

    await expect(inputs.nth(0)).toHaveValue("action");
    await expect(inputs.nth(1)).toBeFocused();
  });
});
