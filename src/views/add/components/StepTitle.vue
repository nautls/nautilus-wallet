<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { Step } from ".";

interface Props {
  step: Step;
  class?: HTMLAttributes["class"];
}

defineProps<Props>();
</script>

<template>
  <div class="flex flex-col py-2">
    <h1 v-if="step.title" class="text-sm font-semibold">{{ step.title }}</h1>
    <p v-if="step.description" class="text-muted-foreground text-xs font-normal">
      {{ step.description }}
    </p>
  </div>
</template>
