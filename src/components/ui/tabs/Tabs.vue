<script setup lang="ts" generic="T extends string | number">
import type { TabsRootEmits, TabsRootProps } from 'reka-ui'
import { TabsRoot, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<TabsRootProps<T>>()
const emits = defineEmits<TabsRootEmits<T>>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <TabsRoot v-bind="forwarded">
    <slot />
  </TabsRoot>
</template>
