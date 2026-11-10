<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

defineOptions({ inheritAttrs: false });

/** An icon button named by `label`, also shown as its tooltip. Needs a `TooltipProvider` above. */
defineProps<{ label: string }>();
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button variant="ghost" size="icon" :aria-label="label" v-bind="$attrs">
        <slot />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">{{ label }}</TooltipContent>
  </Tooltip>
</template>
