<script setup lang="ts">
import { computed } from "vue";
import type { Score } from "@zxcvbn-ts/core";
import { useI18n } from "vue-i18n";
import { cn } from "@/common/utils";

const props = defineProps<{ score?: Score }>();

const { t } = useI18n();

const LEVELS = [
  { bars: 1, label: "wallet.passwordStrength.weak", color: "bg-destructive" },
  { bars: 1, label: "wallet.passwordStrength.weak", color: "bg-destructive" },
  { bars: 2, label: "wallet.passwordStrength.fair", color: "bg-warning" },
  { bars: 3, label: "wallet.passwordStrength.good", color: "bg-success" },
  { bars: 4, label: "wallet.passwordStrength.strong", color: "bg-success" }
] as const;

const level = computed(() => (props.score === undefined ? undefined : LEVELS[props.score]));
</script>

<template>
  <span class="sr-only" aria-live="polite">{{ level ? t(level.label) : "" }}</span>
  <div
    role="meter"
    :aria-label="t('wallet.passwordStrength.title')"
    aria-valuemin="0"
    aria-valuemax="4"
    :aria-valuenow="level?.bars ?? 0"
    :aria-valuetext="level ? t(level.label) : undefined"
    class="flex gap-1"
    data-password-strength
  >
    <div
      v-for="i in 4"
      :key="i"
      :class="
        cn(
          'h-1 flex-1 rounded-full transition-colors',
          level && i <= level.bars ? level.color : 'bg-muted'
        )
      "
    />
  </div>
</template>
