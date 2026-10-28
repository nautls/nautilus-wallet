<script lang="ts" setup>
import type { DrawerContentEmits, DrawerContentProps } from 'reka-ui'
import type { HtmlHTMLAttributes } from 'vue'
import { cn } from '@/common/utils'
import { reactiveOmit } from '@vueuse/core'
import { DrawerClose, DrawerContent, DrawerHandle, DrawerPortal, useForwardPropsEmits } from 'reka-ui'
import DrawerOverlay from './DrawerOverlay.vue'
import { target } from '@/common/env'
import { XIcon } from '@lucide/vue'

interface Props extends DrawerContentProps {
  class?: HtmlHTMLAttributes['class']
  dismissible?: boolean
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<Props>(), { class: undefined, dismissible: true });
const emits = defineEmits<DrawerContentEmits>()

const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class', 'dismissible'), emits)
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerContent
      v-bind="{ ...$attrs, ...forwarded }" :class="cn(
        'fixed inset-x-0 bottom-0 z-50 mt-24 gap-6 p-6 flex h-auto flex-col rounded-t-[10px] border bg-background outline-hidden',
        'will-change-transform transform-[translate3d(var(--drawer-swipe-movement-x,0px),var(--drawer-swipe-movement-y,0px),0)]',
        'transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-swiping:select-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full',
        props.class,
      )"
    >
      <template v-if="target('mobile')">
        <DrawerHandle class="mx-auto mt-4 h-2 w-25 shrink-0 rounded-full bg-muted" />
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
