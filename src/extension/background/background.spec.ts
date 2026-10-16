import { beforeEach, describe, expect, it, vi } from "vitest";
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
  getByScript: vi.fn()
}));

vi.mock("webext-bridge", () => ({ isInternalEndpoint: () => true }));

vi.mock("webext-bridge/background", () => ({
  onMessage: (id: string, handler: Handler) => mocks.handlers.set(id, handler),
  sendMessage: mocks.sendMessage
}));

vi.mock("@/common/browser", () => ({
  browser: {
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
  mocks.getByScript.mockReset().mockResolvedValue({ script: ADDRESS, walletId: WALLET_ID });

  await import("./background");
});

function request(type: InternalRequest, data: Record<string, unknown> = {}) {
  const handler = mocks.handlers.get(type)!;
  return handler({ data: { ...data, payload: { origin: ORIGIN } }, sender: { tabId: TAB_ID } });
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

  it("should not open a window for queued connect requests once connected", async () => {
    const first = request(InternalRequest.Connect);
    const second = request(InternalRequest.Connect);
    await flush();

    expect(mocks.createWindow).toHaveBeenCalledOnce();

    await load(true);
    mocks.checkConnection.mockResolvedValue(true);
    close(windowId);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(mocks.createWindow).toHaveBeenCalledOnce();
  });

  it("should open a window for queued connect requests if the first was refused", async () => {
    const first = request(InternalRequest.Connect);
    const second = request(InternalRequest.Connect);
    await flush();

    await load(false);
    close(windowId);
    await flush();

    expect(mocks.createWindow).toHaveBeenCalledTimes(2);

    await load(true);
    close(windowId);
    await expect(Promise.all([first, second])).resolves.toEqual([false, true]);
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
