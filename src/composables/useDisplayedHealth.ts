import { onScopeDispose, ref, watch, type Ref } from "vue";
import type { RelayHealth } from "./useRelayHealth";

/** `connected` is shown for a moment after a state the user saw clears; `live` shows nothing. */
export type DisplayedHealth = RelayHealth | "connected";

/** A problem shorter than this is never shown, so a quick connect doesn't flash the badge. */
export const SHOW_DELAY = 200;
/** How long the relay must stay live before a shown problem clears, so a flap doesn't blink. */
export const SETTLE_DELAY = 500;
/** How long `connected` stays before the badge goes away. */
export const CONNECTED_FOR = 1_000;

/** What the relay badge shows for `health`, with the timing rules above. */
export function useDisplayedHealth(health: Ref<RelayHealth>): Ref<DisplayedHealth> {
  const shown = ref<DisplayedHealth>("live");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: "show" | "settle" | "hide" | undefined;

  const schedule = (kind: typeof pending, ms: number, run: () => void) => {
    clearTimeout(timer);
    pending = kind;
    timer = setTimeout(() => {
      pending = undefined;
      run();
    }, ms);
  };
  const cancel = () => {
    clearTimeout(timer);
    pending = undefined;
  };

  watch(
    health,
    (now) => {
      if (now === "live") {
        if (pending === "show") return cancel();
        if (shown.value === "live" || shown.value === "connected" || pending === "settle") return;

        schedule("settle", SETTLE_DELAY, () => {
          shown.value = "connected";
          schedule("hide", CONNECTED_FOR, () => (shown.value = "live"));
        });
        return;
      }

      if (shown.value !== "live") {
        cancel();
        shown.value = now;
      } else if (pending !== "show") {
        schedule("show", SHOW_DELAY, () => (shown.value = health.value));
      }
    },
    { immediate: true }
  );

  onScopeDispose(() => clearTimeout(timer));
  return shown;
}
