<script setup lang="ts">
import { HTMLAttributes, ref } from "vue";
import { CopyCheckIcon, CopyIcon } from "lucide-vue-next";
import { PrimitiveProps } from "radix-vue";
import { Button, ButtonVariants } from "@/components/ui/button";
import { cn } from "@/common/utils";

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  class?: HTMLAttributes["class"];
  content: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "minimal",
  size: "condensed"
});

const copied = ref(false);

function copy() {
  navigator.clipboard.writeText(props.content);

  copied.value = true;
  setTimeout(() => (copied.value = false), 1_000 * 2);
}
</script>

<template>
  <Button v-bind="props" @click="copy()" :class="cn('transition-colors align-middle', { 'text-success/80 hover:text-success': copied }, props.class)">
    <CopyCheckIcon v-if="copied"  />
    <CopyIcon v-else />
  </Button>
</template>
