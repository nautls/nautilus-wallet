import { Component, Ref } from "vue";

export { default as Stepper } from "./Stepper.vue";
export { default as StepTitle } from "./StepTitle.vue";
export { default as WalletPasswordFields } from "./WalletPasswordFields.vue";
export { default as MasterPasswordSwitch } from "./MasterPasswordSwitch.vue";
export * from "./walletPassword";

export interface Step {
  step: number;
  title?: string;
  description?: string;
  icon: Component;
  enabled: Ref<boolean>;
}

export type KeyedStep<K extends string> = Step & { key: K };

export function numberSteps<K extends string>(
  steps: (Omit<KeyedStep<K>, "step"> | false)[]
): KeyedStep<K>[] {
  return steps.filter((s) => s !== false).map((s, i) => ({ ...s, step: i + 1 }));
}
