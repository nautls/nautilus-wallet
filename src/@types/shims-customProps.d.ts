import store from "@/store";
import type { filters } from "@/utils/globalFilters";

declare module "vue" {
  interface ComponentCustomProperties {
    $store: typeof store;
    $filters: typeof filters;
  }
}
