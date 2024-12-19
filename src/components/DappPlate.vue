<script setup lang="ts">
import { computed } from "vue";
import { CircleHelpIcon } from "lucide-vue-next";

const props = defineProps({
  origin: { type: String, default: "" },
  favicon: { type: String, default: "" }
});

const domain = computed(() => props.origin) || "???";
</script>

<template>
  <div class="mx-auto flex flex-col items-center gap-3 text-center">
    <div
      class="mx-auto h-11 w-11 rounded-full ring-1 ring-gray-300 ring-offset-1 ring-offset-gray-50"
    >
      <img v-if="favicon" :src="favicon" class="h-11 w-11 rounded-full" />
      <circle-help-icon v-else class="h-11 w-11 text-gray-500" />
    </div>
    <p v-if="domain" class="text-gray-600">{{ domain }}</p>
  </div>
</template>
