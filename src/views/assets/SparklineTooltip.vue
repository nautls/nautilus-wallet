<script setup lang="ts">
defineProps<{
  title?: string;
  data: {
    name: string;
    color: string;
    value: number;
  }[];
}>();
</script>

<template>
  <div class="bg-foreground text-background rounded-md px-3 py-1.5 text-center text-sm">
    <span v-for="(item, key) in data" :key="key">{{ item.value.toFixed(3) }}</span>
  </div>
</template>
