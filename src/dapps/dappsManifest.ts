import { Component } from "vue";
import { CombineIcon } from "lucide-vue-next";
import { PickupKeys } from "vue-i18n";
import { ComponentProps } from "@/composables/useProgrammaticDialog";
import { MessageSchema } from "@/i18n";
import SigmaUSDLogo from "./sigma-usd/sigmausd-logo.svg";

type IconComponent<T extends Component> = {
  component: T;
  props?: ComponentProps<T, Record<string, unknown>>;
};

export type DAppManifestItem<T extends Component = Component> = {
  tileKeypath: PickupKeys<MessageSchema, "dapps">;
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
    tileKeypath: "sigmaUsd.title",
    icon: component(SigmaUSDLogo),
    path: "/dapps/sigmausd-protocol"
  },
  {
    tileKeypath: "walletOptimizer.title",
    icon: component(CombineIcon, { strokeWidth: 1 }),
    path: "/dapps/wallet-optimization"
  }
];
