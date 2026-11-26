import { reactive } from "vue";
import type { BoxView, Key, SubscriptionState } from "@hergmes/sdk";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "./relayStore";

const mocks = vi.hoisted(() => ({
  relays: [] as unknown[],
  settings: undefined as unknown as { relayUrl: string }
}));

const VIEW = {
  lastChange: { height: 1, headerId: "h" },
  confirmed: [],
  pending: [],
  spendable: []
};

class FakeRelay {
  readonly subscriptions: { key: Key; close: ReturnType<typeof vi.fn> }[] = [];
  /** The state each new subscription starts in. */
  state: Partial<SubscriptionState> = { phase: "live", boxes: VIEW as unknown as BoxView };

  constructor() {
    mocks.relays.push(this);
  }

  subscribe(key: Key) {
    const state = this.state as SubscriptionState;
    const subscription = {
      key,
      state,
      close: vi.fn(),
      subscribe: (listener: (s: SubscriptionState) => void) => {
        listener(state);
        return () => {};
      }
    };
    this.subscriptions.push(subscription);
    return subscription;
  }

  close() {}
}

// the class is read only once a relay is built, after this file's top level has run
vi.mock("@hergmes/sdk", () => ({
  Relay: function () {
    return new FakeRelay();
  }
}));
vi.mock("./appStore", () => ({ useAppStore: () => ({ settings: mocks.settings }) }));
vi.mock("@/chains/ergo/services/hergmesService", () => ({
  isSupportedRelayVersion: () => true,
  NO_RELAY_MESSAGE: "No relay server is set. Set one in settings."
}));

const KEY = { template: "d803" };

describe("readBoxes", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.relays = [];
    mocks.settings = reactive({ relayUrl: "https://relay.test" });
  });

  it("keeps the key held, so later reads reuse its subscription", async () => {
    const store = useRelayStore();

    await store.readBoxes(KEY);
    await store.readBoxes(KEY);

    const [relay] = mocks.relays as FakeRelay[];
    expect(relay.subscriptions).toHaveLength(1);
    expect(relay.subscriptions[0].close).not.toHaveBeenCalled();
  });

  it("lets a refused key go, so the next read tries again", async () => {
    const store = useRelayStore();
    expect(store.relay).toBeDefined(); // builds the relay
    const [relay] = mocks.relays as FakeRelay[];
    relay.state = { phase: "rejected", error: { code: "x", message: "refused" } };

    await expect(store.readBoxes(KEY)).rejects.toThrow("refused");
    expect(relay.subscriptions[0].close).toHaveBeenCalled();

    relay.state = { phase: "live", boxes: VIEW as unknown as BoxView };
    await store.readBoxes(KEY);
    expect(relay.subscriptions).toHaveLength(2);
  });

  it("subscribes again to a key refused while no read waited on it", async () => {
    const store = useRelayStore();
    await store.readBoxes(KEY);
    const [relay] = mocks.relays as FakeRelay[];
    const held = relay.subscriptions[0] as unknown as { state: Partial<SubscriptionState> };
    held.state = { phase: "rejected", error: { code: "x", message: "refused" } };

    await store.readBoxes(KEY);

    expect(relay.subscriptions[0].close).toHaveBeenCalled();
    expect(relay.subscriptions).toHaveLength(2);
  });

  it("holds the key again on a new relay", async () => {
    const store = useRelayStore();

    await store.readBoxes(KEY);
    mocks.settings.relayUrl = "https://other.test";
    await store.readBoxes(KEY);

    const [first, second] = mocks.relays as FakeRelay[];
    expect(first.subscriptions).toHaveLength(1);
    expect(second.subscriptions).toHaveLength(1);
  });

  it("throws with no relay set", async () => {
    mocks.settings.relayUrl = "";
    await expect(useRelayStore().readBoxes(KEY)).rejects.toThrow("No relay server is set");
  });
});
