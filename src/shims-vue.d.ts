/* eslint-disable */
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
