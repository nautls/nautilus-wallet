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
  <div class="rounded-md px-3 py-1.5 text-sm bg-foreground text-center text-background">
    <span v-for="(item, key) in data" :key="key">{{ item.value.toFixed(3) }}</span>
  </div>
</template>
