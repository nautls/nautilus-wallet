<script setup lang="ts">
import { computed, HTMLAttributes } from "vue";
import { flatErrors } from "@regle/core";
import { cn } from "@/common/utils";

interface Validation {
  $error: boolean;
  $errors: unknown;
}

interface Props {
  class?: HTMLAttributes["class"];
  validation?: Validation;
}

const props = defineProps<Props>();

const errors = computed<string[]>(() => {
  const errors = props.validation?.$errors;
  if (!props.validation?.$error || !errors) return [];
  if (Array.isArray(errors)) return errors as string[];
  return flatErrors(errors as Parameters<typeof flatErrors>[0]);
});
</script>

<template>
  <div :class="cn('flex flex-col space-y-1.5', props.class)">
    <slot />

    <template v-if="errors.length">
      <p
        v-for="(message, i) in errors"
        :key="i"
        data-form-error
        class="text-destructive text-xs flex items-center gap-1"
      >
        {{ message }}
      </p>
    </template>
    <p v-else-if="$slots.description" class="text-muted-foreground text-xs font-normal">
      <slot name="description" />
    </p>
  </div>
</template>
