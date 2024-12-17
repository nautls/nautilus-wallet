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
  <div class="text-center flex gap-3 mx-auto items-center flex-col">
    <div
      class="mx-auto rounded-full ring-1 ring-offset-1 ring-offset-gray-50 ring-gray-300 w-11 h-11"
    >
      <img v-if="favicon" :src="favicon" class="rounded-full w-11 h-11" />
      <circle-help-icon v-else class="text-gray-500 w-11 h-11" />
    </div>
    <p v-if="domain" class="text-gray-600">{{ domain }}</p>
  </div>
</template>
