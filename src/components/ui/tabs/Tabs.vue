<script setup lang="ts" generic="T extends string | number">
import type { TabsRootEmits, TabsRootProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/common/utils";
import { TabsRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<TabsRootProps<T> & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<TabsRootEmits<T>>();

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TabsRoot
    v-slot="slotProps"
    data-slot="tabs"
    v-bind="forwarded"
    :class="cn('flex flex-col gap-2', props.class)"
  >
    <slot v-bind="slotProps" />
  </TabsRoot>
</template>
