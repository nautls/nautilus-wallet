<script setup lang="ts">
import { HtmlHTMLAttributes, LinkHTMLAttributes } from "vue";
import { ExternalLinkIcon } from "@lucide/vue";
import { cn } from "@/common/utils";

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
    displayExternalIcon: true
  }
);
</script>

<template>
  <a
    :class="
      cn(
        'focus-visible:ring-ring/50 cursor-pointer rounded-xs underline decoration-current/40 underline-offset-[3px] transition-[text-decoration-color] outline-none hover:decoration-current focus-visible:ring-3',
        props.class
      )
    "
    :href="props.href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
  >
    <slot />
    <!-- the word joiner keeps the icon from wrapping onto a line of its own -->
    <template v-if="external && displayExternalIcon"
      >&#8288;<ExternalLinkIcon
        aria-hidden="true"
        :class="
          cn('ml-[0.2em] inline size-[0.85em] shrink-0 align-[-0.1em]', props.externalIconClass)
        "
    /></template>
  </a>
</template>
