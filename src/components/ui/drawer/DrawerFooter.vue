<script lang="ts" setup>
import type { HtmlHTMLAttributes } from 'vue'
import { cn } from '@/common/utils'

const props = defineProps<{
  class?: HtmlHTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('mt-auto flex flex-col gap-2', props.class)">
    <slot />
  </div>
</template>
