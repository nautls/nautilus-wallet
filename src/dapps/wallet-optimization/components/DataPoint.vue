<script setup lang="ts">
import { CheckIcon, CircleAlertIcon } from "@lucide/vue";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/ui/stats-card";

defineProps<{
  title: string;
  content: string;
  limit: string;
  healthy: boolean;
  loading: boolean;
}>();
</script>

<template>
  <StatsCard :title="title" content-class="items-end justify-between gap-2">
    <template #icon>
      <Skeleton v-if="loading" class="size-4 rounded-full" />
      <CheckIcon v-else-if="healthy" class="text-success size-4" />
      <CircleAlertIcon v-else class="text-destructive size-4" />
    </template>

    <template #default>
      <Skeleton v-if="loading" class="h-5 w-16" />
      <p v-else class="text-xl leading-none font-semibold">{{ content }}</p>
      <p class="text-muted-foreground text-xs leading-tight">{{ limit }}</p>
    </template>
  </StatsCard>
</template>
