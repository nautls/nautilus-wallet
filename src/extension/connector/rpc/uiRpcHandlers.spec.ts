import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalRequest } from "./protocol";
import { isFromBackground, queue, registerRpcHooks } from "./uiRpcHandlers";

type Handler = (msg: { data: unknown; sender: { context: string } }) => Promise<unknown>;

const { handlers, replace } = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  replace: vi.fn()
}));

vi.mock("webext-bridge/popup", () => ({
  onMessage: (id: string, handler: Handler) => handlers.set(id, handler),
  sendMessage: vi.fn()
}));

vi.mock("../router", () => ({ router: { replace } }));

const REQUESTS = [
  InternalRequest.Connect,
  InternalRequest.Auth,
  InternalRequest.SignTx,
  InternalRequest.SignData,
  InternalRequest.SignTxInputs
];

const data = { payload: { origin: "victim-dapp.io", favicon: "fake.png" } };

beforeAll(() => {
  registerRpcHooks();
});

beforeEach(() => {
  replace.mockReset();
  while (queue.some()) queue.pop();
});

describe("isFromBackground", () => {
  it("should only accept the background context", () => {
    expect(isFromBackground({ context: "background" })).toBe(true);

    for (const context of ["window", "content-script", "popup", "options", "devtools"] as const) {
      expect(isFromBackground({ context })).toBe(false);
    }
  });
});

describe("connector rpc handlers", () => {
  it("should register a handler for every request type", () => {
    for (const request of REQUESTS) expect(handlers.has(request)).toBe(true);
  });

  it.each(REQUESTS)("%s should reject messages relayed from web pages", async (request) => {
    for (const context of ["window", "content-script"]) {
      expect(() => handlers.get(request)!({ data, sender: { context } })).toThrow();
    }

    expect(queue.some()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(REQUESTS)("%s should queue messages from the background", async (request) => {
    handlers.get(request)!({ data, sender: { context: "background" } });

    const queued = queue.pop(request as InternalRequest.Auth);
    expect(queued).toMatchObject({ type: request, origin: "victim-dapp.io", data });
    expect(replace).toHaveBeenCalledOnce();
  });
});
