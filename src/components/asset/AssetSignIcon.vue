<script setup lang="ts">
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-vue-next";
import { AssetSignIconProps } from ".";

withDefaults(defineProps<AssetSignIconProps>(), {
  type: "input"
});
</script>

<template>
  <ArrowDownRightIcon
    v-if="type === 'input'"
    class="h-5 min-w-5 text-green-600 dark:text-green-400 rounded-full p-0.5 bg-accent border-accent border"
  />
  <ArrowUpRightIcon
    v-else
    class="h-5 min-w-5 text-red-600 dark:text-red-400 rounded-full p-0.5 bg-accent border-accent border"
  />
</template>
