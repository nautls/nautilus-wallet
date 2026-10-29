<script setup lang="ts">
import type { Component, HTMLAttributes } from "vue";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/common/utils";

const props = withDefaults(
  defineProps<{
    title?: string;
    content?: string;
    icon?: Component;
    displayCopyButton?: boolean;
    class?: HTMLAttributes["class"];
    titleClass?: HTMLAttributes["class"];
    contentClass?: HTMLAttributes["class"];
  }>(),
  {
    title: undefined,
    content: undefined,
    icon: undefined,
    displayCopyButton: true,
    class: undefined,
    titleClass: undefined,
    contentClass: undefined
  }
);
</script>

<template>
  <div
    :class="
      cn(
        'border-input flex min-h-16 min-w-10 flex-col justify-between gap-2 rounded-md border px-4 py-3 text-xs',
        props.class
      )
    "
  >
    <div v-if="props.title" class="flex items-center justify-between gap-1">
      <div :class="cn('truncate tracking-tight', props.titleClass)">
        {{ title }}
      </div>

      <slot v-if="$slots.icon" name="icon" />
      <Component :is="icon" v-else-if="icon" class="text-muted-foreground size-3" />
    </div>

    <div :class="cn('flex items-center gap-2', props.contentClass)">
      <slot v-if="$slots.default" />
      <template v-else-if="content">
        <div class="truncate text-sm font-semibold">{{ content }}</div>
        <CopyButton v-if="displayCopyButton" :content="content" class="size-3" />
      </template>
    </div>
  </div>
</template>
