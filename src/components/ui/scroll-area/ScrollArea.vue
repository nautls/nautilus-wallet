<script setup lang="ts">
import type { ScrollAreaRootProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/common/utils";
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from "reka-ui";
import ScrollBar from "./ScrollBar.vue";

const props = defineProps<
  ScrollAreaRootProps & { class?: HTMLAttributes["class"]; hideOutline?: boolean }
>();

const delegatedProps = reactiveOmit(props, "class", "hideOutline");
</script>

<template>
  <ScrollAreaRoot
    data-slot="scroll-area"
    v-bind="delegatedProps"
    :class="cn('relative overflow-hidden', props.class)"
  >
    <ScrollAreaViewport
      data-slot="scroll-area-viewport"
      :class="
        cn(
          'focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-3 focus-visible:outline-1',
          { 'focus-visible:ring-0 focus-visible:outline-none': props.hideOutline }
        )
      "
    >
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
