<script setup lang="ts">
import { HtmlHTMLAttributes } from "vue";
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    href: string;
    class?: HtmlHTMLAttributes["class"];
    external: boolean;
  }>(),
  {
    external: false
  }
);
</script>

<template>
  <a
    :class="cn(props.class, 'text-primary underline-offset-4 hover:underline')"
    :href="props.href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
  >
    <slot />
  </a>
</template>
