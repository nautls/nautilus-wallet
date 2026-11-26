import { computed, ref, shallowRef, watch } from "vue";
import type { Amount, Box } from "@fleet-sdk/common";
import type { Relay, Subscription, SubscriptionError } from "@hergmes/sdk";
import { acceptHMRUpdate, defineStore } from "pinia";
import { getSpendableBoxes, NO_RELAY_MESSAGE } from "@/chains/ergo/services/hergmesService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { useRelayStore } from "./relayStore";
import { MAX_ADDRESS_SUBSCRIPTIONS, useWalletStore } from "./walletStore";

/** What a tx can spend now, and that split by whether a block has included each box. */
export type SpendableBoxes = {
  all: Box<Amount>[];
  confirmed: Box<Amount>[];
  unconfirmed: Box<Amount>[];
};

/**
 * - `idle`: no page asked for the boxes yet;
 * - `loading`: a followed address hasn't read its boxes yet;
 * - `waiting`: the relay asked an address to try again later;
 * - `reconnecting`: every address has read its boxes, but one isn't following the chain now;
 * - `error`: the relay refused an address for good, see `error`;
 * - `ready`: every followed address is live, so a tx can be built.
 */
export type BoxesStatus = "idle" | "loading" | "waiting" | "reconnecting" | "error" | "ready";

/**
 * The wallet's spendable boxes, followed over the relay once a page that builds txs asks for
 * them, and kept until the wallet or relay changes: the relay can't turn a key's box
 * subscription back into a balance-only one.
 */
export const useBoxesStore = defineStore("boxes", () => {
  const wallet = useWalletStore();
  const relayStore = useRelayStore();

  type Hold = { subscription: Subscription; stop: () => void };
  const holds = new Map<string, Hold>();
  /** Bumped on every change of a hold's state, which isn't reactive. */
  const version = shallowRef(0);
  /** The wallet a page asked to follow the boxes of; another wallet's aren't followed for it. */
  const wantedFor = ref<number>();
  const wanted = computed(() => !!wallet.id && wantedFor.value === wallet.id);
  let followed: { relay: Relay; walletId: number } | undefined;

  /**
   * Addresses that can hold spendable boxes: ERG holders, as every box holds ERG, then the
   * default change address, ranked as `walletStore` ranks its subscriptions so both stay under
   * the same keys. Those past the cap are read over REST.
   */
  const holders = computed(() => {
    const defaultIndex = wallet.settings.defaultChangeIndex;
    const holding = (a: (typeof wallet.addresses)[number]) =>
      a.assets.some((x) => x.tokenId === ERG_TOKEN_ID);
    const scripts = wallet.addresses
      .filter((a) => holding(a) || a.index === defaultIndex)
      .sort((a, b) => Number(holding(b)) - Number(holding(a)) || a.index - b.index)
      .map((a) => a.script);

    return {
      followed: scripts.slice(0, MAX_ADDRESS_SUBSCRIPTIONS),
      read: scripts.slice(MAX_ADDRESS_SUBSCRIPTIONS)
    };
  });

  watch(
    [() => relayStore.relay, () => wallet.id, () => wallet.loading, wanted, holders],
    ([relay, walletId, loading, want, { followed: scripts }]) => {
      if (followed && (followed.relay !== relay || followed.walletId !== walletId)) release();
      if (!relay || !walletId || loading || !want) return;
      followed = { relay, walletId };

      for (const script of scripts) {
        if (holds.has(script)) continue;
        const subscription = relay.subscribe({ address: script });
        const stop = subscription.subscribe(() => version.value++);
        holds.set(script, { subscription, stop });
      }
    }
  );

  function release() {
    for (const { subscription, stop } of holds.values()) {
      stop();
      subscription.close();
    }
    holds.clear();
    followed = undefined;
    version.value++;
  }

  const states = computed(() => {
    void version.value;
    return holders.value.followed.map((script) => holds.get(script)?.subscription.state);
  });

  const error = computed<SubscriptionError | undefined>(() => {
    if (!relayStore.relay) return { code: "no_relay", message: NO_RELAY_MESSAGE };
    return states.value.find((s) => s?.phase === "rejected")?.error;
  });

  const status = computed<BoxesStatus>(() => {
    if (!wanted.value) return "idle";
    if (error.value) return "error";
    // until the first sync, discovery may still mark addresses holding ERG the stored balances miss
    if (wallet.loading || (wallet.syncing && !wallet.synced)) return "loading";
    if (states.value.some((s) => s?.phase === "waiting")) return "waiting";
    if (states.value.some((s) => !s?.boxes)) return "loading";
    if (states.value.some((s) => s?.phase !== "live")) return "reconnecting";
    return "ready";
  });

  /** Starts following the current wallet's boxes, so they are ready by the time a tx is built. */
  function follow() {
    wantedFor.value = wallet.id || undefined;
  }

  /**
   * The wallet's spendable boxes with the mempool applied. Throws unless `status` is `ready`:
   * pages enable their tx actions only then.
   */
  async function spendable(): Promise<SpendableBoxes> {
    follow();
    if (status.value === "error") throw new Error(error.value?.message);
    if (status.value !== "ready") throw new Error("The wallet's boxes are still loading.");

    const boxes: SpendableBoxes = { all: [], confirmed: [], unconfirmed: [] };
    const add = (box: Box<Amount>, confirmed: boolean) => {
      boxes.all.push(box);
      (confirmed ? boxes.confirmed : boxes.unconfirmed).push(box);
    };

    // confirmed boxes keep their inclusionHeight, pending outputs have none
    for (const state of states.value) {
      for (const box of state?.boxes?.spendable ?? []) add(box, "inclusionHeight" in box);
    }

    if (holders.value.read.length > 0) {
      for (const box of await getSpendableBoxes(holders.value.read)) add(box, box.confirmed);
    }

    return boxes;
  }

  return { status, error, version, follow, spendable };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBoxesStore, import.meta.hot));
}
