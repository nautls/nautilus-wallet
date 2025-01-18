<script setup lang="ts">
import { computed } from "vue";
import { CheckIcon, CircleAlertIcon } from "lucide-vue-next";
import StatsCard from "@/components/StatsCard.vue";
import { Skeleton } from "@/components/ui/skeleton";

const props = defineProps<{
  title: string;
  content: string;
  healthy: boolean;
  loading: boolean;
}>();

const iconColor = computed(() => (props.healthy ? "text-green-500/70" : "text-red-500/70"));
</script>

<template>
  <StatsCard :title="title">
    <template #icon>
      <Skeleton v-if="loading" class="size-4 rounded-full" />
      <template v-else>
        <CheckIcon v-if="healthy" class="size-4" :class="iconColor" />
        <CircleAlertIcon v-else class="size-4" :class="iconColor" />
      </template>
    </template>

    <template #default>
      <Skeleton v-if="loading" class="w-8/12 h-6" />
      <div v-else class="text-base font-bold">{{ content }}</div>
    </template>
  </StatsCard>
</template>
