<script setup lang="ts">
import type { TabsListProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/common/utils";
import { TabsIndicator, TabsList } from "reka-ui";

const props = defineProps<TabsListProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegatedProps"
    :class="
      cn(
        'bg-muted text-muted-foreground relative inline-flex h-9 w-fit items-center justify-center rounded-lg p-0.75',
        props.class
      )
    "
  >
    <TabsIndicator
      data-slot="tabs-indicator"
      class="bg-background dark:border-input dark:bg-input/30 ease-snap absolute top-1/2 left-0 h-(--reka-tabs-indicator-thickness) w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) -translate-y-1/2 rounded-md border border-transparent shadow-sm transition-[translate,width] duration-200 motion-reduce:transition-none"
      aria-hidden="true"
    />
    <slot />
  </TabsList>
</template>
