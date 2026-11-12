import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { ErgoAddress } from "@fleet-sdk/core";
import { utf8 } from "@fleet-sdk/crypto";
import { SByte, SColl, SLong } from "@fleet-sdk/serializer";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, fundWallet, test } from "../fixtures/test";
import { RECIPIENT_ADDRESS, WALLET_A } from "../fixtures/wallets";
import { EXTERNAL_ADDRESS, type GqlBox, type MockChain } from "../mocks/chain";

const { v5RecordErgoTree } = JSON.parse(
  readFileSync(new URL("../fixtures/data/names.json", import.meta.url), "utf8")
) as { v5RecordErgoTree: string };

const RESOLVE_URL = "https://names.mewfinance.com/api/v1/resolve?**";
const NAME = "alice.erg";

type NameRecord = { box: GqlBox; answer: Record<string, unknown> };

const hex32 = () => randomBytes(32).toString("hex");
const treeOf = (address: string) => ErgoAddress.decode(address).ergoTree;

function p2pk(address: string) {
  // a P2PK ErgoTree is "0008cd" + public key; the register holds the SigmaProp "08cd" + key
  return treeOf(address).slice(2);
}

/** Puts a V5 name record on the chain and returns it with the resolver API's answer for it. */
function addNameRecord(chain: MockChain, address: string): NameRecord {
  const tokenId = hex32();
  const expiryHeight = chain.height + 100_000;
  const box: GqlBox = {
    boxId: hex32(),
    transactionId: hex32(),
    index: 1,
    value: "2000000",
    creationHeight: chain.height - 50,
    ergoTree: v5RecordErgoTree,
    assets: [{ tokenId, amount: "1" }],
    additionalRegisters: {
      R4: p2pk(address),
      R5: p2pk(address),
      R6: SLong(BigInt(expiryHeight)).toHex(),
      R7: SColl(SByte, utf8.decode(NAME)).toHex()
    }
  };
  chain.addBox(box);

  const answer = {
    name: NAME,
    address,
    controller: address,
    expiryHeight,
    tokenId,
    recordBoxId: box.boxId,
    registry: "v5",
    registryNftId: "d0205941ebcadbef0236d483a8a7a8e354f3ed1add0e470284a13368f671f018",
    height: chain.height
  };

  return { box, answer };
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

    // looked up once while typing and again right before signing
    expect(requests).toEqual([NAME, NAME]);

    await drawer.getByRole("textbox", { name: / password$/ }).fill(WALLET_A.password);
    await drawer.getByRole("button", { name: "Sign" }).click();
    await expect(popup.toast("Transaction sent")).toBeVisible();

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
});
