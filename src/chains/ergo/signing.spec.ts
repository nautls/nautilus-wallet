import { EIP12UnsignedTransaction, Network } from "@fleet-sdk/common";
import { ErgoAddress, ErgoMessage } from "@fleet-sdk/core";
import { hex } from "@fleet-sdk/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDbAddress, IDbWallet } from "@/types/database";
import { AddressState, AddressType, WalletType } from "@/types/internal";
import type HdKey from "./hdKey";
import { signTransaction } from "./signing";

const mocks = vi.hoisted(() => ({
  walletStore: {
    id: 1,
    type: "standard" as WalletType,
    publicKey: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    settings: { avoidAddressReuse: false, addressFilter: "all" as const, defaultChangeIndex: 0 }
  },
  getWalletById: vi.fn(),
  getAddressesByWalletId: vi.fn(),
  getHeaders: vi.fn(),
  checkTransaction: vi.fn(),
  getPrivateDeriver: vi.fn(),
  proverSignTransaction: vi.fn(),
  proverSignInputs: vi.fn(),
  lastProver: {
    deriver: undefined as HdKey | undefined,
    from: undefined as unknown,
    useLedger: false,
    changeIndex: 0
  }
}));

vi.mock("@/stores/walletStore", () => ({
  useWalletStore: () => mocks.walletStore
}));

vi.mock("@/stores/appStore", () => ({
  useAppStore: () => ({ settings: { ledger: { transport: "webhid" } } })
}));

vi.mock("@/database/walletsDbService", () => ({
  walletsDbService: { getById: mocks.getWalletById }
}));

vi.mock("@/database/addressesDbService", () => ({
  addressesDbService: { getByWalletId: mocks.getAddressesByWalletId }
}));

vi.mock("./services/graphQlService", () => ({
  graphQLService: {
    getHeaders: mocks.getHeaders,
    checkTransaction: mocks.checkTransaction
  }
}));

vi.mock("./transaction/prover", () => ({
  getPrivateDeriver: mocks.getPrivateDeriver,
  Prover: class {
    constructor(deriver: HdKey) {
      mocks.lastProver.deriver = deriver;
      mocks.lastProver.from = undefined;
      mocks.lastProver.useLedger = false;
      mocks.lastProver.changeIndex = 0;
    }
    from(addresses: unknown) {
      mocks.lastProver.from = addresses;
      return this;
    }
    useLedger(use = true) {
      mocks.lastProver.useLedger = use;
      return this;
    }
    withTransport() {
      return this;
    }
    changeIndex(index: number) {
      mocks.lastProver.changeIndex = index;
      return this;
    }
    setHeaders() {
      return this;
    }
    setSigners() {
      return this;
    }
    setCallback() {
      return this;
    }
    signTransaction = mocks.proverSignTransaction;
    signInputs = mocks.proverSignInputs;
  }
}));

const PK_1 = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const PK_2 = "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const ADDR_1 = ErgoAddress.fromPublicKey(PK_1, Network.Mainnet).toString();
const ADDR_2 = ErgoAddress.fromPublicKey(PK_2, Network.Mainnet).toString();
const TREE_2 = ErgoAddress.decode(ADDR_2).ergoTree;

const WALLET_2: IDbWallet = {
  id: 2,
  name: "Connected Wallet",
  chain: { id: "ergo", network: "mainnet" },
  type: "standard",
  publicKey: PK_2,
  chainCode: "22".repeat(32),
  settings: { avoidAddressReuse: false, addressFilter: "all", defaultChangeIndex: 0 },
  needsBackup: false,
  createdAt: 1_700_000_000_000
};

const ADDRESSES_1: IDbAddress[] = [
  { type: AddressType.P2PK, state: AddressState.Used, script: ADDR_1, index: 0, walletId: 1 }
];

const ADDRESSES_2: IDbAddress[] = [
  { type: AddressType.P2PK, state: AddressState.Used, script: ADDR_2, index: 0, walletId: 2 }
];

