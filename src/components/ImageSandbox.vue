<template>
  <div v-if="loading" :class="class" class="text-center flex">
    <loading-indicator type="circular" class="w-1/3 h-1/3 m-auto !stroke-gray-500" />
  </div>
  <div v-else-if="!contentUrl" :class="class" class="text-center flex">
    <mdi-icon class="m-auto text-orange-400" name="alert-circle-outline" size="48" />
  </div>
  <iframe
    v-show="!loading && contentUrl"
    @load="loading = false"
    sandbox=""
    :key="contentUrl"
    :class="class"
    :src="contentUrl"
    class="m-0 p-0"
    frameborder="0"
  ></iframe>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  CONTENT_SANDBOX_URL,
  IPFS_GENERAL_GATEWAY,
  IPFS_PROTOCOL_PREFIX,
  IPFS_VIDEO_GATEWAY
} from "@/constants/assets";

function resolveIpfs(url?: string, isVideo = false): string {
  if (!url) {
    return "";
  }

  if (!url.startsWith(IPFS_PROTOCOL_PREFIX)) {
    return url;
  } else {
    if (isVideo) {
      return url.replace(IPFS_PROTOCOL_PREFIX, IPFS_VIDEO_GATEWAY);
    }

    return url.replace(IPFS_PROTOCOL_PREFIX, IPFS_GENERAL_GATEWAY);
  }
}

export default defineComponent({
  name: "ImageSandbox",
  props: {
    src: { type: String },
    class: { type: String },
    height: { type: String },
    objectFit: { type: String },
    overflow: { type: String }
  },
  data() {
    return {
      loading: true
    };
  },
  watch: {
    src() {
      this.loading = true;
    }
  },
  computed: {
    contentUrl() {
      if (!this.src) {
        return;
      }

      let query = "";
      if (this.height) {
        query += `&height=${this.height}`;
      }
      if (this.objectFit) {
        query += `&fit=${this.objectFit}`;
      }
      if (this.overflow) {
        query += `&overflow=${this.overflow}`;
      }

      return `${CONTENT_SANDBOX_URL}/?url=${resolveIpfs(this.src)}${query}`;
    }
  }
});
</script>
