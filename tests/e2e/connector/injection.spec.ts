import { expect, test } from "../fixtures/test";
import { DAPP_ORIGIN } from "../mocks/services";
import { invoke } from "../pages/connector";

test.describe("content script injection", () => {
  test("exposes the EIP-12 connector API", async ({ dapp }) => {
    const api = await dapp.evaluate(() => {
      const nautilus = window.ergoConnector.nautilus;
      return {
        connectors: Object.keys(window.ergoConnector),
        methods: ["connect", "disconnect", "isAuthorized", "isConnected", "getContext"].filter(
          (m) => typeof nautilus[m] === "function"
        ),
        frozen: Object.isFrozen(nautilus),
        ergo: typeof window.ergo
      };
    });

    expect(api.connectors).toEqual(["nautilus"]);
    expect(api.methods).toEqual([
      "connect",
      "disconnect",
      "isAuthorized",
      "isConnected",
      "getContext"
    ]);
    expect(api.frozen).toBe(true);
    expect(api.ergo).toBe("undefined");
  });

  test("exposes the deprecated read access functions", async ({ dapp }) => {
    expect(
      await dapp.evaluate(() => [
        typeof window.ergo_request_read_access,
        typeof window.ergo_check_read_access
      ])
    ).toEqual(["function", "function"]);

    expect(await invoke(dapp, () => window.ergo_check_read_access!())).toEqual({
      ok: true,
      value: false
    });
  });

  test("removes the injected script tag after injection", async ({ dapp }) => {
    expect(await dapp.locator("script[src*='injected.js']").count()).toBe(0);
  });

  test("reports a disconnected state before connecting", async ({ dapp }) => {
    expect(await invoke(dapp, () => window.ergoConnector.nautilus.isConnected())).toEqual({
      ok: true,
      value: false
    });
    expect(await invoke(dapp, () => window.ergoConnector.nautilus.isAuthorized())).toEqual({
      ok: true,
      value: false
    });
    expect(await invoke(dapp, () => window.ergoConnector.nautilus.getContext())).toEqual({
      ok: false,
      error: { code: -3, info: "Not connected." }
    });
  });

  test("injects into iframes", async ({ dapp }) => {
    const frame = dapp.frame({ url: `${DAPP_ORIGIN}/frame` });
    expect(frame).not.toBeNull();

    await frame!.waitForFunction(() => window.ergoConnector?.nautilus !== undefined);
    expect(await frame!.evaluate(() => window.ergoConnector.nautilus.isAuthorized())).toBe(false);
  });

  test("doesn't inject into XML documents", async ({ context }) => {
    await context.route(`${DAPP_ORIGIN}/feed.xml`, (route) =>
      route.fulfill({ contentType: "application/xml", body: "<feed><item>1</item></feed>" })
    );

    const page = await context.newPage();
    await page.goto(`${DAPP_ORIGIN}/feed.xml`);

    // give the content script a chance to run
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => typeof window.ergoConnector)).toBe("undefined");
  });
});
