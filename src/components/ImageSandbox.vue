<template>
  <div v-if="loading" :class="class" class="flex text-center">
    <loading-indicator type="circular" class="m-auto h-1/3 w-1/3 !stroke-gray-500" />
  </div>
  <div v-else-if="!contentUrl" :class="class" class="flex text-center">
    <circle-alert-icon class="m-auto text-orange-400" :size="48" />
  </div>
  <iframe
    v-show="!loading && contentUrl"
    :key="contentUrl"
    :src="contentUrl"
    sandbox=""
    :class="class"
    class="m-0 p-0"
    frameborder="0"
    @load="loading = false"
  ></iframe>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { CircleAlertIcon } from "lucide-vue-next";
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
  components: {
    CircleAlertIcon
  },
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

      return `${CONTENT_SANDBOX_URL}/?url=${encodeURIComponent(resolveIpfs(this.src))}${query}`;
    }
  },
  watch: {
    src() {
      this.loading = true;
    }
  }
});
</script>
