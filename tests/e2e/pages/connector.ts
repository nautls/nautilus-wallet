import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

export type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code?: number; info?: string; message?: string } };

/**
 * Runs `fn` inside the dApp page and captures its result or thrown error as a
 * serializable {@link Outcome}. EIP-12 errors are thrown as plain objects so they
 * are preserved as-is.
 */
export function invoke<R, A = undefined>(
  page: Page,
  fn: (arg: A) => Promise<R> | R,
  arg?: A
): Promise<Outcome<R>> {
  return page.evaluate(
    async ({ src, arg }) => {
      try {
        const f = (0, eval)(`(${src})`);
        return { ok: true as const, value: await f(arg) };
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? { message: e.message } : (e as { code: number; info: string })
        };
      }
    },
    { src: fn.toString(), arg }
  ) as Promise<Outcome<R>>;
}

export type ConnectorRoute = "connect" | "auth" | "sign/tx" | "sign/data";

/**
 * Starts a dApp request that is expected to open the connector window, and
 * returns both the pending result and the window.
 */
export async function withConnectorWindow<R>(
  context: BrowserContext,
  route: ConnectorRoute,
  request: () => Promise<Outcome<R>>
): Promise<{ win: Page; result: Promise<Outcome<R>> }> {
  const winPromise = context.waitForEvent("page");
  const result = request();
  const win = await winPromise;
  await win.waitForURL(new RegExp(`/connector/index\\.html#/${route}$`));

  return { win, result };
}

/**
 * Clicks a button that closes its own window. The window can close before
 * Playwright receives the click acknowledgement, which makes `click()` throw
 * "Target page, context or browser has been closed", so that error is ignored
 * as long as the window actually closes.
 */
export async function clickToClose(target: Locator) {
  const win = target.page();
  await Promise.all([
    win.isClosed() ? undefined : win.waitForEvent("close"),
    target.click().catch((e: Error) => {
      if (!/Target page, context or browser has been closed/.test(e.message)) throw e;
    })
  ]);
}

/** Asserts that the request header shows the requesting dApp host. */
export async function expectRequestFrom(win: Page, host: string) {
  await expect(win.locator(".font-semibold", { hasText: host }).first()).toBeVisible();
}

/** Connects the dApp to the wallet named `walletName` through the connector window. */
export async function connectDapp(context: BrowserContext, dapp: Page, walletName: string) {
  const { win, result } = await withConnectorWindow(context, "connect", () =>
    invoke(dapp, () => window.ergoConnector.nautilus.connect())
  );

  await win.getByRole("button", { name: walletName }).click();
  await clickToClose(win.getByRole("button", { name: "Connect", exact: true }));

  expect(await result).toEqual({ ok: true, value: true });
}
