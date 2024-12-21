<script setup lang="ts">
import { Card, CardContent } from "@/components/ui/card";

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
  <Card class="text-sm">
    <CardContent class="p-3">
      <span v-for="(item, key) in data" :key="key" class="text-center">{{
        item.value.toFixed(3)
      }}</span>
    </CardContent>
  </Card>
</template>
