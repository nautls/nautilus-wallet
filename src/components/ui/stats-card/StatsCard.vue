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
        'flex flex-col text-xs border py-3 px-4 min-h-16 gap-2 border-input justify-between rounded-md min-w-10',
        props.class
      )
    "
  >
    <div v-if="props.title" class="flex justify-between items-center gap-1">
      <div :class="cn('truncate tracking-tight', props.titleClass)">
        {{ title }}
      </div>

      <slot v-if="$slots.icon" name="icon" />
      <Component :is="icon" v-else-if="icon" class="size-3 text-muted-foreground" />
    </div>

    <div :class="cn('flex items-center gap-2', props.contentClass)">
      <slot v-if="$slots.default" />
      <template v-else-if="content">
        <div class="font-semibold text-sm truncate">{{ content }}</div>
        <CopyButton v-if="displayCopyButton" :content="content" class="size-3" />
      </template>
    </div>
  </div>
</template>
