import { computed, ref, shallowRef, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import type { Amount, Box } from "@fleet-sdk/common";
import type { Relay, Subscription } from "@hergmes/sdk";
import { getSpendableBoxes } from "@/chains/ergo/services/hergmesService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { useRelayStore } from "./relayStore";
import { MAX_ADDRESS_SUBSCRIPTIONS, useWalletStore } from "./walletStore";

/** How long `spendable` waits for the subscriptions, which first read every box they follow. */
const READY_TIMEOUT = 30_000;

/** What a tx can spend now, and that split by whether a block has included each box. */
export type SpendableBoxes = {
  all: Box<Amount>[];
  confirmed: Box<Amount>[];
  unconfirmed: Box<Amount>[];
};

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
  const wanted = ref(false);
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
    () => wallet.id,
    (_, previous) => {
      if (!previous) return;
      wanted.value = false;
    }
  );

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

  /** Starts following the wallet's boxes, so they are ready by the time a tx is built. */
  function prepare() {
    wanted.value = true;
  }

  function isReady() {
    return holders.value.followed.every(
      (script) => holds.get(script)?.subscription.state.phase === "live"
    );
  }

  /**
   * The wallet's spendable boxes with the mempool applied. Waits for the subscriptions to
   * catch up.
   */
  async function spendable(): Promise<SpendableBoxes> {
    if (!relayStore.relay) throw new Error("No relay is set.");
    prepare();

    const walletId = wallet.id;
    await until(() => {
      void version.value;
      // discovery marks the addresses holding ERG that the stored balances miss
      return wallet.id !== walletId || (!wallet.loading && !wallet.syncing && isReady());
    }, READY_TIMEOUT);

    if (wallet.id !== walletId) throw new Error("The wallet changed while its boxes were loading.");
    if (!isReady()) throw new Error("Unable to load the wallet's boxes, check your connection.");

    const boxes: SpendableBoxes = { all: [], confirmed: [], unconfirmed: [] };
    const add = (box: Box<Amount>, confirmed: boolean) => {
      boxes.all.push(box);
      (confirmed ? boxes.confirmed : boxes.unconfirmed).push(box);
    };

    for (const script of holders.value.followed) {
      const view = holds.get(script)?.subscription.state.boxes;
      // confirmed boxes keep their inclusionHeight, pending outputs have none
      for (const box of view?.spendable ?? []) add(box, "inclusionHeight" in box);
    }

    if (holders.value.read.length > 0) {
      for (const box of await getSpendableBoxes(holders.value.read)) add(box, box.confirmed);
    }

    return boxes;
  }

  return { prepare, spendable };
});

function until(predicate: () => boolean, timeout: number): Promise<void> {
  if (predicate()) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      stop();
      resolve();
    };
    const timer = setTimeout(done, timeout);
    const stop = watch(predicate, (ok) => ok && done());
  });
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBoxesStore, import.meta.hot));
}
