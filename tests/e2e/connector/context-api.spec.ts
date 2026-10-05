import { expect, fundWallet, test } from "../fixtures/test";
import { addressOf, TEST_NFT, TEST_TOKEN, WALLET_A } from "../fixtures/wallets";
import { connectDapp, invoke } from "../pages/connector";

test.describe("dApp context API", () => {
  test.beforeEach(async ({ chain, popup, context, dapp }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await connectDapp(context, dapp, WALLET_A.name);
  });

  test("get_balance returns the confirmed balance", async ({ dapp }) => {
    expect(await invoke(dapp, () => window.ergo.get_balance())).toEqual({
      ok: true,
      value: "12500000000"
    });
    expect(await invoke(dapp, () => window.ergo.get_balance("ERG"))).toEqual({
      ok: true,
      value: "12500000000"
    });
    expect(await invoke(dapp, (id) => window.ergo.get_balance(id), TEST_TOKEN.tokenId)).toEqual({
      ok: true,
      value: "100000"
    });
    expect(await invoke(dapp, () => window.ergo.get_balance("ff".repeat(32)))).toEqual({
      ok: true,
      value: "0"
    });
  });

  test("get_balance('all') returns every asset", async ({ dapp }) => {
    const result = await invoke(dapp, () => window.ergo.get_balance("all"));

    expect(result.ok).toBe(true);
    expect((result as { value: unknown[] }).value).toEqual(
      expect.arrayContaining([
        { tokenId: "ERG", balance: "12500000000" },
        { tokenId: TEST_TOKEN.tokenId, balance: "100000" },
        { tokenId: TEST_NFT.tokenId, balance: "1" }
      ])
    );
  });

  test("returns used, unused and change addresses", async ({ dapp }) => {
    const [addr0, addr1, addr2] = await Promise.all([0, 1, 2].map((i) => addressOf(WALLET_A, i)));

    expect(await invoke(dapp, () => window.ergo.get_used_addresses())).toEqual({
      ok: true,
      value: [addr0, addr1]
    });
    expect(await invoke(dapp, () => window.ergo.get_unused_addresses())).toEqual({
      ok: true,
      value: [addr2]
    });
    expect(await invoke(dapp, () => window.ergo.get_change_address())).toEqual({
      ok: true,
      value: addr0
    });
  });

  test("get_utxos returns all unspent boxes", async ({ dapp, chain }) => {
    const expected = [
      ...chain.boxesOf(await addressOf(WALLET_A, 0)),
      ...chain.boxesOf(await addressOf(WALLET_A, 1))
    ].map((b) => b.boxId);

    const result = await invoke(dapp, () => window.ergo.get_utxos());
    expect(result.ok).toBe(true);

    const boxes = (result as { value: { boxId: string; confirmed: boolean }[] }).value;
    expect(boxes.map((b) => b.boxId).sort()).toEqual(expected.sort());
    expect(boxes.every((b) => b.confirmed)).toBe(true);
  });

  test("get_utxos selects boxes for a target", async ({ dapp, chain }) => {
    const [tokenBox] = chain.boxesOf(await addressOf(WALLET_A, 0));

    // legacy (amount, tokenId) signature
    const byToken = await invoke(dapp, (id) => window.ergo.get_utxos("10", id), TEST_TOKEN.tokenId);
    expect(byToken).toMatchObject({ ok: true, value: [{ boxId: tokenBox.boxId }] });

    // EIP-12 selection target
    const byTarget = await invoke(
      dapp,
      (id) =>
        window.ergo.get_utxos({ nanoErgs: "1000000", tokens: [{ tokenId: id, amount: "1" }] }),
      TEST_TOKEN.tokenId
    );
    expect(byTarget).toMatchObject({ ok: true, value: [{ boxId: tokenBox.boxId }] });

    // nanoErgs only, legacy signature
    const byAmount = await invoke(dapp, () => window.ergo.get_utxos("1000000"));
    expect((byAmount as { value: unknown[] }).value).toHaveLength(1);

    // unreachable target
    const tooMuch = await invoke(dapp, () => window.ergo.get_utxos({ nanoErgs: "99000000000" }));
    expect(tooMuch).toEqual({ ok: true, value: [] });
  });

  test("rejects pagination", async ({ dapp }) => {
    const error = { code: -1, info: "Pagination is not supported." };

    expect(
      await invoke(dapp, () => window.ergo.get_utxos(undefined, undefined, { page: 1, limit: 1 }))
    ).toEqual({ ok: false, error });
    expect(await invoke(dapp, () => window.ergo.get_used_addresses({ page: 1, limit: 1 }))).toEqual(
      { ok: false, error }
    );
    expect(
      await invoke(dapp, () => window.ergo.get_unused_addresses({ page: 1, limit: 1 }))
    ).toEqual({ ok: false, error });
  });

  test("get_current_height returns the chain height", async ({ dapp, chain }) => {
    expect(await invoke(dapp, () => window.ergo.get_current_height())).toEqual({
      ok: true,
      value: chain.height
    });
  });

  test("submit_tx validates its params", async ({ dapp }) => {
    expect(await invoke(dapp, () => window.ergo.submit_tx(undefined))).toEqual({
      ok: false,
      error: { code: -1, info: "Invalid params." }
    });
  });

  test("submit_tx reports node rejections", async ({ dapp, chain }) => {
    chain.submitError = "Double spending attempt";
    const [box] = chain.boxesOf(await addressOf(WALLET_A, 0));
    const fakeTx = {
      id: "aa".repeat(32),
      inputs: [{ boxId: box.boxId, spendingProof: { proofBytes: "", extension: {} } }],
      dataInputs: [],
      outputs: []
    };

    expect(await invoke(dapp, (tx) => window.ergo.submit_tx(tx), fakeTx)).toEqual({
      ok: false,
      error: { code: 1, info: "Double spending attempt" }
    });
  });

  test("is scoped to the connected origin", async ({ context }) => {
    const other = await context.newPage();
    await other.goto("https://dapp.test/other");
    await other.waitForFunction(() => window.ergoConnector?.nautilus !== undefined);

    // same origin: authorized
    expect(await other.evaluate(() => window.ergoConnector.nautilus.isAuthorized())).toBe(true);

    // different origin: not authorized
    await context.route("https://evil.test/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<html><body>evil</body></html>" })
    );
    const evil = await context.newPage();
    await evil.goto("https://evil.test/");
    await evil.waitForFunction(() => window.ergoConnector?.nautilus !== undefined);
    expect(await evil.evaluate(() => window.ergoConnector.nautilus.isAuthorized())).toBe(false);
  });
});
