<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { Loader2Icon } from "@lucide/vue";
import { Button, type ButtonVariants } from "@/components/ui/button";
import { cn } from "@/common/utils";
import { useTxReady, useWalletBoxes } from "@/composables/useWalletBoxes";

/**
 * The button that starts a tx the wallet funds. It follows the wallet's boxes while shown, and
 * stays disabled until they are current, whatever the page's own `disabled` says.
 */
const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    /** Enables the button when the relay refuses the boxes, for a page that reads them over REST. */
    allowRestFallback?: boolean;
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: HTMLAttributes["class"];
  }>(),
  { size: "lg" }
);

const boxes = useWalletBoxes();

const usable = useTxReady(() => props.allowRestFallback);
const progressing = computed(() => boxes.status === "loading" || boxes.status === "reconnecting");
</script>

<template>
  <Button
    data-tx-action
    :variant="variant"
    :size="size"
    :disabled="disabled || !usable"
    :class="cn('w-full', props.class)"
  >
    <Loader2Icon
      v-if="progressing"
      data-boxes-status
      :data-status="boxes.status"
      class="animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
    <slot />
  </Button>
</template>
