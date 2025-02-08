import { type Component } from 'vue'

export { default as Stepper } from './Stepper.vue'
export { default as StepperIndicator } from './StepperIndicator.vue'
export { default as StepperItem } from './StepperItem.vue'
export { default as StepperSeparator } from './StepperSeparator.vue'
export { default as StepperTitle } from './StepperTitle.vue'
export { default as StepperTrigger } from './StepperTrigger.vue'
export { default as DefaultStepper } from './DefaultStepper.vue'

export interface Step {
   step: number;
   title: string;
   icon: Component;
 }
