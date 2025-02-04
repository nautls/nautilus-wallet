<script setup lang="ts">
import { HtmlHTMLAttributes, LinkHTMLAttributes } from "vue";
import { ExternalLinkIcon } from "lucide-vue-next";
import { cn } from '@/common/utils'

const props = withDefaults(
  defineProps<{
    href?: LinkHTMLAttributes["href"];
    class?: HtmlHTMLAttributes["class"];
    displayExternalIcon?: boolean;
    externalIconClass?: HtmlHTMLAttributes["class"];
    external?: boolean;
  }>(),
  {
    external: false,
    displayExternalIcon: true,
  }
);
</script>

<template>
  <a
    :class="cn('underline-offset-4 hover:underline cursor-pointer', props.class)"
    :href="props.href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
  >
    <slot /> <ExternalLinkIcon v-if="external && displayExternalIcon" :class="cn('size-3 pb-[2px] inline align-middle', props.externalIconClass)" />
  </a>
</template>
