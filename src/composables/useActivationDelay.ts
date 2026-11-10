import { readonly, ref, watch, WatchSource } from "vue";
import { useDocumentVisibility, useWindowFocus } from "@vueuse/core";

const ACTIVATION_DELAY = 600;

/**
 * Whether a button that approves a request can be clicked: only once its window has
 * been focused and visible for a moment since `content` last changed. A page can open
 * a request window right under the cursor, so a click meant for the page would
 * otherwise approve the request.
 */
export function useActivationDelay(content: WatchSource) {
  const focused = useWindowFocus();
  const visibility = useDocumentVisibility();
  const ready = ref(false);

  watch(
    [() => focused.value && visibility.value === "visible", content],
    ([shown], _, onCleanup) => {
      ready.value = false;
      if (!shown) return;

      const timer = setTimeout(() => (ready.value = true), ACTIVATION_DELAY);
      onCleanup(() => clearTimeout(timer));
    },
    { immediate: true }
  );

  return readonly(ready);
}
