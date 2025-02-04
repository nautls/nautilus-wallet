<script setup lang="ts">
import { ButtonVariants, buttonVariants } from '@/components/ui/button'
import { cn } from '@/common/utils'
import { AlertDialogAction, type AlertDialogActionProps } from 'radix-vue'
import { computed, type HTMLAttributes } from 'vue'

const props = defineProps<AlertDialogActionProps & { class?: HTMLAttributes['class'], variant?: ButtonVariants['variant'] }>()

const delegatedProps = computed(() => {
  const { class: _, variant: __, ...delegated } = props

  return delegated
})
</script>

<template>
  <AlertDialogAction v-bind="delegatedProps" :class="cn(buttonVariants({ variant }), props.class)">
    <slot />
  </AlertDialogAction>
</template>
