import { ErgoAddress } from "@fleet-sdk/core";
import { hex, utf8 } from "@fleet-sdk/crypto";
import { SByte, SColl, SLong } from "@fleet-sdk/serializer";
import { describe, expect, it, vi } from "vitest";
import type { UnspentTokenBox } from "./graphQlService";
import { createNameService, isName, NameLookupError, normalizeName } from "./nameService";

vi.mock("@/chains/ergo/services/graphQlService", () => ({ graphQLService: {} }));

// Name Record V3, from contracts/ergo-name-record-v3.json of Mew Names
const RECORD_TREE =
  "09e30ad829d601e4e30002d602b2a5040000d603d0e4c672020408d604e4c6a70408d605d07204d606e4c672020605d607e4c6a70605d608e4c672020859d6098c720801d60a8c720802d60bc2a7d60c93b1b5a4d9010c6393c2720c720b0402d60ddb6308a7d60eb2720d040000d60f0e030008cdd610d0e4c6a70508d611e4c6a70859d6128c721101d6138c721102d614ed93721205009372130500d615ed927212058092f401ececececec93721305f02e93721305e02b93721305d02893721305c02593721305b02293721305a01fd6169683040193b1720d0402938c720e0205029683040193b17205044893b4720504000406720f93b17210044893b4721004000406720fec72147215d617c17202d6188cc7720201d6198cc7a701d61adb63087202d61bb2721a040000d61cd0e4c672020508d61de4c6a7070ed61ee4c67202090ed61fb1721ed62096830c0193b1b5a5d901206393c27220720b040293c27202720b927217c1a79272170580897a927218721992721899a304a00b93b1721a0402938c721b018c720e01938c721b0205029683040193b17203044893b4720304000406720f93b1721c044893b4721c04000406720f93e4c67202070e721d90721f048010d6217ea305d6228f72217207d62393721f0400d6240e240008cd037537248e07814ce5fb6a1fa9db91c7ee8b15d51295e2025367a78ab73da526f8d625b1721dd626b095ed917225040a93b4721d997225040a72250e052e6572676fb4721d0400997225040ab4721d040099722504080400d901264002d801d6288c72260195908c72260202bf72289a72280402d627afa4d9012763ec93c57227c5a7d801d629c27227ed93b17229044893b4722904000406720fd6289a720705c0f407d62993721ee4c6a7090e959372010201ea027204d196830901720c721672207222721493720372059372067207937209050093720a0500959372010202ea027204d196830b01720c7216722072227214947203720593721c720372239372067207937209050093720a0500959372010203d806d62ab2db6501fe040000d62bdb6308722ad62cb2722b040000d62de4c6722a0405d62e9972067207d62fb2a5040200ea027204d196830f01720c7216722072148f722172289683050191b1722b0400938c722c010e206a2b821b5727e85beb5e78b4efb9f0250d59cd48481d2ded2c23e91ba1d07c66938c722c02050291722d0500928cc7722a0199a30478937203720593721c7210722992722e05a08a20939e722e05a08a2005009072069a722105e09e60937209050093720a050096830301722793c2722f7224927ec1722f069d9c9c7e9d722e05a08a20067e95937226040205d0860395937226040405a09c0195937226040605904e95937226040805a01f05e807067e9591722d058084af5f722d058084af5f06060164959372010204ea027204d196830b01720c7216722072227214937203720593721c721072299372067207927209058092f401ececececec93720a05f02e93720a05e02b93720a05d02893720a05c02593720a05b02293720a05a01f959372010205d804d62ab2a5040200d62b7e721206d62c9d9c722b7e72130606030186a0d62db2a5040400d196830a017227720c721672207222721592b1a5040696830601947203720593721c720372239372067207937209050093720a05009683020193c2722a7205927ec1722a0699722b722c9683020193c2722d7224927ec1722d06722c959372010206ea027204d196830a01720c721672207215937203720593721c721072299372067207937209050093720a0500959372010207d196830b01720c7216722090721999a304c094409272217228937203720593721c721072299372067207937209721293720a7213d10100";
const NAME = "hq3r.erg";
const ADDRESS = "9gvDVNy1XvDeFoi4ZHn5v6u3tFRECMXGKbwuHbijJu6Z2hLQTQz";
const OTHER_ADDRESS = "9fJiyM6A77VGoN6rNy6dYzYdaJ5JqLKfChoX1QXCYS6kPs4bXBp";
const TOKEN_ID = "bd14e553d172b6fcb171151d891a82fc045a45e5219af1e1830c3c06d5f23c7e";
const BOX_ID = "d8b1c20cff0f119d67a84fd60525f33da80350f0ea02d6bbe8b59f6abc2d5cb9";
const EXPIRY = 2144496;
const HEIGHT = 1915070;

