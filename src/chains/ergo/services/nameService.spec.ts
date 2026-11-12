import { ErgoAddress } from "@fleet-sdk/core";
import { hex, sha256, utf8 } from "@fleet-sdk/crypto";
import { SByte, SColl, SLong } from "@fleet-sdk/serializer";
import { describe, expect, it, vi } from "vitest";
import type { UnspentTokenBox } from "./graphQlService";
import { createNameService, isName, NameLookupError, normalizeName } from "./nameService";

vi.mock("@/chains/ergo/services/graphQlService", () => ({ graphQLService: {} }));

// hq3r.erg on the V5 registry, as read from mainnet at height 1915070
const V5_RECORD_TREE =
  "09db07d81bd601e4e30002d602b2a5040000d603d0e4c672020408d604e4c6a70408d605d07204d606e4c672020605d607e4c6a70605d608e4c672020805d609e4c672020905d60ac2a7d60b93b1b5a4d9010b6393c2720b720a0402d60cc1a7d60ddb6308a7d60eb2720d040000d60f0e030008cdd610d0e4c6a70508d611e4c6a70805d612e4c6a70905d613ed93721105009372120500d614ed927211058092f401ececececec93721205f02e93721205e02b93721205d02893721205c02593721205b02293721205a01fd6159683050193720c0580897a93b1720d0402938c720e0205029683040193b17205044893b4720504000406720f93b17210044893b4721004000406720fec72137214d616db63087202d617b27216040000d618d0e4c672020508d6199683080193b1b5a5d901196393c27219720a040293c27202720a93c17202720c93b172160402938c7217018c720e01938c72170205029683040193b17203044893b4720304000406720f93b17218044893b4721804000406720f93e4c67202070ee4c6a7070ed61a7ea305d61b8f721a7207959372010201ea027204d196830901720b72157219721b72139372037205937206720793720805009372090500959372010202ea027204d196830a01720b72157219721b721394720372059372187203937206720793720805009372090500959372010203d801d61c99720695917207721a7207721aea027204d196830b01720b7215721972139372037205937218721092721c05a08a20939e721c05a08a20050093720805009372090500aea5d9011d63ed93c2721dd008cd0373c110be6f32148553221aa5cfba3c3d66cae609bbdca6fa48228396556c437992c1721d9c9d721c05a08a200580c8afa025959372010204ea027204d196830a01720b72157219721b7213937203720593721872109372067207927208058092f401ececececec93720905f02e93720905e02b93720905d02893720905c02593720905b02293720905a01f959372010205d804d61cb2a5040200d61d7e721106d61e9d9c721d7e72120606030186a0d61fb2a5040400d196830a01afa4d9012063ec93c57220c5a7d801d622c27220ed93b17222044893b4722204000406720f720b72157219721b721492b1a5040696830501947203720593721872039372067207937208050093720905009683020193c2721c7205927ec1721c0699721d721e9683020193c2721fd008cd037537248e07814ce5fb6a1fa9db91c7ee8b15d51295e2025367a78ab73da526f8927ec1721f06721e959372010206ea027204d196830901720b72157219721493720372059372187210937206720793720805009372090500d10100";
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
  registry: "v5",
  registryNftId: "d0205941ebcadbef0236d483a8a7a8e354f3ed1add0e470284a13368f671f018",
  height: HEIGHT
};

const recordBox: UnspentTokenBox = {
  boxId: BOX_ID,
  ergoTree: V5_RECORD_TREE,
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
  height = HEIGHT as number | null,
  recordContracts = undefined as NonNullable<
    Parameters<typeof createNameService>[0]
  >["recordContracts"]
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
    getHeight,
    recordContracts
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
    expect(isName("my-name-1.erg")).toBe(true);
  });

  it("should trim and lowercase the input", () => {
    expect(isName("  Alice.ERG ")).toBe(true);
    expect(normalizeName("  Alice.ERG ")).toBe("alice.erg");
  });

  it("should not treat other input as a name", () => {
    expect(isName(ADDRESS)).toBe(false);
    expect(isName("")).toBe(false);
    expect(isName(undefined)).toBe(false);
    expect(isName("alice")).toBe(false);
    expect(isName(".erg")).toBe(false);
    expect(isName("-alice.erg")).toBe(false);
    expect(isName("alice-.erg")).toBe(false);
    expect(isName("sub.alice.erg")).toBe(false);
    expect(isName("alice.eth")).toBe(false);
    expect(isName("al ice.erg")).toBe(false);
    expect(isName("аlice.erg")).toBe(false); // Cyrillic "а"
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
    ["an unknown registry", { ...answer, registry: "v7" }]
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

  it("should reject a record with an impossible expiry when the registry limits it", async () => {
    const ergoTree = "0008cd" + "02".repeat(33);
    const treeHash = hex.encode(sha256(hex.decode(ergoTree)));
    const recordContracts = { v6: { treeHash, maxExpiryAhead: 789_840 } };
    const response = () => jsonResponse(200, { ...answer, registry: "v6" });

    const valid = setup({
      response: response(),
      recordContracts,
      boxes: [withBox({ ergoTree, creationHeight: EXPIRY - 789_840 })]
    });
    await expect(valid.service.resolve(NAME)).resolves.toMatchObject({ status: "resolved" });

    const tooFar = setup({
      response: response(),
      recordContracts,
      boxes: [withBox({ ergoTree, creationHeight: EXPIRY - 789_841 })]
    });
    await expect(tooFar.service.resolve(NAME)).resolves.toEqual({ status: "invalid", name: NAME });
  });
});
