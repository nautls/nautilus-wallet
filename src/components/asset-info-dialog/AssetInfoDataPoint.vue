<script setup lang="ts">
import type { Component } from "vue";
import CopyButton from "@/components/ui/CopyButton.vue";

defineProps<{
  title: string;
  content: string;
  icon?: Component;
}>();
</script>

<template>
  <div
    class="flex flex-col text-xs border h-20 border-input justify-between p-4 rounded-md min-w-10"
  >
    <div class="flex justify-between items-center gap-1">
      <div class="truncate">{{ title }}</div>
      <Component :is="icon" v-if="icon" class="size-3 text-muted-foreground" />
    </div>
    <div class="flex items-center gap-2">
      <div class="font-semibold text-sm truncate">{{ content }}</div>
      <CopyButton :content="content" class="size-3" />
    </div>
  </div>
</template>
