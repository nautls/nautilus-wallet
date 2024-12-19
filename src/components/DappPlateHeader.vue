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
    <img v-if="favicon" :src="favicon" class="mr-2 inline h-6 w-6" />
    <span>
      <span class="pr-1 font-semibold">{{ domain }}</span>
      <span>
        <slot />
      </span>
    </span>
  </div>
</template>
