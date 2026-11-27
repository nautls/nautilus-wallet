import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getStorage } = vi.hoisted(() => ({
  getStorage: vi.fn()
}));

vi.mock("webextension-polyfill", () => ({
  storage: {
    local: {
      get: getStorage
    }
  }
}));

vi.mock("@/database/utxosDbService", () => ({
  utxosDbService: {}
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("GraphQLService server URL initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    getStorage.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads a custom GraphQL server URL from serialized settings", async () => {
    const customUrl = "https://custom-gql.example.com/graphql";
    getStorage.mockResolvedValue({
      settings: JSON.stringify({ graphQLServer: customUrl })
    });

    const { ErgoGraphQLProvider } = await import("@fleet-sdk/blockchain-providers");
    const setUrl = vi.spyOn(ErgoGraphQLProvider.prototype, "setUrl");

    await import("./graphQlService");
    await flush();

    expect(getStorage).toHaveBeenCalledWith("settings");
    expect(setUrl).toHaveBeenCalledWith(customUrl);
  });

  it("falls back to DEFAULT_SERVER_URL when settings are absent", async () => {
    getStorage.mockResolvedValue({});

    const { ErgoGraphQLProvider } = await import("@fleet-sdk/blockchain-providers");
    const setUrl = vi.spyOn(ErgoGraphQLProvider.prototype, "setUrl");

    const { DEFAULT_SERVER_URL } = await import("./graphQlService");
    await flush();

    expect(setUrl).toHaveBeenCalledWith(DEFAULT_SERVER_URL);
  });

  it("falls back to DEFAULT_SERVER_URL when the stored URL is blank", async () => {
    getStorage.mockResolvedValue({
      settings: JSON.stringify({ graphQLServer: "   " })
    });

    const { ErgoGraphQLProvider } = await import("@fleet-sdk/blockchain-providers");
    const setUrl = vi.spyOn(ErgoGraphQLProvider.prototype, "setUrl");

    const { DEFAULT_SERVER_URL } = await import("./graphQlService");
    await flush();

    expect(setUrl).toHaveBeenCalledWith(DEFAULT_SERVER_URL);
  });

  it("logs and keeps the default URL when loading settings fails", async () => {
    const storageError = new Error("Storage unavailable");
    getStorage.mockRejectedValue(storageError);

    const { ErgoGraphQLProvider } = await import("@fleet-sdk/blockchain-providers");
    const { log } = await import("@/common/logger");
    const setUrl = vi.spyOn(ErgoGraphQLProvider.prototype, "setUrl");
    const logError = vi.spyOn(log, "error");

    await import("./graphQlService");
    await flush();

    expect(setUrl).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith("Failed to load GraphQL server URL", storageError);
  });
});
