import { reactive, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IAssetInfo } from "@/types/database";
import { AssetType } from "@/types/internal";
import { useAssetsStore } from "./assetsStore";

const mocks = vi.hoisted(() => ({
  getAssetsMetadata: vi.fn(),
  getAnyOf: vi.fn(),
  bulkPut: vi.fn()
}));

vi.mock("./appStore", () => ({
  useAppStore: () =>
    reactive({ settings: { conversionCurrency: "usd", blacklistedTokensLists: [] } })
}));
vi.mock("@/composables/useWebExtStorage", () => ({
  useWebExtStorage: (_key: string, defaults: unknown) => ref(defaults)
}));
vi.mock("@/chains/ergo/services/hergmesService", () => ({
  getAssetsMetadata: mocks.getAssetsMetadata
}));
vi.mock("@/database/assetInfoDbService", () => ({
  assetInfoDbService: { getAnyOf: mocks.getAnyOf, bulkPut: mocks.bulkPut }
}));

const tokenA: IAssetInfo = {
  id: "a",
  mintingBoxId: "",
  type: AssetType.Unknown,
  name: "A",
  decimals: 2
};

describe("loadMetadata", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    mocks.getAssetsMetadata.mockReset();
    mocks.getAnyOf.mockReset().mockResolvedValue([]);
    mocks.bulkPut.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("stores what the relay knows and keeps the rest as unknown in memory", async () => {
    mocks.getAssetsMetadata.mockResolvedValue([tokenA]);
    const assets = useAssetsStore();

    await assets.loadMetadata(["a", "b"]);

    expect(assets.metadata.get("a")).toEqual(expect.objectContaining({ name: "A", decimals: 2 }));
    expect(assets.metadata.get("b")).toBeDefined();
    expect(mocks.bulkPut).toHaveBeenCalledWith([tokenA]);
  });

  it("keeps tokens unknown in memory when the relay knows none of them", async () => {
    mocks.getAssetsMetadata.mockResolvedValue([]);
    const assets = useAssetsStore();

    await assets.loadMetadata(["a"]);

    expect(assets.metadata.get("a")).toBeDefined();
    expect(assets.unavailable.has("a")).toBe(false);
    expect(mocks.bulkPut).not.toHaveBeenCalled();
  });

  it("tries again later when the relay can't be asked", async () => {
    mocks.getAssetsMetadata.mockResolvedValueOnce(undefined).mockResolvedValueOnce([tokenA]);
    const assets = useAssetsStore();

    await assets.loadMetadata(["a"]);
    expect(assets.metadata.has("a")).toBe(false);
    expect(assets.unavailable.has("a")).toBe(true);

    await vi.runAllTimersAsync();
    expect(assets.metadata.get("a")).toEqual(expect.objectContaining({ name: "A" }));
    expect(assets.unavailable.has("a")).toBe(false);
  });

  it("asks the relay when stored metadata can't be read", async () => {
    mocks.getAnyOf.mockRejectedValue(new Error("evicted"));
    mocks.getAssetsMetadata.mockResolvedValue([tokenA]);
    const assets = useAssetsStore();

    await assets.loadMetadata(["a"]);

    expect(assets.metadata.get("a")).toEqual(expect.objectContaining({ name: "A" }));
  });
});
