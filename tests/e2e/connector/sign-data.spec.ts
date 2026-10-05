import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, WALLET_A, WALLET_B, xpubOf } from "../fixtures/wallets";
import { DAPP_HOST } from "../mocks/services";
import { toast } from "../pages/common";
import {
  connectDapp,
  expectRequestFrom,
  expectWindowClosed,
  invoke,
  withConnectorWindow
} from "../pages/connector";

type SignDataArgs = { address: string; message: unknown };

function requestDataSignature(
  context: Parameters<typeof withConnectorWindow>[0],
  dapp: Parameters<typeof invoke>[0],
  args: SignDataArgs
) {
  return withConnectorWindow(context, "sign/data", () =>
    invoke<string, SignDataArgs>(
      dapp,
      ({ address, message }) => window.ergo.sign_data(address, message),
      args
    )
  );
}

test.describe("dApp data signing", () => {
  test.describe("standard wallet", () => {
    test.beforeEach(async ({ chain, popup, context, dapp }) => {
      await fundWallet(chain, WALLET_A);
      await popup.importWallet(WALLET_A);
      await connectDapp(context, dapp, WALLET_A.name);
    });

    test("signs a text message", async ({ context, dapp }) => {
      const address = await addressOf(WALLET_A, 0);
      const { win, result } = await requestDataSignature(context, dapp, {
        address,
        message: "hello nautilus"
      });

      await expectRequestFrom(win, DAPP_HOST);
      await expect(win.getByText("requests to sign a message.")).toBeVisible();
      await expect(win.getByText("Text message")).toBeVisible();
      await expect(win.getByText("hello nautilus")).toBeVisible();

      await win.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await win.getByRole("button", { name: "Sign" }).click();
      await expectWindowClosed(win);

      const outcome = await result;
      expect(outcome).toEqual({ ok: true, value: expect.stringMatching(/^[0-9a-f]{112}$/) });
    });

    test("signs a JSON message", async ({ context, dapp }) => {
      const address = await addressOf(WALLET_A, 1);
      const { win, result } = await requestDataSignature(context, dapp, {
        address,
        message: { action: "vote", proposal: 42 }
      });

      await expect(win.getByText("JSON object")).toBeVisible();
      await expect(win.getByText("proposal")).toBeVisible();

      await win.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await win.getByRole("button", { name: "Sign" }).click();

      expect(await result).toEqual({ ok: true, value: expect.stringMatching(/^[0-9a-f]{112}$/) });
    });

    test("shows an error on a wrong password", async ({ context, dapp }) => {
      const { win, result } = await requestDataSignature(context, dapp, {
        address: await addressOf(WALLET_A, 0),
        message: "hello"
      });

      await win.getByRole("textbox", { name: "Spending password" }).fill("wrong password");
      await win.getByRole("button", { name: "Sign" }).click();
      await expect(toast(win, "Wrong password")).toBeVisible();

      await win.getByRole("button", { name: "Cancel" }).click();
      expect(await result).toEqual({ ok: false, error: { code: -3, info: "User rejected." } });
    });

    test("rejects when the user cancels", async ({ context, dapp }) => {
      const { win, result } = await requestDataSignature(context, dapp, {
        address: await addressOf(WALLET_A, 0),
        message: "hello"
      });

      await win.getByRole("button", { name: "Cancel" }).click();
      await expectWindowClosed(win);

      expect(await result).toEqual({ ok: false, error: { code: -3, info: "User rejected." } });
    });

    test("rejects addresses not owned by the connected wallet", async ({ dapp }) => {
      const foreign = await addressOf(WALLET_B, 0);

      expect(await invoke(dapp, (a) => window.ergo.sign_data(a, "hello"), foreign)).toEqual({
        ok: false,
        error: { code: -1, info: "The address is not associated with the connected wallet." }
      });
    });

    test("validates params", async ({ dapp }) => {
      const address = await addressOf(WALLET_A, 0);

      expect(await invoke(dapp, (a) => window.ergo.sign_data(a, ""), address)).toEqual({
        ok: false,
        error: { code: -1, info: "Invalid params." }
      });
    });
  });

  test("read-only wallets can't sign data", async ({ chain, popup, context, dapp }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importReadOnlyWallet("Watcher", await xpubOf(WALLET_A));
    await connectDapp(context, dapp, "Watcher");

    const { win, result } = await requestDataSignature(context, dapp, {
      address: await addressOf(WALLET_A, 0),
      message: "hello"
    });

    await expect(win.getByText("This wallet can't sign data.")).toBeVisible();
    await expect(win.getByRole("button", { name: "Sign" })).toBeDisabled();
    await expect(win.getByRole("textbox", { name: "Spending password" })).toHaveCount(0);

    await win.getByRole("button", { name: "Cancel" }).click();
    expect(await result).toEqual({ ok: false, error: { code: -3, info: "User rejected." } });
  });
});
