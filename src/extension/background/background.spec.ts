import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalEvent, InternalRequest } from "../connector/rpc/protocol";

type Handler = (msg: { data?: unknown; sender: { tabId: number } }) => Promise<unknown>;
type RemovedListener = (windowId: number) => void;

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  removedListeners: new Set<(windowId: number) => void>(),
  sendMessage: vi.fn(),
  createWindow: vi.fn(),
  checkConnection: vi.fn(),
  getByOrigin: vi.fn(),
  getByScript: vi.fn(),
  getPlatformInfo: vi.fn()
}));

vi.mock("webext-bridge", () => ({ isInternalEndpoint: () => true }));

vi.mock("webext-bridge/background", () => ({
  onMessage: (id: string, handler: Handler) => mocks.handlers.set(id, handler),
  sendMessage: mocks.sendMessage
}));

vi.mock("@/common/browser", () => ({
  browser: {
    runtime: { getPlatformInfo: mocks.getPlatformInfo },
    tabs: { get: async () => ({ favIconUrl: "favicon.png" }) },
    windows: {
      onRemoved: {
        addListener: (fn: RemovedListener) => mocks.removedListeners.add(fn),
        removeListener: (fn: RemovedListener) => mocks.removedListeners.delete(fn)
      }
    }
  }
}));

vi.mock("@/common/uiHelpers", () => ({ createWindow: mocks.createWindow }));
vi.mock("@/chains/ergo/services/graphQlService", () => ({ graphQLService: {} }));
vi.mock("@/database/addressesDbService", () => ({
  addressesDbService: { getByScript: mocks.getByScript }
}));
vi.mock("@/database/connectedDAppsDbService", () => ({
  connectedDAppsDbService: { getByOrigin: mocks.getByOrigin }
}));
vi.mock("./ergoHandlers", () => ({ checkConnection: mocks.checkConnection }));

// transactions are represented by plain strings in these tests
vi.mock("@fleet-sdk/serializer", () => ({
  serializeTransaction: (tx: unknown) => {
    if (typeof tx !== "string") throw new Error("Invalid transaction");
    return { toBytes: () => new TextEncoder().encode(tx) };
  }
}));

const ORIGIN = "dapp.io";
const TAB_ID = 1;
const WALLET_ID = 1;
const ADDRESS = "9f";

let windowId = 0;

beforeEach(async () => {
  vi.resetModules();
  mocks.handlers.clear();
  mocks.removedListeners.clear();
  mocks.sendMessage.mockReset();
  mocks.createWindow.mockReset().mockImplementation(async () => ({ id: ++windowId }));
  mocks.checkConnection.mockReset().mockResolvedValue(false);
  mocks.getByOrigin.mockReset().mockResolvedValue({ origin: ORIGIN, walletId: WALLET_ID });
  mocks.getPlatformInfo.mockReset();
  mocks.getByScript.mockReset().mockResolvedValue({ script: ADDRESS, walletId: WALLET_ID });

  await import("./background");
});

function request(type: InternalRequest, data: Record<string, unknown> = {}, origin = ORIGIN) {
  const handler = mocks.handlers.get(type)!;
  return handler({ data: { ...data, payload: { origin } }, sender: { tabId: TAB_ID } });
}

function signTx(transaction: unknown) {
  return request(InternalRequest.SignTx, { transaction });
}

/** Simulates the connector window loading and answering the pending request. */
async function load(result: unknown) {
  mocks.sendMessage.mockResolvedValueOnce(result);
  await mocks.handlers.get(InternalEvent.Loaded)!({ sender: { tabId: TAB_ID } });
}

