import { nextTick, reactive } from "vue";
import type { Box } from "@fleet-sdk/common";
import { ErgoAddress } from "@fleet-sdk/core";
import type { BoxView, Key, SubscriptionState } from "@hergmes/sdk";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { useBoxesStore } from "./boxesStore";

const A0 = ErgoAddress.fromPublicKey(
  "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
);
const A1 = ErgoAddress.fromPublicKey(
  "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5"
);

class FakeRelay {
  readonly states = new Map<string, SubscriptionState>();
  readonly listeners = new Map<string, Set<(s: SubscriptionState) => void>>();

  subscribe(key: Key) {
    const address = (key as { address: string }).address;
    const listeners = this.listeners.get(address) ?? new Set();
    this.listeners.set(address, listeners);
    if (!this.states.has(address))
      this.states.set(address, { phase: "snapshot" } as SubscriptionState);

    return {
      key,
      get state() {
        return relay.states.get(address)!;
      },
      subscribe(listener: (s: SubscriptionState) => void) {
        listeners.add(listener);
        listener(relay.states.get(address)!);
        return () => listeners.delete(listener);
      },
      close: vi.fn()
    };
  }

  /** Sets the address's live view, as one relay message would. */
  push(address: ErgoAddress, view: Partial<BoxView>) {
    const script = address.encode();
    const boxes = {
      lastChange: { height: 1, headerId: "h" },
      confirmed: [],
      pending: [],
      spendable: [],
      ...view
    } as BoxView;
    this.states.set(script, { phase: "live", boxes } as SubscriptionState);
    for (const listener of this.listeners.get(script) ?? []) listener(this.states.get(script)!);
  }
}

let relay: FakeRelay;
const mocks = vi.hoisted(() => ({ wallet: undefined as unknown, relay: undefined as unknown }));

vi.mock("./walletStore", () => ({
  MAX_ADDRESS_SUBSCRIPTIONS: 180,
  useWalletStore: () => mocks.wallet
}));
vi.mock("./relayStore", () => ({ useRelayStore: () => ({ relay: mocks.relay }) }));
vi.mock("@/chains/ergo/services/hergmesService", () => ({ getSpendableBoxes: vi.fn() }));

function box(id: string, address: ErgoAddress, creationHeight = 100): Box<bigint> {
  return {
    boxId: id.repeat(64),
    transactionId: "f".repeat(64),
    index: 0,
    value: 1_000_000n,
    ergoTree: address.ergoTree,
    creationHeight,
    assets: [{ tokenId: "a".repeat(64), amount: 5n }],
    additionalRegisters: {}
  };
}

const confirmed = (b: Box<bigint>) => ({ ...b, inclusionHeight: b.creationHeight });

async function settled<T>(promise: Promise<T>) {
  let done = false;
  promise.then(() => (done = true));
  await new Promise((r) => setTimeout(r, 0));
  return done;
}

beforeEach(() => {
  setActivePinia(createPinia());
  relay = new FakeRelay();
  mocks.relay = relay;
  mocks.wallet = reactive({
    id: 1,
    loading: false,
    settings: { defaultChangeIndex: 0 },
    addresses: [A0, A1].map((a, index) => ({
      script: a.encode(),
      index,
      assets: [{ tokenId: ERG_TOKEN_ID }]
    }))
  });
});

describe("spendable", () => {
  it("waits for every followed address to be live", async () => {
    const store = useBoxesStore();
    const b0 = confirmed(box("0", A0));
    const b1 = box("1", A1);

    const result = store.spendable();
    await nextTick();
    relay.push(A0, { confirmed: [b0], spendable: [b0] });
    expect(await settled(result)).toBe(false);

    relay.push(A1, { spendable: [b1] });
    expect(await result).toEqual({ all: [b0, b1], confirmed: [b0], unconfirmed: [b1] });
  });
});