const TX: EIP12UnsignedTransaction = {
  inputs: [
    {
      boxId: "aa".repeat(32),
      transactionId: "11".repeat(32),
      index: 0,
      value: "1000000000",
      ergoTree: TREE_2,
      creationHeight: 1_000_000,
      assets: [],
      additionalRegisters: {},
      extension: {}
    }
  ],
  dataInputs: [],
  outputs: [
    {
      value: "998900000",
      ergoTree: TREE_2,
      creationHeight: 1_000_001,
      assets: [],
      additionalRegisters: {}
    }
  ]
};

describe("signTransaction walletId binding", () => {
  beforeEach(() => {
    mocks.walletStore.id = 1;
    mocks.walletStore.type = "standard";
    mocks.walletStore.publicKey = PK_1;
    mocks.getWalletById.mockReset();
    mocks.getAddressesByWalletId.mockReset();
    mocks.getHeaders.mockReset().mockResolvedValue([]);
    mocks.checkTransaction.mockReset();
    mocks.getPrivateDeriver.mockReset().mockResolvedValue({ id: "private-deriver" });
    mocks.proverSignTransaction.mockReset().mockResolvedValue({ id: "signed-tx" });
    mocks.proverSignInputs.mockReset().mockResolvedValue([]);
  });

  it("signs with the explicit walletId instead of the active walletStore wallet", async () => {
    mocks.getWalletById.mockResolvedValue(WALLET_2);
    mocks.getAddressesByWalletId.mockResolvedValue(ADDRESSES_2);

    await signTransaction({ transaction: TX, walletId: 2, password: "secret" });

    expect(mocks.getWalletById).toHaveBeenCalledWith(2);
    expect(mocks.getAddressesByWalletId).toHaveBeenCalledWith(2);
    expect(mocks.getPrivateDeriver).toHaveBeenCalledWith(2, "secret");
    expect(mocks.lastProver.useLedger).toBe(false);
    expect(mocks.lastProver.from).toEqual([
      expect.objectContaining({ script: ADDR_2, walletId: 2 })
    ]);
  });

  it("uses the explicit wallet's ledger type and public key when signing", async () => {
    mocks.getWalletById.mockResolvedValue({ ...WALLET_2, type: "ledger" });
    mocks.getAddressesByWalletId.mockResolvedValue(ADDRESSES_2);

    await signTransaction({ transaction: TX, walletId: 2 });

    expect(mocks.getPrivateDeriver).not.toHaveBeenCalled();
    expect(mocks.lastProver.useLedger).toBe(true);
    expect(hex.encode(mocks.lastProver.deriver!.publicKey)).toBe(PK_2);
  });

  it("throws when the explicit walletId does not exist", async () => {
    mocks.getWalletById.mockResolvedValue(undefined);

    await expect(signTransaction({ transaction: TX, walletId: 99 })).rejects.toThrow(
      "Wallet 'id:99' not found."
    );
    expect(mocks.getPrivateDeriver).not.toHaveBeenCalled();
  });

  it("defaults to walletStore.id when walletId is omitted", async () => {
    mocks.getAddressesByWalletId.mockResolvedValue(ADDRESSES_1);

    await signTransaction({ transaction: TX, password: "secret" });

    expect(mocks.getWalletById).not.toHaveBeenCalled();
    expect(mocks.getAddressesByWalletId).toHaveBeenCalledWith(1);
    expect(mocks.getPrivateDeriver).toHaveBeenCalledWith(1, "secret");
  });
});

describe("ErgoMessage network prefix", () => {
  it("tags serialized and encoded messages with the supplied network", () => {
    const mainnet = ErgoMessage.fromData("hello nautilus", Network.Mainnet);
    const testnet = ErgoMessage.fromData("hello nautilus", Network.Testnet);

    expect(mainnet.network).toBe(Network.Mainnet);
    expect(testnet.network).toBe(Network.Testnet);
    expect(mainnet.serialize().toBytes()[1]).toBe(Network.Mainnet);
    expect(testnet.serialize().toBytes()[1]).toBe(Network.Testnet);
    expect(testnet.encode()).not.toBe(mainnet.encode());
  });
});
