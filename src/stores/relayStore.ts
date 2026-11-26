import { computed, markRaw } from "vue";
import { Relay } from "@hergmes/sdk";
import { acceptHMRUpdate, defineStore } from "pinia";
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

  return { relay };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRelayStore, import.meta.hot));
}