const answer = {
  name: NAME,
  address: ADDRESS,
  controller: ADDRESS,
  expiryHeight: EXPIRY,
  tokenId: TOKEN_ID,
  recordBoxId: BOX_ID,
  registry: "v6",
  height: HEIGHT
};

const recordBox: UnspentTokenBox = {
  boxId: BOX_ID,
  ergoTree: RECORD_TREE,
  creationHeight: 1914766,
  assets: [{ tokenId: TOKEN_ID, amount: "1" }],
  additionalRegisters: {
    R4: "08cd033bf7c61bd148b86fa6dd89a1d199a34173653abe20eaf468afc9302c21d906e0",
    R5: "08cd033bf7c61bd148b86fa6dd89a1d199a34173653abe20eaf468afc9302c21d906e0",
    R6: "05e0e38502",
    R7: "0e08687133722e657267",
    R8: "0500",
    R9: "0500"
  }
};

function p2pkRegister(address: string) {
  return "08cd" + hex.encode(ErgoAddress.decode(address).getPublicKeys()[0]);
}

function longRegister(value: number) {
  return SLong(BigInt(value)).toHex();
}

function bytesRegister(value: string) {
  return SColl(SByte, utf8.decode(value)).toHex();
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function setup({
  response = jsonResponse(200, answer) as Response | Error,
  boxes = [recordBox] as UnspentTokenBox[] | Error,
  height = HEIGHT as number | null
} = {}) {
  const fetch = vi.fn(async (url: string) => {
    void url;
    if (response instanceof Error) throw response;
    return response;
  });
  const getUnspentBoxesByTokenId = vi.fn(async (tokenId: string) => {
    void tokenId;
    if (boxes instanceof Error) throw boxes;
    return boxes;
  });
  const getHeight = vi.fn(async () => height ?? undefined);
  const service = createNameService({
    fetch,
    getUnspentBoxesByTokenId,
    getHeight
  });

  return { service, fetch, getUnspentBoxesByTokenId };
}

function withBox(changes: Partial<UnspentTokenBox>, registers: Record<string, string> = {}) {
  return {
    ...recordBox,
    ...changes,
    additionalRegisters: { ...recordBox.additionalRegisters, ...registers }
  };
}

async function lookupError(promise: Promise<unknown>) {
  const error = await promise.catch((e) => e);
  expect(error).toBeInstanceOf(NameLookupError);
  return (error as NameLookupError).reason;
}

describe("isName", () => {
  it("should recognise .erg and .ergo names", () => {
    expect(isName("alice.erg")).toBe(true);
    expect(isName("alice.ergo")).toBe(true);
    expect(isName("a.erg")).toBe(true);
    expect(isName("7.ergo")).toBe(true);
    expect(isName("my-name-1.erg")).toBe(true);
    expect(isName("a".repeat(63) + ".erg")).toBe(true);
  });

  it("should recognise names with emoji, counting an emoji as one character", () => {
    expect(isName("\u{1F431}.erg")).toBe(true); // cat face
    expect(isName("cat-\u{1F431}\u{1F680}.ergo")).toBe(true);
    expect(isName("\u{1F431}".repeat(63) + ".erg")).toBe(true);
    expect(isName("\u{1F431}".repeat(64) + ".erg")).toBe(false);
  });

  it("should trim, lowercase and drop emoji variation selectors", () => {
    expect(isName("  Alice.ERG ")).toBe(true);
    expect(normalizeName("  Alice.ERG ")).toBe("alice.erg");
    expect(normalizeName("\u{1F431}\uFE0F.erg")).toBe("\u{1F431}.erg");
    expect(normalizeName("\u{1F431}\uFE0E.erg")).toBe("\u{1F431}.erg");
    expect(isName("\u{1F431}\uFE0F.erg")).toBe(true);
  });

  it("should not treat other input as a name", () => {
    expect(isName(ADDRESS)).toBe(false);
    expect(isName("")).toBe(false);
    expect(isName(undefined)).toBe(false);
    expect(isName("alice")).toBe(false);
    expect(isName(".erg")).toBe(false);
    expect(isName("a".repeat(64) + ".erg")).toBe(false);
    expect(isName("-alice.erg")).toBe(false);
    expect(isName("alice-.erg")).toBe(false);
    expect(isName("sub.alice.erg")).toBe(false);
    expect(isName("alice.eth")).toBe(false);
    expect(isName("al ice.erg")).toBe(false);
    expect(isName("al_ice.erg")).toBe(false);
  });

  it("should refuse Unicode other than emoji from U+1F000 to U+1FFFF", () => {
    expect(isName("\u0430lice.erg")).toBe(false); // Cyrillic "а"
    expect(isName("caf\u00e9.erg")).toBe(false); // accented "é"
    expect(isName("\u2764.erg")).toBe(false); // heavy black heart, below the emoji range
    expect(isName("\u{1F469}\u200D\u{1F4BB}.erg")).toBe(false); // joined emoji
    expect(isName("\u{20000}.erg")).toBe(false); // above the emoji range
  });
});

describe("name resolution", () => {
  it("should resolve a name confirmed by its record box", async () => {
    const { service, fetch, getUnspentBoxesByTokenId } = setup();

    await expect(service.resolve(" HQ3R.erg")).resolves.toEqual({
      status: "resolved",
      name: NAME,
      address: ADDRESS,
      expiryHeight: EXPIRY,
      height: HEIGHT
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://names.mewfinance.com/api/v1/resolve?name=hq3r.erg"
    );
    expect(getUnspentBoxesByTokenId).toHaveBeenCalledWith(TOKEN_ID);
  });

  it.each(["not_registered", "expired", "invalid"])(
    "should report a %s name without reading the chain",
    async (status) => {
      const { service, getUnspentBoxesByTokenId } = setup({
        response: jsonResponse(404, { error: "", name: NAME, status })
      });

      await expect(service.resolve(NAME)).resolves.toEqual({ status, name: NAME });
      expect(getUnspentBoxesByTokenId).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["a stale index", jsonResponse(502, { error: "stale" })],
    ["a server error", new Response("oops", { status: 500 })],
    ["a rejected request", jsonResponse(400, { error: "bad name" })],
    ["a 404 without status", jsonResponse(404, { error: "not found" })],
    ["a network error", new TypeError("Failed to fetch")]
  ])("should fail on %s", async (_, response) => {
    const { service } = setup({ response });
    expect(await lookupError(service.resolve(NAME))).toBe("unavailable");
  });

  it.each([
    ["another name", { ...answer, name: "other.erg" }],
    ["a malformed address", { ...answer, address: "not-an-address" }],
    ["a missing token id", { ...answer, tokenId: undefined }],
    ["an unknown registry", { ...answer, registry: "v7" }],
    ["the retired V5 registry", { ...answer, registry: "v5" }]
  ])("should fail when the service answers with %s", async (_, body) => {
    const { service } = setup({ response: jsonResponse(200, body) });
    expect(await lookupError(service.resolve(NAME))).toBe("unverified");
  });

  it.each([
    ["no box", []],
    ["two boxes", [recordBox, recordBox]],
    ["another box", [withBox({ boxId: TOKEN_ID })]],
    ["another contract", [withBox({ ergoTree: "0008cd" + "02".repeat(33) })]],
    [
      "an extra token",
      [withBox({ assets: [...recordBox.assets, { tokenId: BOX_ID, amount: "1" }] })]
    ],
    ["more than one copy", [withBox({ assets: [{ tokenId: TOKEN_ID, amount: "2" }] })]],
    ["another name", [withBox({}, { R7: bytesRegister("other.erg") })]],
    ["a name with a variation selector", [withBox({}, { R7: bytesRegister("hq3r\uFE0F.erg") })]],
    ["another address", [withBox({}, { R5: p2pkRegister(OTHER_ADDRESS) })]],
    ["an unreadable address", [withBox({}, { R5: "0e00" })]],
    ["another expiry", [withBox({}, { R6: longRegister(EXPIRY + 1) })]]
  ])("should fail when the chain has %s", async (_, boxes) => {
    const { service } = setup({ boxes });
    expect(await lookupError(service.resolve(NAME))).toBe("unverified");
  });

  it("should fail when the chain can't be read", async () => {
    expect(await lookupError(setup({ boxes: new Error("timeout") }).service.resolve(NAME))).toBe(
      "unavailable"
    );
    expect(await lookupError(setup({ height: null }).service.resolve(NAME))).toBe("unavailable");
  });

  it("should treat a record as expired at the wallet's own height", async () => {
    const { service } = setup({ height: EXPIRY });
    await expect(service.resolve(NAME)).resolves.toEqual({ status: "expired", name: NAME });
  });

  it("should resolve a name with emoji by its canonical bytes", async () => {
    const name = "\u{1F431}.erg";
    const { service, fetch } = setup({
      response: jsonResponse(200, { ...answer, name }),
      boxes: [withBox({}, { R7: bytesRegister(name) })]
    });

    await expect(service.resolve("\u{1F431}\uFE0F.ERG")).resolves.toMatchObject({
      status: "resolved",
      name,
      address: ADDRESS
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://names.mewfinance.com/api/v1/resolve?name=%F0%9F%90%B1.erg"
    );
  });

  it("should reject a record with an expiry the contract can't produce", async () => {
    const atLimit = setup({ boxes: [withBox({ creationHeight: EXPIRY - 789_840 })] });
    await expect(atLimit.service.resolve(NAME)).resolves.toMatchObject({ status: "resolved" });

    const tooFar = setup({ boxes: [withBox({ creationHeight: EXPIRY - 789_841 })] });
    await expect(tooFar.service.resolve(NAME)).resolves.toEqual({ status: "invalid", name: NAME });
  });
});
