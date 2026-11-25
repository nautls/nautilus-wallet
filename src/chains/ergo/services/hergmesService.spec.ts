import type { SignedTransaction } from "@fleet-sdk/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";
import HdKey from "../hdKey";
import { Prover } from "../transaction/prover";
import e2eHeaders from "../../../../tests/e2e/fixtures/data/headers.json";
import relayHeaders from "./fixtures/relayHeaders.json";
import {
  checkTransaction,
  getAssetsMetadata,
  getBalances,
  getHeaders,
  getHeight,
  getSpendableBoxes,
  isSupportedRelayVersion,
  submitTransaction
} from "./hergmesService";

const mocks = vi.hoisted(() => ({
  relayUrl: "https://relay.test",
  fetch: vi.fn<typeof fetch>(),
  containsAtLeastOneOf: vi.fn<(ids: string[]) => Promise<boolean>>(async () => false),
  addFromTx: vi.fn<(tx: SignedTransaction, walletId: number) => Promise<void>>(async () => {})
}));

vi.mock("@/extension/background/settings", () => ({
  getSettings: async () => ({ relayUrl: mocks.relayUrl })
}));
vi.mock("@/database/utxosDbService", () => ({
  utxosDbService: { containsAtLeastOneOf: mocks.containsAtLeastOneOf, addFromTx: mocks.addFromTx }
}));
vi.mock("@/database/walletsDbService", () => ({ walletsDbService: {} }));
vi.mock("@/common/ledger", () => ({ createTransport: vi.fn() }));

const MNEMONIC =
  "decline usual reward fine flight vintage deny slight minimum spirit hero aerobic loan peanut feel";
const MISSING_INPUTS =
  "Malformed transaction: Every input of the transaction should be in UTXO. Input 0 is missing";
const BOX = {
  boxId: "a".repeat(64),
  transactionId: "b".repeat(64),
  index: 0,
  value: "1000000000",
  ergoTree: "0008cd03",
  creationHeight: 100,
  assets: [],
  additionalRegisters: {}
};

type Reply = { status?: number; body: unknown };
let replies: Map<string, Reply[]>;

/** Answers each `METHOD /path` from its queue, the last reply repeating. */
function reply(route: string, ...queue: Reply[]) {
  replies.set(route, queue);
}

const json = (body: unknown, status = 200): Reply => ({ body, status });
const refused = (message: string): Reply =>
  json({ error: "transaction_rejected", reason: "invalid", message }, 400);

beforeEach(() => {
  replies = new Map();
  mocks.relayUrl = "https://relay.test";
  mocks.fetch.mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const route = `${init?.method ?? "GET"} ${url.pathname}`;
    const queue = replies.get(route);
    if (!queue) return new Response("not mocked", { status: 404 });

    const next = queue.length > 1 ? queue.shift()! : queue[0];
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" }
    });
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("headers", () => {
  it("should be accepted by the prover as the relay serves them", async () => {
    reply("GET /v1/headers", json(relayHeaders));

    const headers = await getHeaders();
    const prover = new Prover(await HdKey.fromMnemonic(MNEMONIC));

    expect(headers).toHaveLength(10);
    expect(() => prover.setHeaders(headers)).not.toThrow();
  });

  it("should be refused by the prover in another shape", async () => {
    const prover = new Prover(await HdKey.fromMnemonic(MNEMONIC));
    const [header] = relayHeaders.items;
    const { id, ...withoutId } = header;

    expect(() => prover.setHeaders([{ ...withoutId, headerId: id }] as never)).toThrow();
  });

  it("should accept the e2e fixture, which mocks the relay", async () => {
    const prover = new Prover(await HdKey.fromMnemonic(MNEMONIC));
    expect(() => prover.setHeaders(e2eHeaders.items as never)).not.toThrow();
  });
});

