import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { ErgoAddress } from "@fleet-sdk/core";
import { utf8 } from "@fleet-sdk/crypto";
import { SByte, SColl, SLong } from "@fleet-sdk/serializer";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, fundWallet, test } from "../fixtures/test";
import { RECIPIENT_ADDRESS, WALLET_A } from "../fixtures/wallets";
import { EXTERNAL_ADDRESS, type GqlBox, type MockChain } from "../mocks/chain";

const { registryNftId, registrarErgoTree, recordErgoTree } = JSON.parse(
  readFileSync(new URL("../fixtures/data/names.json", import.meta.url), "utf8")
) as { registryNftId: string; registrarErgoTree: string; recordErgoTree: string };

const RESOLVE_URL = "https://names.mewfinance.com/api/v1/resolve?**";
const NAME = "alice.erg";

type NameRecord = { box: GqlBox; answer: Record<string, unknown> };

const hex32 = () => randomBytes(32).toString("hex");
const treeOf = (address: string) => ErgoAddress.decode(address).ergoTree;

function p2pk(address: string) {
  // a P2PK ErgoTree is "0008cd" + public key; the register holds the SigmaProp "08cd" + key
  return treeOf(address).slice(2);
}

/**
 * Puts a V6 name record on the chain, with the transaction that minted its NFT, and returns it
 * with the resolver API's answer for it. Without `registrar` the NFT is minted by an ordinary
 * wallet, as anyone can, instead of by the registrar.
 */
function addNameRecord(chain: MockChain, address: string, { registrar = true } = {}): NameRecord {
  const expiryHeight = chain.height + 100_000;
  const funding = gqlBox({ ergoTree: treeOf(address), value: "10000000" });
  // a new token's id is the id of the minting transaction's first input
  const tokenId = funding.boxId;
  const box = gqlBox({
    index: 1,
    value: "2000000",
    ergoTree: recordErgoTree,
    assets: [{ tokenId, amount: "1" }],
    additionalRegisters: {
      R4: p2pk(address),
      R5: p2pk(address),
      R6: SLong(BigInt(expiryHeight)).toHex(),
      R7: SColl(SByte, utf8.decode(NAME)).toHex()
    }
  });
  const registrarBox = gqlBox({
    ergoTree: registrarErgoTree,
    assets: [{ tokenId: registryNftId, amount: "1" }]
  });
  const inputs = registrar ? [funding, registrarBox] : [funding];

  chain.addTransaction({
    transactionId: box.transactionId,
    timestamp: String(Date.now()),
    inputs: inputs.map((input, index) => ({ proofBytes: "", extension: {}, index, box: input })),
    dataInputs: [],
    outputs: [box],
    inclusionHeight: box.creationHeight
  });
  chain.addBox(box);

  const answer = {
    name: NAME,
    address,
    controller: address,
    expiryHeight,
    tokenId,
    recordBoxId: box.boxId,
    registry: "v6",
    height: chain.height
  };

  return { box, answer };

  function gqlBox(fields: Partial<GqlBox>): GqlBox {
    return {
      boxId: hex32(),
      transactionId: hex32(),
      index: 0,
      value: "1000000",
      creationHeight: chain.height - 50,
      ergoTree: "",
      assets: [],
      additionalRegisters: {},
      ...fields
    };
  }
}

/** Serves the resolver API from `answers`; names it doesn't hold are not registered. */
async function serveResolver(context: BrowserContext, answers: () => Record<string, unknown>) {
  const requests: string[] = [];
  await context.route(RESOLVE_URL, (route) => {
    const name = new URL(route.request().url()).searchParams.get("name") ?? "";
    requests.push(name);

    const answer = answers()[name];
    if (answer === 502) return route.fulfill({ status: 502, json: { error: "stale" } });
    if (answer) return route.fulfill({ json: answer });
    return route.fulfill({
      status: 404,
      json: { error: "This name is not registered.", name, status: "not_registered" }
    });
  });

  return requests;
}

function reviewDrawer(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Transaction review" });
}

async function sign(page: Page) {
  const drawer = reviewDrawer(page);
  await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
  await drawer.getByRole("button", { name: "Sign" }).click();
}

const paidTo = (chain: MockChain, address: string) =>
  chain.submitted.some((tx) => tx.outputs.some((o) => o.ergoTree === treeOf(address)));

async function fillRecipient(page: Page, recipient: string, ergAmount = "1") {
  await page.locator("#recipient-0").fill(recipient);
  await page.getByPlaceholder("0").first().fill(ergAmount);
}

