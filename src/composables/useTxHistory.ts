import { computed, onScopeDispose, shallowRef, watch } from "vue";
import { ErgoAddress } from "@fleet-sdk/core";
import type { HistoryState, MempoolTransaction, Relay, TxHistory } from "@hergmes/sdk";
import { MAX_ADDRESS_SUBSCRIPTIONS, useWalletStore } from "@/stores/walletStore";
import { useRelayStore } from "@/stores/relayStore";
import { getPendingTransaction } from "@/chains/ergo/services/hergmesService";
import {
  chainedOn as chainedOnPending,
  isCancelable,
  mergeHistories,
  oldestHeight
} from "@/chains/ergo/transaction/history";
import { log } from "@/common/logger";
import { AddressState } from "@/types/internal";

/** First pages read at once, as many as a wallet sync's balance reads. */
const MAX_CONCURRENT_READS = 10;

type Handle = { history: TxHistory; stop: () => void; started: boolean; read: boolean };

/**
 * The wallet's tx history over its used addresses, merged, while the calling component lives:
 * the first pages kept fresh, older ones read with `more()`.
 */
export function useTxHistory() {
  const wallet = useWalletStore();
  const relayStore = useRelayStore();

  let opened: { relay: Relay; walletId: number } | undefined;
  const handles = new Map<string, Handle>();
  let queue: string[] = [];
  /** Bumped on every change of a history's state, which isn't reactive. */
  const version = shallowRef(0);
  const paging = shallowRef(false);
  /**
   * Pending txs as the relay's mempool has them, by id, read once each. `null` when the relay
   * didn't have it, and a failed read is left out: both are read again on the next change.
   */
  const pending = shallowRef(new Map<string, MempoolTransaction | null>());
  const reading = new Set<string>();
  let generation = 0;

  const usedAddresses = computed(() =>
    wallet.addresses.filter((x) => x.state === AddressState.Used).map((x) => x.script)
  );

  watch(
    [() => relayStore.relay, () => wallet.id, () => wallet.loading, usedAddresses],
    ([relay, walletId, loading, addresses]) => {
      if (opened && (opened.relay !== relay || opened.walletId !== walletId)) close();
      if (!relay || !walletId || loading) return;

      opened = { relay, walletId };
      const known = new Set([...handles.keys(), ...queue]);
      queue.push(...addresses.filter((x) => !known.has(x)));
      version.value++;
      pump();
    },
    { immediate: true }
  );

  onScopeDispose(close);

  function pump() {
    if (!opened) return;
    const { relay } = opened;
    let reading = [...handles.values()].filter((h) => !h.read).length;

    while (queue.length > 0 && reading < MAX_CONCURRENT_READS) {
      const address = queue.shift()!;
      // an address the wallet doesn't follow would take a subscription past its cap
      const refresh =
        wallet.addresses.length <= MAX_ADDRESS_SUBSCRIPTIONS || wallet.follows(address);
      const history = relay.history(address, { refresh });
      const handle: Handle = { history, stop: () => undefined, started: false, read: false };
      handles.set(address, handle);
      reading++;

      // a history waits to read until the address's subscription settles, idle meanwhile
      handle.stop = history.subscribe(({ loading, items, end, error }) => {
        version.value++;
        if (handle.read) return;
        if (loading) handle.started = true;
        else if (handle.started || items.length > 0 || end || error) {
          handle.read = true;
          pump();
        }
      });
    }
  }

  function release({ history, stop }: Handle) {
    stop();
    history.close();
  }

  function close() {
    for (const handle of handles.values()) release(handle);
    handles.clear();
    queue = [];
    opened = undefined;
    generation++;
    reading.clear();
    pending.value = new Map();
    version.value++;
  }

  /** Every used address's state, a queued one's as a first page on its way. */
  function states(): HistoryState[] {
    return [
      ...[...handles.values()].map((h) => h.history.state),
      ...queue.map((address): HistoryState => ({
        address,
        items: [],
        end: false,
        loading: true,
        error: undefined,
        resets: 0
      }))
    ];
  }

  const merged = computed(() => {
    void version.value;
    return mergeHistories(states());
  });

  const pendingIds = computed(() =>
    merged.value.items.filter((x) => x.height === undefined).map((x) => x.transactionId)
  );

  watch(pendingIds, (ids, previous) => {
    if (ids.join() === previous?.join()) return;

    const kept = new Map([...pending.value].filter(([id, tx]) => tx && ids.includes(id)));
    if (kept.size !== pending.value.size) pending.value = kept;
    for (const id of ids) {
      if (!kept.has(id) && !reading.has(id)) readPending(id);
    }
  });

  async function readPending(txId: string) {
    const started = generation;
    reading.add(txId);
    try {
      const tx = await getPendingTransaction(txId);
      if (started !== generation) return;
      pending.value = new Map(pending.value).set(txId, tx ?? null);
    } catch (e) {
      log.error(`Failed to read pending transaction ${txId}`, e);
    } finally {
      if (started === generation) reading.delete(txId);
    }
  }

  const ownTrees = computed(
    () => new Set(wallet.addresses.map((x) => ErgoAddress.decodeUnsafe(x.script).ergoTree))
  );

  /** The merged items, a pending tx cancelable by its inputs and outputs once they are read. */
  const items = computed(() =>
    merged.value.items.map((tx) => {
      const read = tx.height === undefined ? pending.value.get(tx.transactionId) : undefined;
      if (read === undefined) return tx;
      return { ...tx, cancelable: read !== null && isCancelable(read, ownTrees.value) };
    })
  );

  /** The wallet's pending txs that canceling `txId` drops too, as they spend its outputs. */
  function chainedOn(txId: string): string[] {
    const read = [...pending.value.values()].filter((x): x is MempoolTransaction => !!x);
    return chainedOnPending(txId, read);
  }

  /**
   * Reads older pages from the histories holding the list back, and from those that failed,
   * until an older tx shows or every history is read to its end.
   */
  async function more() {
    paging.value = true;
    try {
      for (;;) {
        const before = mergeHistories(states());
        const behind = [...handles.values()]
          .map((h) => h.history)
          .filter(
            ({ state }) => !!state.error || (!state.end && oldestHeight(state) === before.frontier)
          );
        if (behind.length === 0) return;

        await Promise.all(behind.map((h) => h.more()));
        const after = mergeHistories(states());
        if (after.failed || after.end || after.items.length > before.items.length) return;
        if (after.frontier === before.frontier) return; // nothing read: a read failed or raced
      }
    } finally {
      paging.value = false;
    }
  }

  /**
   * Reads again what failed. A failed first page keeps its error past older pages' reads, and
   * a history read to its end reads nothing more, so a history still failing after `more()` is
   * opened again from its first page.
   */
  async function retry() {
    const failed = () => [...handles].filter(([, h]) => !!h.history.state.error);
    await Promise.all(failed().map(([, h]) => h.history.more()));

    const stuck = failed();
    if (stuck.length === 0) return;
    for (const [address, handle] of stuck) {
      release(handle);
      handles.delete(address);
    }
    queue.unshift(...stuck.map(([address]) => address));
    version.value++;
    pump();
  }

  return {
    items,
    end: computed(() => merged.value.end),
    failed: computed(() => merged.value.failed),
    /**
     * The wallet is loading, a first page is on its way, or older pages are read; not a
     * refresh of the first.
     */
    loading: computed(() => {
      void version.value;
      return (
        (!!relayStore.relay && !opened) ||
        paging.value ||
        queue.length > 0 ||
        [...handles.values()].some((h) => !h.read)
      );
    }),
    /** Whether the list can be read at all, which takes a relay. */
    available: computed(() => !!relayStore.relay),
    more,
    retry,
    chainedOn
  };
}
