<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = withDefaults(defineProps<{ length?: number; label?: string }>(), {
  length: 4,
  label: undefined
});

const { t } = useI18n({ useScope: "global" });

const mask = computed(() => "•".repeat(props.length));
</script>

<template>
  <span data-hidden-amount class="tracking-widest whitespace-nowrap">
    <span aria-hidden="true">{{ mask }}</span>
    <span class="sr-only">{{ props.label ?? t("asset.amountHidden") }}</span>
  </span>
</template>
