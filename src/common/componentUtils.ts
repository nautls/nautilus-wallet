import { Component } from "vue";
import { ensureDefaults } from "@fleet-sdk/common";
import { useProgrammatic } from "@oruga-ui/oruga-next";
import TxSignModal from "@/components/TxSignModal.vue";
import { ComponentProps } from "@/composables/useProgrammaticDialog";
import { isPopup } from "./browser";

const DEFAULT_PROPS: Partial<ModalParams<Component>> = {
  autoFocus: true,
  animation: isPopup() ? "fade-slide-up" : "zoom-out",
  scroll: "clip",
  rootClass: "outline-none xs:justify-end",
  contentClass:
    "animation-content xs:w-[100vw] xs:rounded-none xs:rounded-t-xl max-h-[90vh] !max-w-96 rounded p-4"
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
