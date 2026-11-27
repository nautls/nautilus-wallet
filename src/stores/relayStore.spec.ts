import { reactive } from "vue";
import type { ClientMessage } from "@hergmes/sdk";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockSocket } from "../../tests/unit/mocks/relaySocket";
import { useRelayStore } from "./relayStore";

const mocks = vi.hoisted(() => ({ settings: undefined as unknown as { relayUrl: string } }));

vi.mock("./appStore", () => ({ useAppStore: () => ({ settings: mocks.settings }) }));
vi.mock("@/chains/ergo/services/hergmesService", () => ({
  isSupportedRelayVersion: () => true,
  NO_RELAY_MESSAGE: "No relay server is set. Set one in settings."
}));

const KEY = { template: "d803" };
const AS_OF = { height: 1, headerId: "h" };

/** Takes the key, as the relay does: `subscribed`, then the mempool's effect on it. */
function accept(message: ClientMessage, socket: MockSocket) {
  if (message.op !== "subscribe") return;
  socket.receive({ type: "subscribed", id: message.id, key: message.key });
  socket.receive({ type: "mempool", key: message.key, lastChange: message.from, pending: [] });
}

function refuse(message: ClientMessage, socket: MockSocket) {
  if (message.op !== "subscribe") return;
  socket.receive({ type: "rejected", id: message.id, key: message.key, reason: "too_many_boxes" });
}

const ops = (op: ClientMessage["op"], sent = MockSocket.sent) =>
  sent.filter((m) => m.op === op).length;

describe("readBoxes", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.settings = reactive({ relayUrl: "https://relay.test" });
    MockSocket.install();
    MockSocket.respond = accept;
    // the key's snapshot, read over REST before it subscribes
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ asOf: AS_OF, items: [], nextCursor: null }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the key held, so later reads reuse its subscription", async () => {
    const store = useRelayStore();

    await store.readBoxes(KEY);
    await store.readBoxes(KEY);

    expect(ops("subscribe")).toBe(1);
    expect(ops("unsubscribe")).toBe(0);
  });

  it("lets a refused key go, so the next read tries again", async () => {
    const store = useRelayStore();
    MockSocket.respond = refuse;

    await expect(store.readBoxes(KEY)).rejects.toThrow("too_many_boxes");
    expect(ops("unsubscribe")).toBe(1);

    MockSocket.respond = accept;
    await store.readBoxes(KEY);
    expect(ops("subscribe")).toBe(2);
  });

  it("subscribes again to a key refused while no read waited on it", async () => {
    const store = useRelayStore();
    await store.readBoxes(KEY);
    MockSocket.last.receive({ type: "rejected", key: KEY, reason: "too_many_boxes" });

    await store.readBoxes(KEY);

    expect(ops("unsubscribe")).toBe(1);
    expect(ops("subscribe")).toBe(2);
  });

  it("holds the key again on a new relay", async () => {
    const store = useRelayStore();

    await store.readBoxes(KEY);
    mocks.settings.relayUrl = "https://other.test";
    await store.readBoxes(KEY);

    const [first, second] = MockSocket.sockets;
    expect(MockSocket.sockets.map((s) => new URL(s.url).host)).toEqual([
      "relay.test",
      "other.test"
    ]);
    expect(ops("subscribe", first.sent)).toBe(1);
    expect(ops("subscribe", second.sent)).toBe(1);
  });

  it("throws with no relay set", async () => {
    mocks.settings.relayUrl = "";
    await expect(useRelayStore().readBoxes(KEY)).rejects.toThrow("No relay server is set");
  });
});
