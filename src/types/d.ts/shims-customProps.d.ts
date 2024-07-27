import type { filters } from "@/common/globalFilters";

declare module "vue" {
  interface ComponentCustomProperties {
    $filters: typeof filters;
  }
}
