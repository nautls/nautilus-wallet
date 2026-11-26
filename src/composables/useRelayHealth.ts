import { computed } from "vue";
import { useBoxesStore } from "@/stores/boxesStore";
import { useRelayStore } from "@/stores/relayStore";
import { useWalletStore } from "@/stores/walletStore";

/**
 * - `live`: every followed balance and box is current;
 * - `loading`: something followed is reading its first state;
 * - `reconnecting`: something followed lost the socket and is connecting again;
 * - `waiting`: the relay asked something followed to try again later;
 * - `error`: no relay is set, the relay refused an address for good, or it runs an older
 *   version than this release needs (`outdated`).
 */
export type RelayHealth = "live" | "loading" | "reconnecting" | "waiting" | "error";

/** How current the wallet's data from the relay is, worst first across what is followed. */
export function useRelayHealth() {
  const relayStore = useRelayStore();
  const wallet = useWalletStore();
  const boxes = useBoxesStore();

  const state = computed<{ health: RelayHealth; reason?: string }>(() => {
    if (!relayStore.relay) return { health: "error", reason: "noRelay" };

    const phases = wallet.followPhases;
    if (phases.includes("rejected") || boxes.status === "error") {
      return { health: "error", reason: boxes.error?.code };
    }
    if (phases.includes("disconnected") || boxes.status === "reconnecting") {
      return { health: "reconnecting" };
    }
    if (phases.includes("waiting") || boxes.status === "waiting") return { health: "waiting" };
    if (
      wallet.loading ||
      phases.some((p) => p === "snapshot" || p === "catching_up") ||
      boxes.status === "loading"
    ) {
      return { health: "loading" };
    }
    if (relayStore.outdated) return { health: "error", reason: "outdated" };

    return { health: "live" };
  });

  return {
    health: computed(() => state.value.health),
    reason: computed(() => state.value.reason)
  };
}
