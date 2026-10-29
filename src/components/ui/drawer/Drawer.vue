<script lang="ts" setup>
import type { DrawerOpenChangeDetails, DrawerRootEmits, DrawerRootProps } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
import { DrawerRoot, useForwardProps } from "reka-ui";

interface Props extends DrawerRootProps {
  dismissible?: boolean;
}

const props = withDefaults(defineProps<Props>(), { dismissible: true });
const emits = defineEmits<DrawerRootEmits>();

const forwarded = useForwardProps(reactiveOmit(props, "dismissible"));

function onOpenUpdate(open: boolean, details: DrawerOpenChangeDetails) {
  // when not dismissible, only explicit DrawerClose presses are allowed to close the drawer
  if (!open && !props.dismissible && details.reason !== "close-press") {
    details.cancel();
    return;
  }

  emits("update:open", open, details);
}
</script>

<template>
  <DrawerRoot
    v-slot="slotProps"
    v-bind="forwarded"
    @update:open="onOpenUpdate"
    @update:open-complete="emits('update:openComplete', $event)"
    @update:snap-point="emits('update:snapPoint', $event)"
  >
    <slot v-bind="slotProps" />
  </DrawerRoot>
</template>
