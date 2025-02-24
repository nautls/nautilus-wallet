<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  origin: { type: String, default: "" },
  favicon: { type: String, default: "" }
});

const domain = computed(() => props.origin || "???");
</script>

<template>
  <div class="text-center">
    <img v-if="favicon" :src="favicon" class="mr-1 inline size-6" />
    <span class="font-semibold">{{ domain }}</span> <slot />
  </div>
</template>
