import { useBoxesStore } from "@/stores/boxesStore";

/**
 * The wallet's spendable boxes for a page that builds txs: starts following them and answers
 * their `status` to enable tx actions by, and `spendable()` to build from. Following lasts until
 * the wallet or relay changes, not just the page.
 */
export function useWalletBoxes() {
  const store = useBoxesStore();
  store.follow();

  return store as Pick<typeof store, "status" | "error" | "version" | "spendable">;
}
