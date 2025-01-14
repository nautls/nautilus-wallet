<script setup lang="ts">
import { HtmlHTMLAttributes, LinkHTMLAttributes } from "vue";
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    href?: LinkHTMLAttributes["href"];
    class?: HtmlHTMLAttributes["class"];
    external?: boolean;
  }>(),
  {
    external: false
  }
);
</script>

<template>
  <a
    :class="cn('text-primary underline-offset-4 hover:underline cursor-pointer', props.class)"
    :href="props.href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
  >
    <slot />
  </a>
</template>
