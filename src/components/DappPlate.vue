<template>
  <div class="text-center flex gap-3 mx-auto items-center" :class="wraperClass">
    <div
      class="mx-auto rounded-full ring-2 ring-offset-2 ring-offset-gray-50 ring-gray-300"
      :class="faviconClass"
    >
      <img v-if="favicon" :src="favicon" class="rounded-full" :class="faviconClass" />
      <vue-feather v-else type="help-circle" class="text-gray-500" :class="faviconClass" />
    </div>
    <p class="text-gray-600">{{ stripProtocol(origin) }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "DAppPlate",
  props: {
    origin: { type: String },
    favicon: { type: String },
    compact: { type: Boolean, default: false }
  },
  computed: {
    domain() {
      return this.stripProtocol(this.origin) || "???";
    },
    wraperClass() {
      return this.compact ? "flex-row" : "flex-col";
    },
    faviconClass() {
      return this.compact ? "w-7 h-7" : "w-11 h-11";
    }
  },
  methods: {
    stripProtocol(url?: string): string | undefined {
      if (!url) {
        return url;
      }

      return url.replace(/(^\w+:|^)\/\//, "");
    }
  }
});
</script>