function close(id: number) {
  for (const listener of [...mocks.removedListeners]) listener(id);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("connector window queueing", () => {
  it("should open only one window for concurrent requests", async () => {
    signTx("tx1");
    signTx("tx2");
    signTx("tx3");
    await flush();

    expect(mocks.createWindow).toHaveBeenCalledOnce();
  });

  it("should open the next window only after the current one is closed", async () => {
    const first = signTx("tx1");
    const second = signTx("tx2");
    await flush();

    await load("signed1");
    await expect(first).resolves.toBe("signed1");

    // the first window answered but is still open
    await flush();
    expect(mocks.createWindow).toHaveBeenCalledOnce();

    close(windowId);
    await flush();
    expect(mocks.createWindow).toHaveBeenCalledTimes(2);

    await load("signed2");
    close(windowId);
    await expect(second).resolves.toBe("signed2");
  });

  it("should deliver each request to its own window in order", async () => {
    const results = [signTx("tx1"), signTx("tx2"), signTx("tx3")];

    for (let i = 1; i <= 3; i++) {
      await flush();
      await load(`signed${i}`);
      close(windowId);
    }

    await expect(Promise.all(results)).resolves.toEqual(["signed1", "signed2", "signed3"]);

    const transactions = mocks.sendMessage.mock.calls.map(([, data]) => data.transaction);
    expect(transactions).toEqual(["tx1", "tx2", "tx3"]);
    for (const [type, , destination] of mocks.sendMessage.mock.calls) {
      expect(type).toBe(InternalRequest.SignTx);
      expect(destination).toBe("popup");
    }
  });

  it("should queue requests of different types", async () => {
    const tx = signTx("tx");
    const auth = request(InternalRequest.Auth, { address: ADDRESS, message: "hi" });
    const data = request(InternalRequest.SignData, { address: ADDRESS, message: "hi" });
    await flush();

    expect(mocks.createWindow).toHaveBeenCalledOnce();

    await load("signed");
    close(windowId);
    await flush();
    await load("auth");
    close(windowId);
    await flush();
    await load("data");
    close(windowId);

    await expect(Promise.all([tx, auth, data])).resolves.toEqual(["signed", "auth", "data"]);
    expect(mocks.sendMessage.mock.calls.map(([type]) => type)).toEqual([
      InternalRequest.SignTx,
      InternalRequest.Auth,
      InternalRequest.SignData
    ]);
  });

  it("should reject the request and move on if the window is closed before loading", async () => {
    const first = signTx("tx1");
    const second = signTx("tx2");
    await flush();

    close(windowId);
    await expect(first).rejects.toThrow("Connector window closed.");

    await flush();
    expect(mocks.createWindow).toHaveBeenCalledTimes(2);

    await load("signed2");
    close(windowId);
    await expect(second).resolves.toBe("signed2");
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
  });

  it("should ignore unrelated windows being closed", async () => {
    signTx("tx1");
    signTx("tx2");
    await flush();

    close(windowId + 100);
    await flush();

    expect(mocks.createWindow).toHaveBeenCalledOnce();
  });

  it("should release the queue if the window fails to open", async () => {
    mocks.createWindow.mockRejectedValueOnce(new Error("failed to open"));

    const first = signTx("tx1");
    const second = signTx("tx2");

    await expect(first).rejects.toThrow("failed to open");
    await flush();
    expect(mocks.createWindow).toHaveBeenCalledTimes(2);

    await load("signed2");
    close(windowId);
    await expect(second).resolves.toBe("signed2");
  });

  it("should not deliver anything if there are no pending requests", async () => {
    await mocks.handlers.get(InternalEvent.Loaded)!({ sender: { tabId: TAB_ID } });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});

describe("identical requests", () => {
  it("should share the result of a pending connect request", async () => {
    const results = [request(InternalRequest.Connect), request(InternalRequest.Connect)];
    await flush();

    await load(false);
    close(windowId);

    await expect(Promise.all(results)).resolves.toEqual([false, false]);
    expect(mocks.createWindow).toHaveBeenCalledOnce();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
  });

  it("should share the result of a pending signing request", async () => {
    const results = [signTx("tx"), signTx("tx"), signTx("tx")];
    await flush();

    await load("signed");
    close(windowId);

    await expect(Promise.all(results)).resolves.toEqual(["signed", "signed", "signed"]);
    expect(mocks.createWindow).toHaveBeenCalledOnce();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
  });

  it("should share the result while queued behind another request", async () => {
    const other = signTx("tx1");
    const results = [signTx("tx2"), signTx("tx2")];
    await flush();

    await load("signed1");
    close(windowId);
    await flush();
    await load("signed2");
    close(windowId);

    await expect(other).resolves.toBe("signed1");
    await expect(Promise.all(results)).resolves.toEqual(["signed2", "signed2"]);
    expect(mocks.createWindow).toHaveBeenCalledTimes(2);
  });

  it("should share rejections", async () => {
    const results = [signTx("tx"), signTx("tx")];
    await flush();

    close(windowId);

    for (const result of results) await expect(result).rejects.toThrow("Connector window closed.");
    expect(mocks.createWindow).toHaveBeenCalledOnce();
  });

  it("should not share results across origins", async () => {
    const first = request(InternalRequest.Connect, {}, "a.io");
    const second = request(InternalRequest.Connect, {}, "b.io");
    await flush();

    await load(true);
    close(windowId);
    await flush();
    await load(false);
    close(windowId);

    await expect(Promise.all([first, second])).resolves.toEqual([true, false]);
    expect(mocks.createWindow).toHaveBeenCalledTimes(2);
  });

  it("should not share results across request types", async () => {
    const args = { address: ADDRESS, message: "hi" };
    const auth = request(InternalRequest.Auth, args);
    const data = request(InternalRequest.SignData, args);
    await flush();

    await load("auth");
    close(windowId);
    await flush();
    await load("data");
    close(windowId);

    await expect(Promise.all([auth, data])).resolves.toEqual(["auth", "data"]);
  });

  it("should prompt again for an identical request made after the first settled", async () => {
    const first = signTx("tx");
    await flush();
    await load("refused");
    await expect(first).resolves.toBe("refused");
    close(windowId);

    const second = signTx("tx");
    await flush();
    expect(mocks.createWindow).toHaveBeenCalledTimes(2);

    await load("signed");
    close(windowId);
    await expect(second).resolves.toBe("signed");
  });
});

describe("service worker keep alive", () => {
  afterEach(() => vi.useRealTimers());

  it("should keep the worker alive only while requests are pending", async () => {
    vi.useFakeTimers();

    const first = signTx("tx1");
    const second = signTx("tx2");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getPlatformInfo).toHaveBeenCalledTimes(3);

    await load("signed1");
    close(windowId);
    await expect(first).resolves.toBe("signed1");

    // the second request is still pending
    mocks.getPlatformInfo.mockClear();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.getPlatformInfo).toHaveBeenCalledOnce();

    await load("signed2");
    close(windowId);
    await expect(second).resolves.toBe("signed2");

    mocks.getPlatformInfo.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getPlatformInfo).not.toHaveBeenCalled();
  });

  it("should not keep the worker alive for requests that don't open a window", async () => {
    vi.useFakeTimers();

    await signTx({ inputs: "invalid" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getPlatformInfo).not.toHaveBeenCalled();
  });
});

describe("transaction validation", () => {
  it("should reject transactions that can't be serialized without opening a window", async () => {
    await expect(signTx({ inputs: "invalid" })).resolves.toEqual({
      success: false,
      error: { code: -1, info: "Invalid transaction." }
    });
    expect(mocks.createWindow).not.toHaveBeenCalled();
  });
});
