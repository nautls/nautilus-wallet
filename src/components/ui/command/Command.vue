<script setup lang="ts" generic="T extends Record<string, any> | string">
import type { ComboboxRootEmits, ComboboxRootProps } from 'reka-ui'
import { cn } from '@/common/utils'
import { ComboboxRoot, useForwardPropsEmits } from 'reka-ui'
import { computed, type HTMLAttributes } from 'vue'

const props = withDefaults(defineProps<ComboboxRootProps<T> & { class?: HTMLAttributes['class'] }>(), {
  open: true,
  modelValue: undefined,
})

const emits = defineEmits<ComboboxRootEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ComboboxRoot
    v-bind="forwarded"
    :class="cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', props.class)"
  >
    <slot />
  </ComboboxRoot>
</template>
