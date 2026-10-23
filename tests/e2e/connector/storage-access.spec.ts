import type { CDPSession, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test";
import { WALLET_A } from "../fixtures/wallets";

type EvalResult = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Evaluates `expression` inside the extension's content script (isolated world) of
 * `page`'s main frame, where web page code can't reach but a compromised renderer can.
 */
async function evalInContentScript(
  page: Page,
  extensionId: string,
  expression: string
): Promise<EvalResult> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const contextIds: number[] = [];
  cdp.on("Runtime.executionContextCreated", ({ context }) => {
    const aux = context.auxData as { type?: string; isDefault?: boolean } | undefined;
    if (context.origin === `chrome-extension://${extensionId}` && aux?.type === "isolated") {
      contextIds.push(context.id);
    }
  });
  await cdp.send("Runtime.enable"); // reports existing contexts
  await expect.poll(() => contextIds.length).toBeGreaterThan(0);

  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    contextId: contextIds[0],
    expression: `Promise.resolve().then(() => ${expression}).then(
      (value) => ({ ok: true, value }),
      (e) => ({ ok: false, error: String(e?.message ?? e) })
    )`,
    awaitPromise: true,
    returnByValue: true
  });
  await cdp.detach();

  if (exceptionDetails) throw Error(exceptionDetails.text);
  return result.value as EvalResult;
}

test.describe("extension storage access", () => {
  test.beforeEach(async ({ popup }) => {
    await popup.importWallet(WALLET_A);
  });

  test("evaluates code in the content script", async ({ dapp, extensionId }) => {
    // sanity check: extension APIs available to content scripts are reachable
    expect(
      await evalInContentScript(dapp, extensionId, "typeof chrome.runtime.sendMessage")
    ).toEqual({ ok: true, value: "function" });
  });

  test("content scripts can't read storage.local", async ({ dapp, extensionId }) => {
    const result = await evalInContentScript(
      dapp,
      extensionId,
      "chrome.storage.local.get(null).then((items) => Object.keys(items))"
    );

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not allowed/i) });
  });

  test("extension pages can still read storage.local", async ({ context, extensionId }) => {
    const [worker] = context.serviceWorkers();
    expect(worker.url()).toContain(extensionId);

    const keys = await worker.evaluate(async () => Object.keys(await chrome.storage.local.get()));
    expect(keys).toContain("wallet:1");
  });
});
