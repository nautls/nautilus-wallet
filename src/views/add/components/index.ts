import { Component, Ref } from "vue";

export { default as Stepper } from "./Stepper.vue";
export { default as StepTitle } from "./StepTitle.vue";

export interface Step {
  step: number;
  title?: string;
  description?: string;
  icon: Component;
  enabled: Ref<boolean>;
}
