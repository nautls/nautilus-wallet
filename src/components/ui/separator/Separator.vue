<script setup lang="ts">
import type { SeparatorProps } from "reka-ui";
import type { Component, HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/common/utils";
import { Separator } from "reka-ui";

const props = withDefaults(
  defineProps<
    SeparatorProps & { class?: HTMLAttributes["class"]; label?: string; icon?: Component }
  >(),
  {
    orientation: "horizontal",
    decorative: true
  }
);

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <Separator
    data-slot="separator"
    v-bind="delegatedProps"
    :class="
      cn(
        'bg-border relative shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        props.class
      )
    "
  >
    <span
      v-if="props.label || props.icon"
      :class="
        cn(
          'text-muted-foreground bg-background absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-xs',
          props.orientation === 'vertical' ? 'w-px px-1 py-2' : 'h-px px-2 py-1',
          props.icon ? 'size-auto rounded-full border p-2' : ''
        )
      "
    >
      <component :is="props.icon" v-if="props.icon" class="size-4" />
      <template v-else>{{ props.label }}</template>
    </span>
  </Separator>
</template>
