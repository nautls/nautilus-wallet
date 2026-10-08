# End-to-end tests

Playwright tests that load the built Chrome extension (`dist/`) into Chromium and drive the
popup, the connector windows and the injected dApp API exactly like a user and a dApp would.

```sh
pnpm test:e2e                                    # build + run everything
pnpm exec playwright test tests/e2e/connector    # run a folder (needs a fresh `pnpm build:mainnet:chrome`)
pnpm exec playwright test -g "sends ERG" --debug # step through a single test
```

The first run needs a browser: `pnpm exec playwright install chromium`.

## How it works

- **No real network.** `mocks/services.ts` aborts every outgoing request that isn't explicitly
  mocked. `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` (set in `playwright.config.ts`) lets
  Playwright intercept requests made by the background service worker, too.
- **`MockChain`** (`mocks/chain.ts`) is an in-memory Ergo chain behind an ergo-graphql compatible
  API. Tests fund addresses, register tokens, mine blocks or make the node reject transactions,
  then assert on `chain.submitted`. Boxes get real box ids, so transactions are built and signed
  by the wallet's real prover.
- **Fixtures** (`fixtures/`):
  - `headers.json`: 10 mainnet block headers, needed to build the signing context.
  - `sigmausd.json`: mainnet snapshot of the SigmaUSD bank and oracle boxes.
  - `wallets.ts`: deterministic test wallets and address/xpub derivation helpers.
  - `test.ts`: the `chain`, `context`, `extensionId`, `popup` and `dapp` fixtures. Every test gets
    a fresh browser profile.
- **Fake dApp**: `https://dapp.test` is served by a route, so the content script injects into it
  (plus a same-origin iframe at `/frame`).
- **Page objects**: `pages/popup.ts` for popup flows, `pages/connector.ts` for dApp calls
  (`invoke`) and connector windows (`withConnectorWindow`).

## Gotchas

- Some reka-ui popovers and comboboxes keep focus trapped until their exit animation ends.
  Wait for the options to disappear (`expect(page.getByRole("option")).toHaveCount(0)`) before
  interacting with the next field.
- Open drawers and popovers mark the rest of the page `aria-hidden`, so `getByRole` can't see
  elements behind them, toasts included. Use CSS or text locators for those.
- Popup routes under `/add/*` need `?redirect=false` when there are no wallets yet;
  `Popup.goto()` adds it.
