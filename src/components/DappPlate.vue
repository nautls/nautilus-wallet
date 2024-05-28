<script setup lang="ts">
import { computed, defineProps } from "vue";

const props = defineProps({
  origin: { type: String, default: "" },
  favicon: { type: String, default: "" },
  compact: { type: Boolean, default: false }
});

const domain = computed(() => stripProtocol(props.origin) || "???");
const wrapperClass = computed(() => (props.compact ? "flex-row" : "flex-col"));
const faviconClass = computed(() => (props.compact ? "w-7 h-7" : "w-11 h-11"));

const stripProtocol = (url: string) => url.replace(/(^\w+:|^)\/\//, "");
</script>

<template>
  <div class="text-center flex gap-3 mx-auto items-center" :class="wrapperClass">
    <div
      class="mx-auto rounded-full ring-2 ring-offset-2 ring-offset-gray-50 ring-gray-300"
      :class="faviconClass"
    >
      <img v-if="favicon" :src="favicon" class="rounded-full" :class="faviconClass" />
      <vue-feather v-else type="help-circle" class="text-gray-500" :class="faviconClass" />
    </div>
    <p v-if="domain" class="text-gray-600">{{ domain }}</p>
  </div>
</template>
