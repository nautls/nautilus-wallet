import { Component } from "vue";
import { CombineIcon, ShapesIcon } from "@lucide/vue";
import { PickupKeys } from "vue-i18n";
import { ComponentProps } from "@/composables/useProgrammaticDialog";
import { MessageSchema } from "@/i18n";
import SigmaUSDLogo from "./sigma-usd/sigmausd-logo.svg";

type IconComponent<T extends Component> = {
  component: T;
  props?: ComponentProps<T, Record<string, unknown>>;
};

export type DAppManifestItem<T extends Component = Component> = {
  titleKeyPath: PickupKeys<MessageSchema, "dapps">;
  icon: IconComponent<T>;
  path: string;
};

function component<T extends Component>(
  component: T,
  props?: ComponentProps<T, Record<string, unknown>>
): IconComponent<T> {
  return { component, props };
}

export const dappsManifest: DAppManifestItem[] = [
  {
    titleKeyPath: "sigmaUsd.title",
    icon: component(SigmaUSDLogo),
    path: "/dapps/sigmausd-protocol"
  },
  {
    titleKeyPath: "walletOptimizer.title",
    icon: component(CombineIcon, { strokeWidth: 1 }),
    path: "/dapps/wallet-optimization"
  },
  {
    titleKeyPath: "nativeTokens.title",
    icon: component(ShapesIcon, { strokeWidth: 1 }),
    path: "/dapps/native-tokens"
  }
];
