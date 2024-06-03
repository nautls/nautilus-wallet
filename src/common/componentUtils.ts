import { ensureDefaults } from "@fleet-sdk/common";
import { useProgrammatic } from "@oruga-ui/oruga-next";
import { AllowedComponentProps, Component, VNodeProps } from "vue";
import { isPopup } from "./browser";
import TxSignModal from "@/components/TxSignModal.vue";
import { Prettify } from "@/types/internal";

const DEFAULT_PROPS: Partial<ModalParams<Component>> = {
  autoFocus: true,
  animation: isPopup() ? "fade-slide-up" : "zoom-out",
  scroll: "clip",
  rootClass: "outline-none <sm:justify-end",
  contentClass:
    "animation-content max-h-90vh p-4 rounded !max-w-100 !w-90vw <sm:rounded-t-xl <sm:rounded-none max-h-90vh !<sm:w-100vw"
};

const { oruga } = useProgrammatic();

export function openTransactionSigningModal(props: ComponentProps<typeof TxSignModal>) {
  openModal(TxSignModal, { props });
}

export function openModal<T extends Component>(component: T, params: ModalParams<T>) {
  oruga.modal.open({
    component: component,
    ...ensureDefaults(params, DEFAULT_PROPS)
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentProps<C extends Component> = C extends new (...args: any) => any
  ? Prettify<Omit<InstanceType<C>["$props"], keyof VNodeProps | keyof AllowedComponentProps>>
  : never;

export type ModalParams<T extends Component> = {
  props?: ComponentProps<T>;
  events?: undefined;
  autoFocus?: boolean;
  trapFocus?: boolean;
  width?: number;
  animation?: string;
  canCancel?: boolean | Array<"escape" | "x" | "outside" | "button">;
  fullScreen?: boolean;
  scroll?: "keep" | "clip";
  destroyOnHide?: boolean;

  closeClass?: string;
  contentClass?: string;
  fullScreenClass?: string;
  mobileClass?: string;
  noScrollClass?: string;
  overlayClass?: string;
  rootClass?: string;
  scrollClipClass?: string;

  onCancel?: () => void;
  onClose?: () => void;
};

export function chunkString(str: string, length: number): string[] {
  return str.match(new RegExp(`.{1,${length}}`, "g")) ?? [];
}
