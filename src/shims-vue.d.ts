/* eslint-disable */
import type { Store } from "@/store";
import type { filters } from "@/utils/globalFilters";

declare module "*.vue" {
  import type { DefineComponent, ComponentCustomProperties } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "vue/types/vue" {
  interface Vue {
    $filters: any;
  }
}

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $store: Store;
    $filters: filters;
  }
}