test.describe("send to a name", () => {
  test.beforeEach(async ({ chain, popup }) => {
    await fundWallet(chain, WALLET_A);
    await popup.importWallet(WALLET_A);
    await popup.navigate("send");
  });

  test("sends to the address the name resolves to", async ({ popup, chain, context }) => {
    const page = popup.page;
    const record = addNameRecord(chain, RECIPIENT_ADDRESS);
    const requests = await serveResolver(context, () => ({ [NAME]: record.answer }));

    await fillRecipient(page, " Alice.ERG", "1.5");
    await expect(page.locator('[data-resolved-address="0"]')).toHaveText(
      `Sends to ${RECIPIENT_ADDRESS}`
    );
    // the field was left while the lookup ran; its result must clear the pending state
    await expect(page.locator("[data-form-error]")).toHaveCount(0);

    await page.getByRole("button", { name: "Send", exact: true }).click();
    const drawer = reviewDrawer(page);
    await expect(drawer.locator('[data-receiver-name="0"]')).toHaveText(NAME);
    await expect(drawer.getByText(RECIPIENT_ADDRESS)).toBeVisible();

    // looked up while typing and again before the review opens
    expect(requests).toEqual([NAME, NAME]);

    await sign(page);
    await expect(popup.toast("Transaction sent")).toBeVisible();
    // and once more after the user confirms
    expect(requests).toEqual([NAME, NAME, NAME]);

    const [tx] = chain.submitted;
    const payment = tx.outputs.find((o) => o.ergoTree === treeOf(RECIPIENT_ADDRESS));
    expect(payment?.value.toString()).toBe("1500000000");
  });

  test("doesn't send when a name can't be resolved", async ({ popup, chain, context }) => {
    const page = popup.page;
    const send = page.getByRole("button", { name: "Send", exact: true });
    const record = addNameRecord(chain, RECIPIENT_ADDRESS);
    const wrongAddress = { ...record.answer, name: "liar.erg", address: EXTERNAL_ADDRESS };
    await serveResolver(context, () => ({ "down.erg": 502, "liar.erg": wrongAddress }));

    await fillRecipient(page, "nobody.erg");
    await send.click();
    await expect(page.getByText("This name isn't registered")).toBeVisible();

    await fillRecipient(page, "down.erg");
    await send.click();
    await expect(page.getByText("Couldn't look up this name right now")).toBeVisible();

    // the API names a record box that doesn't say what the API claims
    await fillRecipient(page, "liar.erg");
    await send.click();
    await expect(page.getByText("Couldn't confirm this name on the blockchain")).toBeVisible();

    await expect(page.locator('[data-resolved-address="0"]')).toHaveCount(0);
    await expect(reviewDrawer(page)).toHaveCount(0);
    expect(chain.submitted).toHaveLength(0);
  });

  test("asks again when the name's address changes", async ({ popup, chain, context }) => {
    const page = popup.page;
    const send = page.getByRole("button", { name: "Send", exact: true });
    let record = addNameRecord(chain, RECIPIENT_ADDRESS);
    await serveResolver(context, () => ({ [NAME]: record.answer }));

    await fillRecipient(page, NAME);
    await expect(page.locator('[data-resolved-address="0"]')).toContainText(RECIPIENT_ADDRESS);

    // the name is transferred before the user sends
    record = addNameRecord(chain, EXTERNAL_ADDRESS);
    await send.click();
    await expect(page.getByText("This name's address changed")).toBeVisible();
    await expect(page.locator('[data-resolved-address="0"]')).toContainText(EXTERNAL_ADDRESS);
    await expect(reviewDrawer(page)).toHaveCount(0);

    await send.click();
    const drawer = reviewDrawer(page);
    await expect(drawer.locator('[data-receiver-name="0"]')).toHaveText(NAME);
    await expect(drawer.getByText(EXTERNAL_ADDRESS)).toBeVisible();
  });

  test("doesn't trust a record NFT the registrar didn't issue", async ({
    popup,
    chain,
    context
  }) => {
    const page = popup.page;
    addNameRecord(chain, RECIPIENT_ADDRESS);
    // anyone can mint an NFT into a box with the record contract and the name in R7
    const forged = addNameRecord(chain, EXTERNAL_ADDRESS, { registrar: false });
    await serveResolver(context, () => ({ [NAME]: forged.answer }));

    await fillRecipient(page, NAME);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Couldn't confirm this name on the blockchain")).toBeVisible();

    await expect(page.locator('[data-resolved-address="0"]')).toHaveCount(0);
    await expect(reviewDrawer(page)).toHaveCount(0);
    expect(chain.submitted).toHaveLength(0);
  });

  test("doesn't sign when the name changes while the review is open", async ({
    popup,
    chain,
    context
  }) => {
    const page = popup.page;
    const record = addNameRecord(chain, RECIPIENT_ADDRESS);
    const requests = await serveResolver(context, () => ({ [NAME]: record.answer }));

    await fillRecipient(page, NAME);
    await expect(page.locator('[data-resolved-address="0"]')).toContainText(RECIPIENT_ADDRESS);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(reviewDrawer(page).getByText(RECIPIENT_ADDRESS)).toBeVisible();

    // the owner points the name at another address: the record box is spent and recreated
    record.box.boxId = hex32();
    record.box.additionalRegisters.R5 = p2pk(EXTERNAL_ADDRESS);
    record.answer = { ...record.answer, recordBoxId: record.box.boxId, address: EXTERNAL_ADDRESS };

    await sign(page);
    await expect(
      page.getByText("This name's address changed. Review it again.", { exact: true })
    ).toBeVisible();
    await expect(reviewDrawer(page)).toHaveCount(0);
    expect(requests).toEqual([NAME, NAME, NAME]);
    expect(chain.submitted).toHaveLength(0);

    // the form shows the new address and asks for another review
    await expect(page.locator('[data-resolved-address="0"]')).toContainText(EXTERNAL_ADDRESS);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(reviewDrawer(page).getByText(EXTERNAL_ADDRESS)).toBeVisible();
    await sign(page);
    await expect(popup.toast("Transaction sent")).toBeVisible();
    expect(paidTo(chain, RECIPIENT_ADDRESS)).toBe(false);
    expect(paidTo(chain, EXTERNAL_ADDRESS)).toBe(true);
  });
});
