<script setup lang="ts">
import type { Component, HTMLAttributes } from "vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    title: string;
    content?: string;
    icon?: Component;
    displayCopyButton?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    content: undefined,
    icon: undefined,
    displayCopyButton: true,
    class: undefined
  }
);
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col text-xs border min-h-20 gap-2 border-input justify-between p-4 rounded-md min-w-10',
        props.class
      )
    "
  >
    <div class="flex justify-between items-center gap-1">
      <div class="truncate tracking-tight">{{ title }}</div>

      <slot v-if="$slots.icon" name="icon" />
      <Component :is="icon" v-else-if="icon" class="size-3 text-muted-foreground" />
    </div>

    <div class="flex items-center gap-2">
      <slot v-if="$slots.default" />
      <template v-else-if="content">
        <div class="font-semibold text-sm truncate">{{ content }}</div>
        <CopyButton v-if="displayCopyButton" :content="content" class="size-3" />
      </template>
    </div>
  </div>
</template>
