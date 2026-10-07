import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, WALLET_A, WALLET_B } from "../fixtures/wallets";
import { DAPP_HOST } from "../mocks/services";
import {
  clickToClose,
  connectDapp,
  expectRequestFrom,
  invoke,
  withConnectorWindow
} from "../pages/connector";

test.describe("dApp connection", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.importWallet(WALLET_B);
  });

  test("connects after the user selects a wallet", async ({ context, dapp }) => {
    const { win, result } = await withConnectorWindow(context, "connect", () =>
      invoke(dapp, () => window.ergoConnector.nautilus.connect())
    );

    await expectRequestFrom(win, DAPP_HOST);
    await expect(win.getByText("requests to connect with Nautilus.")).toBeVisible();

    const connect = win.getByRole("button", { name: "Connect", exact: true });
    await expect(connect).toBeDisabled();

    // every wallet is listed
    await expect(win.getByRole("button", { name: /Alice/ })).toBeVisible();
    await expect(win.getByRole("button", { name: /Bob/ })).toBeVisible();

    await win.getByRole("button", { name: /Alice/ }).click();
    await expect(connect).toBeEnabled();
    await clickToClose(connect);
    expect(await result).toEqual({ ok: true, value: true });

    const state = await dapp.evaluate(async () => ({
      connected: await window.ergoConnector.nautilus.isConnected(),
      authorized: await window.ergoConnector.nautilus.isAuthorized(),
      ergo: typeof window.ergo,
      sameContext: (await window.ergoConnector.nautilus.getContext()) === window.ergo
    }));

    expect(state).toEqual({ connected: true, authorized: true, ergo: "object", sameContext: true });
  });

  test("binds the connection to the selected wallet", async ({ context, dapp }) => {
    await connectDapp(context, dapp, "Bob");

    const change = await invoke(dapp, () => window.ergo.get_change_address());
    expect(change).toEqual({ ok: true, value: await addressOf(WALLET_B, 0) });
  });

  test("doesn't create the ergo object when asked not to", async ({ context, dapp }) => {
    const { win, result } = await withConnectorWindow(context, "connect", () =>
      invoke(dapp, () => window.ergoConnector.nautilus.connect({ createErgoObject: false }))
    );

    await win.getByRole("button", { name: /Alice/ }).click();
    await clickToClose(win.getByRole("button", { name: "Connect", exact: true }));
    expect(await result).toEqual({ ok: true, value: true });

    expect(await dapp.evaluate(() => typeof window.ergo)).toBe("undefined");
    const height = await invoke(dapp, async () => {
      const ctx = await window.ergoConnector.nautilus.getContext();
      return ctx.get_current_height();
    });
    expect(height.ok).toBe(true);
  });

  test("resolves to false when the user cancels", async ({ context, dapp }) => {
    const { win, result } = await withConnectorWindow(context, "connect", () =>
      invoke(dapp, () => window.ergoConnector.nautilus.connect())
    );

    await clickToClose(win.getByRole("button", { name: "Cancel" }));

    expect(await result).toEqual({ ok: true, value: false });
    expect(await dapp.evaluate(() => window.ergoConnector.nautilus.isAuthorized())).toBe(false);
    expect(await dapp.evaluate(() => typeof window.ergo)).toBe("undefined");
  });

  test("resolves to false when the user closes the window", async ({ context, dapp }) => {
    const { win, result } = await withConnectorWindow(context, "connect", () =>
      invoke(dapp, () => window.ergoConnector.nautilus.connect())
    );

    // the request is only bound to the window once it's loaded; closing earlier leaves it pending
    await expectRequestFrom(win, DAPP_HOST);
    await win.close({ runBeforeUnload: true });

    expect(await result).toEqual({ ok: true, value: false });
    expect(await dapp.evaluate(() => window.ergoConnector.nautilus.isAuthorized())).toBe(false);
  });

  test("supports the deprecated read access request", async ({ context, dapp }) => {
    const { win, result } = await withConnectorWindow(context, "connect", () =>
      invoke(dapp, () => window.ergo_request_read_access!())
    );

    await win.getByRole("button", { name: /Alice/ }).click();
    await clickToClose(win.getByRole("button", { name: "Connect", exact: true }));

    expect(await result).toEqual({ ok: true, value: true });
    expect(await dapp.evaluate(() => window.ergo_check_read_access!())).toBe(true);
  });

  test("reconnects without prompting once authorized", async ({ context, dapp }) => {
    await connectDapp(context, dapp, "Alice");

    // the connection survives page reloads, but the context doesn't
    await dapp.reload();
    await dapp.waitForFunction(() => window.ergoConnector?.nautilus !== undefined);
    expect(await dapp.evaluate(() => window.ergoConnector.nautilus.isConnected())).toBe(false);
    expect(await dapp.evaluate(() => window.ergoConnector.nautilus.isAuthorized())).toBe(true);

    let opened = false;
    context.on("page", () => (opened = true));
    expect(await invoke(dapp, () => window.ergoConnector.nautilus.connect())).toEqual({
      ok: true,
      value: true
    });
    expect(opened).toBe(false);
    expect(await dapp.evaluate(() => typeof window.ergo)).toBe("object");
  });

  test("disconnects and revokes access", async ({ context, dapp }) => {
    await connectDapp(context, dapp, "Alice");

    const result = await invoke(dapp, async () => {
      const ergo = window.ergo;
      const disconnected = await window.ergoConnector.nautilus.disconnect();
      let error;
      try {
        await ergo.get_balance();
      } catch (e) {
        error = e;
      }

      return {
        disconnected,
        ergo: typeof window.ergo,
        connected: await window.ergoConnector.nautilus.isConnected(),
        authorized: await window.ergoConnector.nautilus.isAuthorized(),
        error
      };
    });

    expect(result).toEqual({
      ok: true,
      value: {
        disconnected: true,
        ergo: "undefined",
        connected: false,
        authorized: false,
        error: { code: -1, info: "Not connected." }
      }
    });
  });

  test("lists the connection in settings and allows revoking it", async ({
    context,
    dapp,
    popup
  }) => {
    await connectDapp(context, dapp, "Alice");

    await popup.goto("/settings");
    await popup.page.getByRole("tab", { name: "Connections" }).click();

    const card = popup.page.getByRole("tabpanel").filter({ hasText: DAPP_HOST });
    await expect(card).toContainText("Alice");

    await card.getByRole("button").first().click();
    await expect(popup.page.getByText("You have no connected apps yet.")).toBeVisible();

    expect(await dapp.evaluate(() => window.ergoConnector.nautilus.isAuthorized())).toBe(false);
  });
});
