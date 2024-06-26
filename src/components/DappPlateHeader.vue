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
    <img v-if="favicon" :src="favicon" class="inline w-6 h-6 mr-2" />
    <span>
      <span class="font-semibold pr-1">{{ domain }}</span>
      <span>
        <slot />
      </span>
    </span>
  </div>
</template>
