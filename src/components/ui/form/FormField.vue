<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { BaseValidation } from "@vuelidate/core";
import { cn } from "@/common/utils";

interface Props {
  class?: HTMLAttributes["class"];
  validation?: BaseValidation;
}

const props = defineProps<Props>();
</script>

<template>
  <div :class="cn('flex flex-col space-y-1.5', props.class)">
    <slot />

    <template v-if="validation?.$error && validation.$errors.length">
      <p
        v-for="e in validation.$errors"
        :key="e.$uid"
        class="text-destructive text-xs flex items-center gap-1"
      >
        {{ e.$message }}
      </p>
    </template>
    <p v-else-if="$slots.description" class="text-muted-foreground text-xs font-normal">
      <slot name="description" />
    </p>
  </div>
</template>
