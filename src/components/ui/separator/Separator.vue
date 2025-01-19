<script setup lang="ts">
import { cn } from '@/lib/utils'
import { Separator, type SeparatorProps } from 'radix-vue'
import { type Component, computed, type HTMLAttributes } from 'vue'

const props = defineProps<
  SeparatorProps & { class?: HTMLAttributes['class'], label?: string, icon?: Component }
>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})
</script>

<template>
  <Separator
    v-bind="delegatedProps"
    :class="
      cn(
        'shrink-0 bg-border relative',
        props.orientation === 'vertical' ? 'w-px h-full' : 'h-px w-full',
        props.class,
      )
    "
  >
    <span
      v-if="props.label || props.icon"
      :class="
        cn(
          'text-xs text-muted-foreground bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center items-center',
          props.orientation === 'vertical' ? 'w-[1px] px-1 py-2' : 'h-[1px] py-1 px-2',
          props.icon ? 'size-auto p-2 rounded-full border' : '',
        )
      "
    >
      <Component :is="props.icon" v-if="props.icon" class="size-4" /> 
      <template v-else>{{ props.label }}</template>
    </span>
  </Separator>
</template>
