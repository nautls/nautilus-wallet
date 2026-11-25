import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpendableBox } from "@/chains/ergo/services/hergmesService";
import { fetchBoxes } from "./boxFetcher";

const mocks = vi.hoisted(() => ({
  addresses: [] as string[],
  holders: [] as string[],
  defaultIndex: 0,
  boxesByAddress: new Map<string, SpendableBox[]>(),
  reads: [] as string[][]
}));

vi.mock("@/chains/ergo/services/hergmesService", () => ({
  getSpendableBoxes: vi.fn(async (addresses: string[]) => {
    mocks.reads.push([...addresses].sort());
    return addresses.flatMap((a) => mocks.boxesByAddress.get(a) ?? []);
  })
}));
vi.mock("@/database/addressesDbService", () => ({
  addressesDbService: {
    getByWalletId: async () => mocks.addresses.map((script, index) => ({ script, index }))
  }
}));
vi.mock("@/database/walletsDbService", () => ({
  walletsDbService: {
    getById: async () => ({ settings: { defaultChangeIndex: mocks.defaultIndex } })
  }
}));
vi.mock("@/database/assetsDbService", () => ({
  assetsDbService: { getAddressesByTokenId: async () => mocks.holders }
}));

function box(id: string, creationHeight: number, confirmed = true): SpendableBox {
  return {
    boxId: id.repeat(64),
    transactionId: "f".repeat(64),
    index: 0,
    value: "1000000000",
    ergoTree: "0008cd03",
    creationHeight,
    assets: [],
    additionalRegisters: {},
    confirmed
  };
}

const old = box("a", 100);
const recent = box("b", 200);
const pendingChange = box("c", 300, false);

beforeEach(() => {
  mocks.addresses = ["addr0", "addr1", "addr2"];
  mocks.holders = ["addr0"];
  mocks.defaultIndex = 0;
  mocks.boxesByAddress = new Map([["addr0", [old, recent]]]);
  mocks.reads = [];
});

describe("fetchBoxes", () => {
  it("should read only the ERG holders when they have boxes, newest first", async () => {
    expect(await fetchBoxes(1)).toEqual([recent, old]);
    expect(mocks.reads).toEqual([["addr0"]]);
  });

  it("should read the default address with the holders", async () => {
    mocks.defaultIndex = 2;
    mocks.boxesByAddress.set("addr2", [pendingChange]);

    expect(await fetchBoxes(1)).toEqual([pendingChange, recent, old]);
    expect(mocks.reads).toEqual([["addr0", "addr2"]]);
  });

  it("should read the other addresses when the holders have no boxes", async () => {
    mocks.defaultIndex = 2;
    mocks.boxesByAddress = new Map([["addr1", [old]]]);

    expect(await fetchBoxes(1)).toEqual([old]);
    expect(mocks.reads).toEqual([["addr0", "addr2"], ["addr1"]]);
  });

  it("should read every address when no holder is known", async () => {
    mocks.holders = [];
    mocks.boxesByAddress = new Map([
      ["addr1", [old]],
      ["addr2", [recent]]
    ]);

    expect(await fetchBoxes(1)).toEqual([recent, old]);
    expect(mocks.reads).toEqual([["addr0", "addr1", "addr2"]]);
  });
});
