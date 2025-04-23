<script setup lang="ts">
import { type HTMLAttributes } from "vue";
import { useVModel } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import { Stepper, StepperItem, StepperSeparator, StepperTrigger } from "@/components/ui/stepper";
import { cn } from "@/common/utils";
import { Step } from ".";

interface Props {
  steps: Step[];
  class?: HTMLAttributes["class"];
  modelValue?: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", payload: number): void;
}>();

const modelValue = useVModel(props, "modelValue", emit, { passive: true, defaultValue: 1 });
</script>

<template>
  <Stepper
    v-model="modelValue"
    :class="cn('flex w-full items-center justify-center gap-2', props.class)"
  >
    <StepperItem
      v-for="step in steps"
      :key="step.step"
      v-slot="{ state }"
      class="relative flex w-full flex-col items-center justify-center"
      :step="step.step"
      :disabled="!step.enabled.value"
    >
      <StepperSeparator
        v-if="step.step !== steps[steps.length - 1].step"
        class="bg-muted group-data-[state=completed]:bg-primary absolute top-5 right-[calc(-50%+10px)] left-[calc(50%+20px)] block h-0.5 shrink-0 rounded-full"
      />

      <StepperTrigger as-child>
        <Button
          :variant="state === 'completed' || state === 'active' ? 'default' : 'outline'"
          size="icon"
          class="z-10 shrink-0 rounded-full"
          :class="[state === 'active' && 'ring-ring ring-offset-background ring-2 ring-offset-2']"
        >
          <component :is="step.icon" />
        </Button>
      </StepperTrigger>
    </StepperItem>
  </Stepper>
</template>
