<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { BaseValidation } from "@vuelidate/core";
import { CircleAlertIcon } from "lucide-vue-next";
import { cn } from "@/lib/utils";

interface Props {
  class?: HTMLAttributes["class"];
  validation: BaseValidation;
}

const props = defineProps<Props>();
</script>

<template>
  <div :class="cn('space-y-1.5', props.class)">
    <slot />

    <template v-if="validation.$error && validation.$errors.length">
      <p
        v-for="e in validation.$errors"
        :key="e.$uid"
        class="px-1 text-destructive text-xs flex items-center gap-1"
      >
        <CircleAlertIcon class="size-3.5 shrink-0" /> {{ e.$message }}
      </p>
    </template>
    <p v-else-if="$slots.description">
      <slot name="description" />
    </p>
  </div>
</template>
