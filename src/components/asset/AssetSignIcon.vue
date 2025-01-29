<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowDownRightIcon,
  ArrowUpDown,
  ArrowUpRightIcon,
  EqualIcon,
  FlameIcon
} from "lucide-vue-next";
import { assetSignIconVariants, type AssetSignIconVariants } from ".";

interface Props {
  type?: AssetSignIconVariants["variant"];
}

const props = withDefaults(defineProps<Props>(), {
  type: "positive"
});

const icon = computed(() => {
  if (props.type === "positive") {
    return ArrowDownRightIcon;
  } else if (props.type === "negative") {
    return ArrowUpRightIcon;
  } else if (props.type === "swap") {
    return ArrowUpDown;
  } else if (props.type === "burn") {
    return FlameIcon;
  } else {
    return EqualIcon;
  }
});
</script>

<template>
  <component :is="icon" :class="assetSignIconVariants({ variant: type })" />
</template>
