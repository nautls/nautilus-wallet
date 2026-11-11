<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/common/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="action-footer"
    :class="cn('bg-background flex shrink-0 flex-col gap-3 border-t p-4', props.class)"
  >
    <slot />
  </div>
</template>
