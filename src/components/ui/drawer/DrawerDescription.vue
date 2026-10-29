<script lang="ts" setup>
import type { DrawerDescriptionProps } from "reka-ui";
import { cn } from "@/common/utils";
import { DrawerDescription } from "reka-ui";
import { computed, type HtmlHTMLAttributes } from "vue";

const props = defineProps<DrawerDescriptionProps & { class?: HtmlHTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;

  return delegated;
});
</script>

<template>
  <DrawerDescription
    v-bind="delegatedProps"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </DrawerDescription>
</template>
