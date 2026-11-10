<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { cn } from "@/common/utils";
import NautilusLogo from "./NautilusLogo.vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div :class="cn('relative size-24', props.class)">
    <div
      class="bg-sea/30 dark:bg-sea/35 absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
    ></div>
    <div
      class="bg-brass/45 dark:bg-brass/35 absolute top-1/2 left-1/2 size-22 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
    ></div>
    <NautilusLogo
      class="absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
    />
  </div>
</template>
