import { computed, markRaw, shallowRef } from "vue";
import { Relay, type Status } from "@hergmes/sdk";
import { acceptHMRUpdate, defineStore } from "pinia";
import { isSupportedRelayVersion } from "@/chains/ergo/services/hergmesService";
import { log } from "@/common/logger";
import { useAppStore } from "./appStore";

/**
 * The page's relay, for subscriptions; the service worker can't hold its socket. `undefined`
 * while no relay URL is set, as on testnet builds.
 */
export const useRelayStore = defineStore("relay", () => {
  const app = useAppStore();
  let current: { url: string; relay: Relay } | undefined;

  // built on first read, since this store is created while the app store's setup still runs,
  // before its settings exist
  const relay = computed((): Relay | undefined => {
    const url = app.settings.relayUrl;
    if (current?.url === url) return current.relay;

    current?.relay.close();
    current = url ? { url, relay: markRaw(new Relay(url)) } : undefined;
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

  return { relay, status, outdated, readStatus };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRelayStore, import.meta.hot));
}
