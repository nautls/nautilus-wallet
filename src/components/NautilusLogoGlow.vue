<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { cn } from "@/common/utils";
import NautilusLogo from "./NautilusLogo.vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const CENTERED = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full";
</script>

<template>
  <div :class="cn('relative size-24', props.class)">
    <!-- a glow can't be brighter than a light background, so light mode draws ripples instead -->
    <div :class="cn(CENTERED, 'border-sea/35 size-26 border dark:hidden')"></div>
    <div :class="cn(CENTERED, 'border-sea/20 size-30 border dark:hidden')"></div>
    <div :class="cn(CENTERED, 'border-sea/10 size-34 border dark:hidden')"></div>

    <div :class="cn(CENTERED, 'bg-sea/35 hidden size-44 blur-2xl dark:block')"></div>
    <div :class="cn(CENTERED, 'bg-brass/35 hidden size-22 blur-md dark:block')"></div>

    <NautilusLogo :class="cn(CENTERED, 'size-20')" />
  </div>
</template>
