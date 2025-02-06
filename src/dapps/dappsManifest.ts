import { Component } from "vue";
import { CombineIcon } from "lucide-vue-next";
import { ComponentProps } from "@/composables/useProgrammaticDialog";

type IconComponent<T extends Component> = {
  component: T;
  props?: ComponentProps<T, Record<string, unknown>>;
};

export type DAppManifestItem<T extends Component = Component> = {
  name: string;
  icon: IconComponent<T>;
  path: string;
};

function wrap<T extends Component>(
  component: T,
  props: ComponentProps<T, Record<string, unknown>>
): IconComponent<T> {
  return { component, props };
}

export const dappsManifest: DAppManifestItem[] = [
  {
    name: "Wallet Optimization",
    icon: wrap(CombineIcon, { strokeWidth: 1 }),
    path: "/dapps/wallet-optimization"
  }
];
