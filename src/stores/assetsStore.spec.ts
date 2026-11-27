import { reactive, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetType } from "@/types/internal";
import { useAssetsStore } from "./assetsStore";

const mocks = vi.hoisted(() => ({
  getAssetsMetadata: vi.fn(),
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
  assetInfoDbService: { getAnyOf: async () => [], bulkPut: mocks.bulkPut }
}));

describe("loadMetadata", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getAssetsMetadata.mockReset();
    mocks.bulkPut.mockReset();
  });

  it("marks tokens as unknown without storing them when the relay has no metadata", async () => {
    mocks.getAssetsMetadata.mockResolvedValue(undefined);
    const assets = useAssetsStore();

    await assets.loadMetadata(["a", "b"]);

    expect(assets.metadata.get("a")).toBeDefined();
    expect(assets.metadata.get("b")).toBeDefined();
    expect(mocks.bulkPut).not.toHaveBeenCalled();
  });

  it("stores the metadata the relay returns and marks the rest as unknown", async () => {
    mocks.getAssetsMetadata.mockResolvedValue([
      { id: "a", mintingBoxId: "", type: AssetType.Unknown, name: "A", decimals: 2 }
    ]);
    const assets = useAssetsStore();

    await assets.loadMetadata(["a", "b"]);

    expect(assets.metadata.get("a")).toEqual(expect.objectContaining({ name: "A", decimals: 2 }));
    expect(assets.metadata.get("b")).toBeDefined();
    expect(mocks.bulkPut).toHaveBeenCalledOnce();
  });
});
