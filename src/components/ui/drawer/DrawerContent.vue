<script lang="ts" setup>
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HtmlHTMLAttributes } from 'vue'
import { cn } from '@/common/utils'
import { useForwardPropsEmits } from 'reka-ui'
import { DrawerContent, DrawerPortal } from 'vaul-vue'
import DrawerOverlay from './DrawerOverlay.vue'
import { target } from '@/common/env'
import { XIcon } from 'lucide-vue-next'
import { DrawerClose } from 'vaul-vue'

interface Props extends DialogContentProps {
  class?: HtmlHTMLAttributes['class']
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), { class: undefined, dismissible: true });
const emits = defineEmits<DialogContentEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerContent
      v-bind="forwarded" :class="cn(
        'fixed inset-x-0 bottom-0 z-50 mt-24 gap-6 p-6 flex h-auto flex-col rounded-t-[10px] border bg-background',
        props.class,
      )"
    >
      <template v-if="target('mobile')">
        <div class="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        <slot />
      </template>

      <template v-else>
        <slot />
        <DrawerClose :disabled="!dismissible"
          class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <XIcon class="w-4 h-4" />
          <span class="sr-only">Close</span>
        </DrawerClose>
      </template>

      
    </DrawerContent>
  </DrawerPortal>
</template>
