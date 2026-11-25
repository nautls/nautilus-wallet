import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpendableBox } from "@/chains/ergo/services/hergmesService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { getBalance, getUTxOs } from "./ergoHandlers";

const mocks = vi.hoisted(() => ({
  holders: [] as string[],
  boxesByAddress: new Map<string, SpendableBox[]>()
}));

vi.mock("@/chains/ergo/services/hergmesService", () => ({
  getSpendableBoxes: vi.fn(async (addresses: string[]) =>
    addresses.flatMap((a) => mocks.boxesByAddress.get(a) ?? [])
  ),
  getBalances: vi.fn(async (addresses: string[]) => {
    expect(addresses).toEqual(["addr0", "addr1"]);
    return { nanoErgs: 5n, tokens: new Map([["t1", 7n]]) };
  })
}));
vi.mock("@/database/addressesDbService", () => ({
  addressesDbService: {
    getByWalletId: async () => [{ script: "addr0" }, { script: "addr1" }]
  }
}));
vi.mock("@/database/assetsDbService", () => ({
  assetsDbService: { getAddressesByTokenId: async () => mocks.holders }
}));
vi.mock("@/database/connectedDAppsDbService", () => ({ connectedDAppsDbService: {} }));

const TREE = "0008cd03" + "11".repeat(32);

function box(id: string, confirmed: boolean): SpendableBox {
  return {
    boxId: id.repeat(64),
    transactionId: "f".repeat(64),
    index: 0,
    value: "1000000000",
    ergoTree: TREE,
    creationHeight: 100,
    assets: [],
    additionalRegisters: {},
    confirmed
  };
}

const confirmed = box("a", true);
const pending = box("b", false);

beforeEach(() => {
  mocks.holders = ["addr0"];
  mocks.boxesByAddress = new Map([["addr0", [confirmed, pending]]]);
});

const ids = (boxes: { boxId: string }[]) => boxes.map((b) => b.boxId).sort();

describe("getUTxOs", () => {
  it("should include mempool outputs, flagged as unconfirmed", async () => {
    const boxes = await getUTxOs(1);

    expect(ids(boxes)).toEqual(ids([confirmed, pending]));
    expect(boxes.find((b) => b.boxId === confirmed.boxId)).toMatchObject({ confirmed: true });
    expect(boxes.find((b) => b.boxId === pending.boxId)).toMatchObject({ confirmed: false });
  });

  it("should look at the other addresses when the ERG holders have no boxes", async () => {
    mocks.boxesByAddress = new Map([["addr1", [confirmed]]]);
    expect(ids(await getUTxOs(1))).toEqual(ids([confirmed]));
  });
});

describe("getBalance", () => {
  it("should sum every address of the wallet", async () => {
    expect(await getBalance(1, "all")).toEqual([
      { tokenId: "ERG", balance: "5" },
      { tokenId: "t1", balance: "7" }
    ]);
  });

  it("should answer one asset as a string, 0 when not held", async () => {
    expect(await getBalance(1, ERG_TOKEN_ID)).toBe("5");
    expect(await getBalance(1, "t1")).toBe("7");
    expect(await getBalance(1, "t2")).toBe("0");
  });
});
