<script setup lang="ts">
import { ButtonHTMLAttributes, computed, HTMLAttributes } from "vue";
import { CopyCheckIcon, CopyIcon } from "@lucide/vue";
import { useClipboard } from "@vueuse/core";
import { PrimitiveProps } from "reka-ui";
import { useI18n } from "vue-i18n";
import { Button, ButtonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/common/utils";

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  type?: ButtonHTMLAttributes["type"];
  class?: HTMLAttributes["class"];
  content?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "minimal",
  size: "condensed",
  type: "button"
});

const { t } = useI18n({ useScope: "global" });
const { copy, copied } = useClipboard({ copiedDuring: 2_000, legacy: true });
const label = computed(() => (copied.value ? t("common.copied") : t("common.copy")));

function onClick(e: MouseEvent) {
  // avoid triggering parent click handlers, like collapsibles or list items
  e.stopPropagation();
  if (props.content) copy(props.content);
}
</script>

<template>
  <TooltipProvider :delay-duration="100">
    <!-- keep the tooltip open on click so the "copied" feedback is visible -->
    <Tooltip disable-closing-trigger>
      <TooltipTrigger as-child>
        <Button
          :as="props.as"
          :as-child="props.asChild"
          :variant="props.variant"
          :size="props.size"
          :type="props.type"
          :disabled="!props.content"
          :aria-label="label"
          :class="
            cn(
              'align-middle transition-colors',
              { 'text-success/80 hover:text-success': copied },
              props.class
            )
          "
          @click="onClick"
        >
          <slot v-if="$slots.default" />
          <Transition
            mode="out-in"
            enter-active-class="transition-all duration-150 ease-out"
            leave-active-class="transition-all duration-100 ease-in"
            enter-from-class="scale-50 opacity-0"
            leave-to-class="scale-50 opacity-0"
          >
            <CopyCheckIcon v-if="copied" class="size-auto" />
            <CopyIcon v-else class="size-auto" />
          </Transition>
        </Button>
      </TooltipTrigger>
      <TooltipContent :aria-label="label">
        {{ label }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
