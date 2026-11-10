<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/common/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="transaction-footer"
    :class="cn('bg-background shrink-0 space-y-3 border-t p-4', props.class)"
  >
    <slot />
  </div>
</template>
