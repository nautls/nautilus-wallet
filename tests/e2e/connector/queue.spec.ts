import type { BrowserContext, Page } from "@playwright/test";
import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, WALLET_A } from "../fixtures/wallets";
import { clickToClose, connectDapp, invoke } from "../pages/connector";

/** Collects every connector window opened in the context, in order. */
function trackConnectorWindows(context: BrowserContext) {
  const windows: Page[] = [];
  context.on("page", (page) => windows.push(page));

  return {
    windows,
    /** Waits for the n-th (1-based) connector window and the given route to load. */
    async nth(n: number, route: string) {
      await expect.poll(() => windows.length).toBeGreaterThanOrEqual(n);
      const win = windows[n - 1];
      await win.waitForURL(new RegExp(`/connector/index\\.html#/${route}$`));
      return win;
    }
  };
}

test.describe("dApp request queueing", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
  });

  test("opens a single window for non-awaited connect calls", async ({ context, dapp }) => {
    const tracker = trackConnectorWindows(context);
    const result = invoke(dapp, () =>
      Promise.all([
        window.ergoConnector.nautilus.connect(),
        window.ergoConnector.nautilus.connect(),
        window.ergoConnector.nautilus.connect()
      ])
    );

    const win = await tracker.nth(1, "connect");
    await win.getByRole("button", { name: /Alice/ }).click();
    await clickToClose(win.getByRole("button", { name: "Connect", exact: true }));

    expect(await result).toEqual({ ok: true, value: [true, true, true] });
    expect(tracker.windows).toHaveLength(1);
  });

  test("shares the refusal with identical connect calls", async ({ context, dapp }) => {
    const tracker = trackConnectorWindows(context);
    const result = invoke(dapp, () =>
      Promise.all([
        window.ergoConnector.nautilus.connect(),
        window.ergoConnector.nautilus.connect()
      ])
    );

    const win = await tracker.nth(1, "connect");
    await clickToClose(win.getByRole("button", { name: "Cancel" }));

    expect(await result).toEqual({ ok: true, value: [false, false] });
    expect(tracker.windows).toHaveLength(1);
  });

  test("shares the signature with identical signing requests", async ({ context, dapp }) => {
    await connectDapp(context, dapp, WALLET_A.name);

    const tracker = trackConnectorWindows(context);
    const address = await addressOf(WALLET_A, 0);
    const result = invoke(
      dapp,
      (address) =>
        Promise.all([
          window.ergo.sign_data(address, "same message"),
          window.ergo.sign_data(address, "same message")
        ]),
      address
    );

    const win = await tracker.nth(1, "sign/data");
    await win.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
    await clickToClose(win.getByRole("button", { name: "Sign" }));

    const outcome = await result;
    expect(outcome).toEqual({
      ok: true,
      value: [expect.stringMatching(/^[0-9a-f]{112}$/), expect.stringMatching(/^[0-9a-f]{112}$/)]
    });
    if (outcome.ok) expect(outcome.value[0]).toBe(outcome.value[1]);
    expect(tracker.windows).toHaveLength(1);
  });

  test("shows non-awaited signing requests one at a time, in order", async ({ context, dapp }) => {
    await connectDapp(context, dapp, WALLET_A.name);

    const tracker = trackConnectorWindows(context);
    const address = await addressOf(WALLET_A, 0);
    const result = invoke(
      dapp,
      (address) =>
        Promise.allSettled([
          window.ergo.sign_data(address, "first message"),
          window.ergo.sign_data(address, "second message")
        ]),
      address
    );

    const first = await tracker.nth(1, "sign/data");
    await expect(first.getByText("first message")).toBeVisible();

    // the second request waits for the first window to be closed
    await expect.poll(() => tracker.windows.length).toBe(1);

    await first.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
    await clickToClose(first.getByRole("button", { name: "Sign" }));

    const second = await tracker.nth(2, "sign/data");
    await expect(second.getByText("second message")).toBeVisible();
    await clickToClose(second.getByRole("button", { name: "Cancel" }));

    expect(await result).toEqual({
      ok: true,
      value: [
        { status: "fulfilled", value: expect.stringMatching(/^[0-9a-f]{112}$/) },
        { status: "rejected", reason: { code: -3, info: "User rejected." } }
      ]
    });
    expect(tracker.windows).toHaveLength(2);
  });
});
