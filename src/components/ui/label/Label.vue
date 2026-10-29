<script setup lang="ts">
import type { LabelProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/common/utils";
import { Label } from "reka-ui";

const props = defineProps<LabelProps & { class?: HTMLAttributes["class"]; disabled?: boolean }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <Label
    data-slot="label"
    v-bind="delegatedProps"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        props.disabled && 'cursor-not-allowed opacity-50',
        props.class
      )
    "
  >
    <slot />
  </Label>
</template>
