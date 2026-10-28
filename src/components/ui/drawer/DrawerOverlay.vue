<script lang="ts" setup>
import type { DrawerOverlayProps } from 'reka-ui'
import { cn } from '@/common/utils'
import { DrawerOverlay } from 'reka-ui'
import { computed, type HtmlHTMLAttributes } from 'vue'

const props = defineProps<DrawerOverlayProps & { class?: HtmlHTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})
</script>

<template>
  <DrawerOverlay v-bind="delegatedProps" :class="cn('fixed inset-0 z-50 bg-black/80 duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', props.class)" />
</template>
