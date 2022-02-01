<template>
  <div class="w-full">
    <div
      class="mx-auto w-11 h-11 rounded-full ring-2 ring-offset-2 ring-offset-gray-50 ring-gray-300"
    >
      <img v-if="favicon" :src="favicon" class="w-11 rounded-full" />
      <vue-feather v-else type="help-circle" class="w-11 text-gray-500" />
    </div>
    <p class="text-gray-600 pt-2">{{ stripProtocol(origin) }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "DAppPlate",
  props: {
    origin: { type: String },
    favicon: { type: String }
  },
  computed: {
    domain() {
      return this.stripProtocol(this.origin) || "???";
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