describe("height", () => {
  it("should be the relay's tip", async () => {
    reply(
      "GET /v1/status",
      json({ version: "0.2.0", network: "mainnet", tip: { height: 7, headerId: "f" }, ready: true })
    );
    expect(await getHeight()).toBe(7);
  });

  it("should be undefined before the relay applied a block", async () => {
    reply(
      "GET /v1/status",
      json({ version: "0.2.0", network: "mainnet", tip: null, ready: false })
    );
    expect(await getHeight()).toBeUndefined();
  });

  it("should be undefined with no relay set", async () => {
    mocks.relayUrl = "";
    expect(await getHeight()).toBeUndefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("token metadata", () => {
  it("should map EIP-4 tokens", async () => {
    reply(
      "GET /v1/tokens/metadata",
      json({
        items: [
          {
            tokenId: "t1",
            mintingTxId: "m1",
            emission: "1",
            standard: "eip-4",
            metadata: {
              name: "Art",
              description: "",
              decimals: 0,
              type: "nft-picture",
              artworkHash: "ab",
              artworkUrl: "https://art"
            }
          }
        ]
      })
    );

    expect(await getAssetsMetadata(["t1"])).toEqual([
      {
        id: "t1",
        mintingBoxId: "",
        mintingTransactionId: "m1",
        emissionAmount: "1",
        standard: AssetStandard.EIP4,
        name: "Art",
        description: undefined,
        decimals: 0,
        type: AssetType.NFT,
        subtype: AssetSubtype.PictureArtwork,
        artworkHash: "ab",
        artworkUrl: "https://art",
        artworkCover: undefined
      }
    ]);
  });

  it("should map tokens of no standard with no decimals", async () => {
    reply(
      "GET /v1/tokens/metadata",
      json({ items: [{ tokenId: "t2", mintingTxId: "m2", emission: "500", standard: "none" }] })
    );

    expect(await getAssetsMetadata(["t2"])).toEqual([
      {
        id: "t2",
        mintingBoxId: "",
        mintingTransactionId: "m2",
        emissionAmount: "500",
        standard: AssetStandard.Unstandardized,
        decimals: 0,
        type: AssetType.Unknown
      }
    ]);
  });

  it("should be undefined when nothing is known or the request fails", async () => {
    reply("GET /v1/tokens/metadata", json({ items: [] }));
    expect(await getAssetsMetadata(["t3"])).toBeUndefined();

    reply("GET /v1/tokens/metadata", json({ error: "node_error", message: "down" }, 502));
    expect(await getAssetsMetadata(["t3"])).toBeUndefined();
  });
});

describe("submitTransaction", () => {
  const tx: SignedTransaction = {
    id: "d".repeat(64),
    inputs: [{ boxId: BOX.boxId, spendingProof: { proofBytes: "", extension: {} } }],
    dataInputs: [],
    outputs: []
  };

  it("should record the tx as pending for the wallet", async () => {
    reply("POST /v1/transactions", json({ transactionId: "id" }));

    await expect(submitTransaction(tx, 1)).resolves.toEqual({ transactionId: "id" });
    expect(mocks.addFromTx).toHaveBeenCalledWith(tx, 1);
  });

  it("should report a sent tx as sent even if tracking it locally fails", async () => {
    reply("POST /v1/transactions", json({ transactionId: "id" }));
    mocks.addFromTx.mockRejectedValueOnce(new Error("QuotaExceededError"));

    await expect(submitTransaction(tx, 1)).resolves.toEqual({ transactionId: "id" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("should fail at once with the node's message", async () => {
    reply("POST /v1/transactions", refused(MISSING_INPUTS));

    await expect(submitTransaction(tx, 1)).rejects.toThrow(MISSING_INPUTS);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.addFromTx).not.toHaveBeenCalled();
  });

  it("should retry a tx spending pending outputs while its inputs are unknown", async () => {
    vi.useFakeTimers();
    mocks.containsAtLeastOneOf.mockResolvedValueOnce(true);
    reply(
      "POST /v1/transactions",
      refused(MISSING_INPUTS),
      refused(MISSING_INPUTS),
      json({ transactionId: "c" })
    );

    const result = submitTransaction(tx, 1);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ transactionId: "c" });
    expect(mocks.containsAtLeastOneOf).toHaveBeenCalledWith([BOX.boxId]);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.addFromTx).toHaveBeenCalledOnce();
  });

  it("should not retry other refusals", async () => {
    vi.useFakeTimers();
    mocks.containsAtLeastOneOf.mockResolvedValueOnce(true);
    reply("POST /v1/transactions", refused("Double spending attempt"));

    const result = expect(submitTransaction(tx, 1)).rejects.toThrow("Double spending attempt");
    await vi.runAllTimersAsync();

    await result;
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("should only check the tx, with no broadcast", async () => {
    reply("POST /v1/transactions", json({ transactionId: "id" }));

    await checkTransaction(tx);

    const [input] = mocks.fetch.mock.calls[0];
    expect(new URL(input.toString()).searchParams.get("broadcast")).toBe("false");
    expect(mocks.addFromTx).not.toHaveBeenCalled();
  });
});

describe("getSpendableBoxes", () => {
  beforeEach(() => {
    reply(
      "GET /v1/addresses/addr1/boxes/spendable",
      json({
        asOf: { height: 10 },
        items: [
          { ...BOX, inclusionHeight: 9 },
          { ...BOX, boxId: "c".repeat(64) }
        ],
        truncated: false,
        total: 2
      })
    );
    reply(
      "GET /v1/addresses/addr2/boxes/spendable",
      json({ asOf: { height: 10 }, items: [], truncated: false, total: 0 })
    );
  });

  it("should flag mempool outputs as unconfirmed", async () => {
    const boxes = await getSpendableBoxes(["addr1", "addr2"]);

    expect(boxes).toEqual([
      { ...BOX, confirmed: true },
      { ...BOX, boxId: "c".repeat(64), confirmed: false }
    ]);
  });
});

describe("isSupportedRelayVersion", () => {
  it.each(["0.2.0", "0.2.1", "0.10.0", "1.0.0", "0.2.0-rc.1"])("should accept %s", (v) => {
    expect(isSupportedRelayVersion(v)).toBe(true);
  });

  it.each(["0.1.9", "0.1.10", "0.0.1", "unknown", ""])("should refuse %s", (v) => {
    expect(isSupportedRelayVersion(v)).toBe(false);
  });
});

describe("getBalances", () => {
  it("should add pending to confirmed across addresses, leaving out spent tokens", async () => {
    reply(
      "GET /v1/addresses/addr1/balance",
      json({
        asOf: { height: 10 },
        confirmed: { nanoErgs: "1000", tokens: [{ tokenId: "t1", amount: "5" }] },
        pending: { nanoErgs: "-300", tokens: [{ tokenId: "t1", amount: "-5" }] },
        used: true
      })
    );
    reply(
      "GET /v1/addresses/addr2/balance",
      json({
        asOf: { height: 10 },
        confirmed: { nanoErgs: "0", tokens: [] },
        pending: { nanoErgs: "250", tokens: [{ tokenId: "t2", amount: "3" }] },
        used: true
      })
    );

    expect(await getBalances(["addr1", "addr2"])).toEqual({
      nanoErgs: 950n,
      tokens: new Map([["t2", 3n]])
    });
  });
});
