import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDbAddress, IDbAsset, IDbWallet, NotNullId } from "@/types/database";
import { AddressState, AddressType } from "@/types/internal";
import { useWalletStore } from "./walletStore";

const mocks = vi.hoisted(() => ({
  appStore: {
    loading: false,
    wallets: [] as NotNullId<IDbWallet>[],
    settings: { lastOpenedWalletId: 0, zeroConf: false },
    updateWallet: vi.fn(async () => {})
  },
  loadMetadata: vi.fn(async () => {}),
  getAssetsByWalletId: vi.fn(),
  getAddressesByWalletId: vi.fn(),
  getLastSynced: vi.fn()
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("./appStore", () => ({
  useAppStore: () => mocks.appStore
}));

vi.mock("./assetsStore", () => ({
  useAssetsStore: () => ({
    metadata: new Map(),
    blacklist: [],
    loadMetadata: mocks.loadMetadata
  })
}));

vi.mock("./chainStore", () => ({
  useChainStore: () => ({ height: 1_000_000 })
}));

vi.mock("./poolStore", () => ({
  usePoolStore: () => ({ balance: new Map() })
}));

vi.mock("@/chains/ergo/hdKey", () => ({
  default: {
    fromPublicKey: vi.fn(() => ({
      deriveAddresses: vi.fn(() => []),
      deriveAddress: vi.fn()
    }))
  }
}));

vi.mock("@/chains/ergo/services/graphQlService", () => ({
  graphQLService: {
    getAddressesInfo: vi.fn(async () => []),
    checkBoxesOlderThan: vi.fn(async () => false)
  }
}));

vi.mock("@/database/addressesDbService", () => ({
  addressesDbService: {
    getByWalletId: mocks.getAddressesByWalletId,
    put: vi.fn(async () => "")
  }
}));

vi.mock("@/database/assetsDbService", () => ({
  assetsDbService: {
    getByWalletId: mocks.getAssetsByWalletId
  }
}));

vi.mock("@/database/walletSyncDbService", () => ({
  walletSyncDbService: {
    getLastSynced: mocks.getLastSynced,
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {})
  }
}));

function makeWallet(id: number): NotNullId<IDbWallet> {
  return {
    id,
    name: `Wallet ${id}`,
    chain: { id: "ergo", network: "mainnet" },
    type: "standard",
    publicKey: `02${id.toString(16).padStart(64, "0")}`,
    chainCode: id.toString(16).padStart(64, "0"),
    settings: { avoidAddressReuse: false, addressFilter: "all", defaultChangeIndex: 0 },
    needsBackup: false,
    createdAt: 1_700_000_000_000
  };
}

function makeAddress(walletId: number, script: string): IDbAddress {
  return {
    type: AddressType.P2PK,
    state: AddressState.Used,
    script,
    index: 0,
    walletId
  };
}

function makeAsset(walletId: number, address: string, tokenId: string): IDbAsset {
  return {
    walletId,
    address,
    tokenId,
    confirmedAmount: "1000"
  };
}

describe("walletStore.load", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.appStore.wallets = [makeWallet(1), makeWallet(2)];
    mocks.appStore.settings.lastOpenedWalletId = 0;
    mocks.loadMetadata.mockReset().mockResolvedValue(undefined);
    mocks.getAssetsByWalletId.mockReset();
    mocks.getAddressesByWalletId.mockReset();
    mocks.getLastSynced.mockReset().mockImplementation(async () => Date.now());
  });

  it("clears previous wallet addresses immediately when switching wallets", async () => {
    const wallet1Address = makeAddress(1, "addr-wallet-1");
    const wallet2Address = makeAddress(2, "addr-wallet-2");
    const wallet1Asset = makeAsset(1, "addr-wallet-1", "token-1");
    const wallet2Asset = makeAsset(2, "addr-wallet-2", "token-2");

    let resolveWallet2Assets!: (assets: IDbAsset[]) => void;
    const wallet2AssetsPromise = new Promise<IDbAsset[]>((resolve) => {
      resolveWallet2Assets = resolve;
    });

    mocks.getAssetsByWalletId.mockImplementation((id: number) =>
      id === 1 ? Promise.resolve([wallet1Asset]) : wallet2AssetsPromise
    );
    mocks.getAddressesByWalletId.mockImplementation((id: number) =>
      Promise.resolve(id === 1 ? [wallet1Address] : [wallet2Address])
    );

    const store = useWalletStore();
    await store.load(1);

    expect(store.id).toBe(1);
    expect(store.addresses.map((a) => a.script)).toEqual(["addr-wallet-1"]);

    const switching = store.load(2);

    expect(store.loading).toBe(true);
    expect(store.id).toBe(2);
    expect(store.addresses).toEqual([]);

    resolveWallet2Assets([wallet2Asset]);
    await switching;

    expect(store.loading).toBe(false);
    expect(store.id).toBe(2);
    expect(store.addresses.map((a) => a.script)).toEqual(["addr-wallet-2"]);
  });

  it("ignores a superseded load when another wallet load starts concurrently", async () => {
    const wallet1Address = makeAddress(1, "addr-wallet-1");
    const wallet2Address = makeAddress(2, "addr-wallet-2");

    let resolveWallet1Assets!: (assets: IDbAsset[]) => void;
    let resolveWallet2Assets!: (assets: IDbAsset[]) => void;
    const wallet1AssetsPromise = new Promise<IDbAsset[]>((resolve) => {
      resolveWallet1Assets = resolve;
    });
    const wallet2AssetsPromise = new Promise<IDbAsset[]>((resolve) => {
      resolveWallet2Assets = resolve;
    });

    mocks.getAssetsByWalletId.mockImplementation((id: number) =>
      id === 1 ? wallet1AssetsPromise : wallet2AssetsPromise
    );
    mocks.getAddressesByWalletId.mockImplementation((id: number) =>
      Promise.resolve(id === 1 ? [wallet1Address] : [wallet2Address])
    );

    const store = useWalletStore();
    const firstLoad = store.load(1);
    const secondLoad = store.load(2);

    resolveWallet1Assets([]);
    await firstLoad;

    expect(store.loading).toBe(true);
    expect(store.id).toBe(2);
    expect(store.addresses).toEqual([]);

    resolveWallet2Assets([]);
    await secondLoad;

    expect(store.loading).toBe(false);
    expect(store.id).toBe(2);
    expect(store.addresses.map((a) => a.script)).toEqual(["addr-wallet-2"]);
  });
});
