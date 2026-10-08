import type { EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { expect, fundWallet, test } from "../fixtures/test";
import { buildTransaction } from "../fixtures/transactions";
import { RECIPIENT_ADDRESS, TEST_TOKEN, WALLET_A, xpubOf } from "../fixtures/wallets";
import { DAPP_HOST } from "../mocks/services";
import { toast } from "../pages/common";
import {
  clickToClose,
  connectDapp,
  expectRequestFrom,
  invoke,
  withConnectorWindow
} from "../pages/connector";

type SignTxRequest = { tx: EIP12UnsignedTransaction; indexes?: number[] };

function requestSignature(
  context: Parameters<typeof withConnectorWindow>[0],
  dapp: Parameters<typeof invoke>[0],
  tx: EIP12UnsignedTransaction
) {
  return withConnectorWindow(context, "sign/tx", () =>
    invoke<SignedTransaction, SignTxRequest>(dapp, ({ tx }) => window.ergo.sign_tx(tx), { tx })
  );
}

test.describe("dApp transaction signing", () => {
  test.describe("standard wallet", () => {
    test.beforeEach(async ({ chain, popup, context, dapp }) => {
      await fundWallet(chain, WALLET_A);
      await popup.importWallet(WALLET_A);
      await connectDapp(context, dapp, WALLET_A.name);
    });

    test("signs a transaction after password confirmation", async ({ context, dapp, chain }) => {
      const tx = await buildTransaction(chain, WALLET_A);
      const { win, result } = await requestSignature(context, dapp, tx);

      await expectRequestFrom(win, DAPP_HOST);
      await expect(win.getByText("requests to sign a transaction.")).toBeVisible();
      await expect(win.getByText("Sending to external address")).toBeVisible();
      await expect(win.getByText(RECIPIENT_ADDRESS.slice(0, 20))).toBeVisible();
      await expect(win.getByText("Network fee")).toBeVisible();
      await expect(win.getByText("Alice")).toBeVisible();

      await win.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await clickToClose(win.getByRole("button", { name: "Sign" }));

      const outcome = await result;
      expect(outcome.ok).toBe(true);
      const signed = (outcome as { value: SignedTransaction }).value;
      expect(signed.id).toMatch(/^[0-9a-f]{64}$/);
      expect(signed.inputs.map((i) => i.boxId)).toEqual(tx.inputs.map((i) => i.boxId));
      expect(
        signed.inputs.every((i) => /^[0-9a-f]+$/.test(i.spendingProof?.proofBytes ?? ""))
      ).toBe(true);
      expect(signed.outputs.map((o) => o.ergoTree)).toEqual(tx.outputs.map((o) => o.ergoTree));

      // nothing is broadcast by the wallet itself
      expect(chain.submitted).toHaveLength(0);
    });

    test("signs and submits through the dApp API", async ({ context, dapp, chain }) => {
      const tx = await buildTransaction(chain, WALLET_A, {
        tokens: [{ tokenId: TEST_TOKEN.tokenId, amount: "500" }]
      });
      const { win, result } = await requestSignature(context, dapp, tx);

      await expect(win.getByText("TestToken").first()).toBeVisible();
      await win.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await win.getByRole("button", { name: "Sign" }).click();

      const signed = ((await result) as { value: SignedTransaction }).value;
      const submitted = await invoke(dapp, (tx) => window.ergo.submit_tx(tx), signed);

      expect(submitted).toEqual({ ok: true, value: signed.id });
      expect(chain.submitted.map((t) => t.id)).toEqual([signed.id]);
    });

    test("keeps the window open on a wrong password", async ({ context, dapp, chain }) => {
      const tx = await buildTransaction(chain, WALLET_A);
      const { win, result } = await requestSignature(context, dapp, tx);

      const sign = win.getByRole("button", { name: "Sign" });
      await sign.click();
      await expect(win.getByText("Please enter your spending password.")).toBeVisible();

      await win.getByRole("textbox", { name: "Spending password" }).fill("wrong password");
      await sign.click();
      await expect(toast(win, "Wrong password")).toBeVisible();
      expect(win.isClosed()).toBe(false);

      await win.getByRole("textbox", { name: "Spending password" }).fill(WALLET_A.password);
      await clickToClose(sign);
      expect((await result).ok).toBe(true);
    });

    test("rejects when the user cancels", async ({ context, dapp, chain }) => {
      const { win, result } = await requestSignature(
        context,
        dapp,
        await buildTransaction(chain, WALLET_A)
      );

      await clickToClose(win.getByRole("button", { name: "Cancel" }));

      expect(await result).toEqual({ ok: false, error: { code: 2, info: "User rejected." } });
    });

    test("rejects when the user closes the window", async ({ context, dapp, chain }) => {
      const { win, result } = await requestSignature(
        context,
        dapp,
        await buildTransaction(chain, WALLET_A)
      );

      await expect(win.getByRole("button", { name: "Sign" })).toBeVisible();
      await expectRequestFrom(win, DAPP_HOST);
      await win.close({ runBeforeUnload: true });

      expect(await result).toEqual({ ok: false, error: { code: 2, info: "User rejected." } });
    });

    test("requires agreement before signing a token burn", async ({ context, dapp, chain }) => {
      const tx = await buildTransaction(chain, WALLET_A, {
        burn: [{ tokenId: TEST_TOKEN.tokenId, amount: "100" }]
      });
      const { win, result } = await requestSignature(context, dapp, tx);

      await expect(win.getByText("Burning", { exact: true })).toBeVisible();

      const password = win.getByRole("textbox", { name: "Spending password" });
      const sign = win.getByRole("button", { name: "Sign" });
      await expect(password).toBeDisabled();
      await expect(sign).toBeDisabled();

      await win.getByText("Burn tokens permanently").click();
      await expect(sign).toBeEnabled();
      await password.fill(WALLET_A.password);
      await sign.click();

      expect((await result).ok).toBe(true);
    });

    test("validates params without opening a window", async ({ dapp }) => {
      expect(await invoke(dapp, () => window.ergo.sign_tx(undefined))).toEqual({
        ok: false,
        error: { code: -1, info: "Invalid params." }
      });
    });

    test("doesn't support signing selected inputs", async ({ context, dapp, chain }) => {
      // `sign_tx_inputs` is exposed by the injected API but not implemented:
      // the background script has no handler for it, so webext-bridge rejects the call.
      const tx = await buildTransaction(chain, WALLET_A, { nanoErgs: 11_000_000_000n });

      let opened = false;
      context.on("page", () => (opened = true));

      const outcome = await invoke<unknown, SignTxRequest>(
        dapp,
        ({ tx, indexes }) => window.ergo.sign_tx_inputs(tx, indexes),
        { tx, indexes: [0] }
      );

      expect(outcome).toEqual({
        ok: false,
        error: {
          message:
            "[webext-bridge] No handler registered in 'background' to accept messages with id 'int:sign-tx-input'"
        }
      });
      expect(opened).toBe(false);
    });
  });

  test("read-only wallets can't sign", async ({ chain, popup, context, dapp }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importReadOnlyWallet("Watcher", await xpubOf(WALLET_A));
    await connectDapp(context, dapp, "Watcher");

    const { win, result } = await requestSignature(
      context,
      dapp,
      await buildTransaction(chain, WALLET_A)
    );

    await expect(win.getByText("Read-only wallet")).toBeVisible();
    await expect(win.getByText("This wallet can't sign transactions.")).toBeVisible();
    await expect(win.getByRole("button", { name: "Sign" })).toBeDisabled();

    await clickToClose(win.getByRole("button", { name: "Cancel" }));
    expect(await result).toEqual({ ok: false, error: { code: 2, info: "User rejected." } });
  });
});
