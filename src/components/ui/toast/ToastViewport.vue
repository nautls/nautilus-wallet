<script setup lang="ts">
import { cn } from "@/common/utils";
import { ToastViewport, type ToastViewportProps } from "reka-ui";
import { computed, type HTMLAttributes } from "vue";

const props = defineProps<ToastViewportProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;

  return delegated;
});
</script>

<template>
  <ToastViewport
    v-bind="delegatedProps"
    :class="
      cn(
        'fixed inset-x-0 top-0 z-100 mx-auto flex max-h-screen w-full flex-col p-4 md:max-w-105',
        props.class
      )
    "
  />
</template>
