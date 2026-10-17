import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalRequest, InternalRequest } from "../connector/rpc/protocol";

type Handler = (msg: { data: unknown }) => Promise<unknown>;

const { handlers, sendMessage } = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  sendMessage: vi.fn()
}));

vi.mock("webext-bridge/content-script", () => ({
  allowWindowMessaging: vi.fn(),
  onMessage: (id: string, handler: Handler) => handlers.set(id, handler),
  sendMessage
}));

const ORIGIN = "attacker.io";
const SPOOFED_PAYLOAD = { origin: "victim-dapp.io", favicon: "https://attacker.io/fake.png" };

beforeAll(async () => {
  const element = { nodeName: "HTML" };
  const parent = { appendChild: vi.fn(), removeChild: vi.fn() };
  const document = {
    documentElement: element,
    doctype: null,
    head: parent,
    createElement: () => ({})
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", { document, addEventListener: vi.fn() });
  vi.stubGlobal("location", { origin: `https://${ORIGIN}` });
  vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => path } });

  await import("./contentScript");
});

beforeEach(() => {
  sendMessage.mockReset();
});

describe("content script request forwarding", () => {
  const cases: [ExternalRequest, InternalRequest, Record<string, unknown>][] = [
    [ExternalRequest.GetUTxOs, InternalRequest.GetUTxOs, { target: { nanoErgs: "1" } }],
    [ExternalRequest.GetBalance, InternalRequest.GetBalance, { tokenId: "ERG" }],
    [ExternalRequest.SubmitTransaction, InternalRequest.SubmitTransaction, { transaction: {} }],
    [ExternalRequest.SignData, InternalRequest.SignData, { address: "9f", message: "hi" }],
    [ExternalRequest.Auth, InternalRequest.Auth, { address: "9f", message: "hi" }],
    [ExternalRequest.SignTx, InternalRequest.SignTx, { transaction: {} }],
    [ExternalRequest.SignTxInputs, InternalRequest.SignTxInputs, { transaction: {}, indexes: [0] }]
  ];

  it.each(cases)("%s should not let the page override the payload", async (ext, int, args) => {
    await handlers.get(ext)!({ data: { ...args, payload: SPOOFED_PAYLOAD } });

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      int,
      { ...args, payload: { origin: ORIGIN } },
      "background"
    );
  });

  it.each(cases)("%s should drop unexpected fields", async (ext, int, args) => {
    await handlers.get(ext)!({ data: { ...args, favicon: "x", foo: "bar" } });

    expect(sendMessage).toHaveBeenCalledWith(
      int,
      { ...args, payload: { origin: ORIGIN } },
      "background"
    );
  });

  it.each(cases)("%s should handle non-object data", async (ext, int) => {
    for (const data of [undefined, null, "payload", 1]) {
      sendMessage.mockReset();
      await handlers.get(ext)!({ data });

      expect(sendMessage).toHaveBeenCalledWith(int, { payload: { origin: ORIGIN } }, "background");
    }
  });

  it("should not read inherited fields", async () => {
    const data = Object.create({ tokenId: "inherited", payload: SPOOFED_PAYLOAD });
    await handlers.get(ExternalRequest.GetBalance)!({ data });

    expect(sendMessage).toHaveBeenCalledWith(
      InternalRequest.GetBalance,
      { payload: { origin: ORIGIN } },
      "background"
    );
  });

  it("should always use the page origin for requests without data", async () => {
    for (const [ext, int] of [
      [ExternalRequest.Connect, InternalRequest.Connect],
      [ExternalRequest.CheckConnection, InternalRequest.CheckConnection],
      [ExternalRequest.Disconnect, InternalRequest.Disconnect],
      [ExternalRequest.GetCurrentHeight, InternalRequest.GetCurrentHeight]
    ]) {
      sendMessage.mockReset();
      await handlers.get(ext)!({ data: { payload: SPOOFED_PAYLOAD } });

      expect(sendMessage).toHaveBeenCalledWith(int, { payload: { origin: ORIGIN } }, "background");
    }
  });

  it("should wrap address filter without spreading page data", async () => {
    await handlers.get(ExternalRequest.GetAddresses)!({ data: { payload: SPOOFED_PAYLOAD } });

    expect(sendMessage).toHaveBeenCalledWith(
      InternalRequest.GetAddresses,
      { payload: { origin: ORIGIN }, filter: { payload: SPOOFED_PAYLOAD } },
      "background"
    );
  });
});
