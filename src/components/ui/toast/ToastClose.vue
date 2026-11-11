<script setup lang="ts">
import { cn } from "@/common/utils";
import { XIcon } from "@lucide/vue";
import { ToastClose, type ToastCloseProps } from "reka-ui";
import { computed, type HTMLAttributes } from "vue";

const props = defineProps<
  ToastCloseProps & {
    class?: HTMLAttributes["class"];
  }
>();

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;

  return delegated;
});
</script>

<template>
  <ToastClose
    v-bind="delegatedProps"
    :class="
      cn(
        'text-foreground/50 hover:text-foreground group-[.destructive]:text-destructive-foreground/70 hover:group-[.destructive]:text-destructive-foreground focus:group-[.destructive]:ring-destructive-foreground/50 focus:group-[.destructive]:ring-offset-destructive absolute top-1 right-1 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:ring-1 focus:outline-hidden',
        props.class
      )
    "
  >
    <XIcon class="h-4 w-4" />
  </ToastClose>
</template>
