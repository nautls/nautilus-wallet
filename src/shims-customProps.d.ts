import type { Store } from "@/store";
import type { filters } from "@/utils/globalFilters";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $store: Store;
    $filters: filters;
  }
}
