import { computed, markRaw, shallowRef } from "vue";
import { type BoxView, type Key, Relay, type Status, type Subscription } from "@hergmes/sdk";
import { acceptHMRUpdate, defineStore } from "pinia";
import { isSupportedRelayVersion, NO_RELAY_MESSAGE } from "@/chains/ergo/services/hergmesService";
import { log } from "@/common/logger";
import { useAppStore } from "./appStore";

const READ_BOXES_TIMEOUT = 15_000;

/**
 * The page's relay, for subscriptions; the service worker can't hold its socket. `undefined`
 * while no relay URL is set, as on testnet builds.
 */
export const useRelayStore = defineStore("relay", () => {
  const app = useAppStore();
  let current: { url: string; relay: Relay; holds: Map<string, Subscription> } | undefined;

  // built on first read, since this store is created while the app store's setup still runs,
  // before its settings exist
  const relay = computed((): Relay | undefined => {
    const url = app.settings.relayUrl;
    if (current?.url === url) return current.relay;

    current?.relay.close();
    current = url ? { url, relay: markRaw(new Relay(url)), holds: new Map() } : undefined;
    return current?.relay;
  });

  /** The relay's last read status, `undefined` until read or when the read failed. */
  const status = shallowRef<Status>();

  /** Reads the relay's status over REST, which needs no socket. */
  async function readStatus(): Promise<Status | undefined> {
    const read = relay.value;
    status.value = undefined;
    if (!read) return;

    try {
      const result = await read.rest.status();
      if (relay.value !== read) return; // the relay changed while this read was on its way
      status.value = result;
      return result;
    } catch (e) {
      log.error("Failed to read the relay's status", e);
    }
  }

  /** Whether the relay runs a version older than this release needs, so features may fail. */
  const outdated = computed(() => !!status.value && !isSupportedRelayVersion(status.value.version));

  /**
   * A key's boxes with the mempool applied, read through a subscription, as REST serves only
   * an address's spendable boxes. The key stays held until the relay changes, so later reads
   * answer at once; one the relay refused is let go, so the next read tries again.
   */
  async function readBoxes(key: Key, timeoutMs = READ_BOXES_TIMEOUT): Promise<BoxView> {
    const read = relay.value;
    if (!read || !current) throw new Error(NO_RELAY_MESSAGE);

    const { holds } = current;
    const id = JSON.stringify(key);
    let subscription = holds.get(id);
    // refused while no read was waiting on it: a new subscribe tries again
    if (subscription?.state.phase === "rejected") {
      subscription.close();
      subscription = undefined;
    }
    if (!subscription) {
      subscription = read.subscribe(key);
      holds.set(id, subscription);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (() => void) | undefined;
    try {
      return await new Promise<BoxView>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("The relay took too long to answer")), timeoutMs);
        stop = subscription.subscribe(({ phase, boxes, error }) => {
          if (phase === "live" && boxes) return resolve(boxes);
          if (phase !== "rejected") return;

          holds.delete(id);
          subscription.close();
          reject(new Error(error?.message ?? "Refused by the relay"));
        });
      });
    } finally {
      clearTimeout(timer);
      stop?.();
    }
  }

  return { relay, status, outdated, readStatus, readBoxes };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRelayStore, import.meta.hot));
}
