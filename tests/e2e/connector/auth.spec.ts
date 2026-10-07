import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, WALLET_A, WALLET_B, xpubOf } from "../fixtures/wallets";
import { DAPP_HOST } from "../mocks/services";
import {
  clickToClose,
  connectDapp,
  expectRequestFrom,
  invoke,
  withConnectorWindow
} from "../pages/connector";

type AuthArgs = { address: string; message: string };
type AuthResult = { signedMessage: string; proof: string };

function requestAuth(
  context: Parameters<typeof withConnectorWindow>[0],
  dapp: Parameters<typeof invoke>[0],
  args: AuthArgs
) {
  return withConnectorWindow(context, "auth", () =>
    invoke<AuthResult, AuthArgs>(
      dapp,
      ({ address, message }) => window.ergo.auth(address, message),
      args
    )
  );
}

test.describe("dApp authentication (EIP-28)", () => {
  test.describe("standard wallet", () => {
    test.beforeEach(async ({ chain, popup, context, dapp }) => {
      await fundWallet(chain, WALLET_A);
      await popup.importWallet(WALLET_A);
      await connectDapp(context, dapp, WALLET_A.name);
    });

    test("proves address ownership", async ({ context, dapp }) => {
      const address = await addressOf(WALLET_A, 0);
      const { win, result } = await requestAuth(context, dapp, { address, message: "login" });

      await expectRequestFrom(win, DAPP_HOST);
      await expect(
        win.getByText("requests a proof that the selected address belongs to you.")
      ).toBeVisible();
      await expect(win.getByRole("heading", { name: "Selected address" })).toBeVisible();
      await expect(win.getByText(address)).toBeVisible();

      await win.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await clickToClose(win.getByRole("button", { name: "Authenticate" }));

      const outcome = await result;
      expect(outcome.ok).toBe(true);

      const { signedMessage, proof } = (outcome as { value: AuthResult }).value;
      const [message, origin, timestamp, nonce] = signedMessage.split(";");
      expect(message).toBe("login");
      expect(origin).toBe(DAPP_HOST);
      expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(120);
      expect(nonce).toMatch(/^[0-9a-f]{64}$/);
      expect(proof).toMatch(/^[0-9a-f]{112}$/);
    });

    test("requires the spending password", async ({ context, dapp }) => {
      const { win, result } = await requestAuth(context, dapp, {
        address: await addressOf(WALLET_A, 0),
        message: "login"
      });

      await win.getByRole("button", { name: "Authenticate" }).click();
      await expect(win.getByText("Please enter your spending password.")).toBeVisible();

      await clickToClose(win.getByRole("button", { name: "Cancel" }));
      expect(await result).toEqual({ ok: false, error: { code: -3, info: "User rejected." } });
    });

    test("rejects when the user closes the window", async ({ context, dapp }) => {
      const { win, result } = await requestAuth(context, dapp, {
        address: await addressOf(WALLET_A, 0),
        message: "login"
      });

      await expect(win.getByRole("heading", { name: "Selected address" })).toBeVisible();
      await expectRequestFrom(win, DAPP_HOST);
      await win.close({ runBeforeUnload: true });

      expect(await result).toEqual({ ok: false, error: { code: -3, info: "User rejected." } });
    });

    test("rejects addresses not owned by the connected wallet", async ({ dapp }) => {
      const foreign = await addressOf(WALLET_B, 0);

      expect(await invoke(dapp, (a) => window.ergo.auth(a, "login"), foreign)).toEqual({
        ok: false,
        error: { code: -1, info: "The address is not associated with the connected wallet." }
      });
    });
  });

  test("read-only wallets can't authenticate", async ({ chain, popup, context, dapp }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importReadOnlyWallet("Watcher", await xpubOf(WALLET_A));
    await connectDapp(context, dapp, "Watcher");

    const { win, result } = await requestAuth(context, dapp, {
      address: await addressOf(WALLET_A, 0),
      message: "login"
    });

    await expect(win.getByText("Read-only wallet")).toBeVisible();
    await expect(win.getByRole("button", { name: "Authenticate" })).toBeDisabled();

    await clickToClose(win.getByRole("button", { name: "Cancel" }));
    expect(await result).toEqual({ ok: false, error: { code: -3, info: "User rejected." } });
  });
});
