import { computed, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useBoxesStore } from "@/stores/boxesStore";
import { useWalletStore } from "@/stores/walletStore";

/**
 * The wallet's spendable boxes for a page that builds txs: follows them, and the next wallet's
 * once the wallet changes, and answers their `status` to enable tx actions by, and
 * `spendable()` to build from. Following lasts until the wallet or relay changes.
 */
export function useWalletBoxes() {
  const store = useBoxesStore();
  const wallet = useWalletStore();
  watch(() => wallet.id, store.follow, { immediate: true });

  return store as Pick<typeof store, "status" | "error" | "version" | "spendable">;
}

/**
 * Whether a tx can be started now: the boxes are current, or, with `allowRestFallback`, the
 * relay refused them and the page reads them over REST.
 */
export function useTxReady(allowRestFallback: MaybeRefOrGetter<boolean> = false) {
  const boxes = useWalletBoxes();
  return computed(
    () => boxes.status === "ready" || (toValue(allowRestFallback) && boxes.status === "error")
  );
}
