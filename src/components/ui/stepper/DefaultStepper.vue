<script setup lang="ts">
import { type HTMLAttributes } from "vue";
import { useVModel } from "@vueuse/core";
import { CheckIcon } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Step,
  Stepper,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger
} from ".";
import { cn } from "@/common/utils";

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
      :disabled=" !step.enabled.value"
    >
      <StepperSeparator
        v-if="step.step !== steps[steps.length - 1].step"
        class="absolute left-[calc(50%+20px)] right-[calc(-50%+10px)] top-5 block h-0.5 shrink-0 rounded-full bg-muted group-data-[state=completed]:bg-primary"
      />

      <StepperTrigger as-child >
        <Button 
          :variant="state === 'completed' || state === 'active' ? 'default' : 'outline'"
          size="icon"
          class="z-10 rounded-full shrink-0"
          :class="[state === 'active' && 'ring-2 ring-ring ring-offset-2 ring-offset-background']"
        >
          <CheckIcon v-if="state === 'completed'" class="size-5" />
          <component :is="step.icon" v-else />
        </Button>
      </StepperTrigger>

      <div v-if="step.title" class="flex flex-col items-center text-center">
        <StepperTitle
          :class="[state === 'active' && 'text-primary']"
          class="text-xs font-semibold transition lg:text-base"
        >
          {{ step.title }}
        </StepperTitle>
      </div>
    </StepperItem>
  </Stepper>
</template>
