<script setup lang="ts">
import type { ComboboxContentEmits, ComboboxContentProps } from 'radix-vue'
import { cn } from '@/lib/utils'
import { ComboboxContent, useForwardPropsEmits } from 'radix-vue'
import { computed, type HTMLAttributes } from 'vue'
import { ScrollArea } from "../scroll-area";

const props = withDefaults(defineProps<ComboboxContentProps & { class?: HTMLAttributes['class'] }>(), {
  dismissable: false,
})
const emits = defineEmits<ComboboxContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ComboboxContent v-bind="forwarded" :class="cn('max-h-[300px] overflow-hidden', props.class)">
    <ScrollArea type="scroll" as="div" role="presentation">
      <slot />
    </ScrollArea>
  </ComboboxContent>
</template>
