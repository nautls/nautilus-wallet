<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { CheckboxVariants } from "."
import { Check } from "@lucide/vue"
import { reactiveOmit } from "@vueuse/core"
import { cn } from "@/common/utils"
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui"
import { checkboxVariants } from "."

const props = defineProps<CheckboxRootProps & {
  class?: HTMLAttributes["class"]
  variant?: CheckboxVariants["variant"]
}>()
const emits = defineEmits<CheckboxRootEmits>()

const delegatedProps = reactiveOmit(props, "class", "variant")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    data-slot="checkbox"
    v-bind="forwarded"
    :class="cn(checkboxVariants({ variant }), props.class)"
  >
    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="grid place-content-center text-current transition-none"
    >
      <slot v-bind="slotProps">
        <!-- important: parent Buttons apply [&_svg]:size-* which would otherwise override it -->
        <Check class="size-3.5!" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
