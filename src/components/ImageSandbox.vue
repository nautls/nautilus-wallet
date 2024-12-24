<script setup lang="ts">
import { computed, HTMLAttributes, ref, watch } from "vue";
import { CircleAlertIcon } from "lucide-vue-next";
import {
  CONTENT_SANDBOX_URL,
  IPFS_GENERAL_GATEWAY,
  IPFS_PROTOCOL_PREFIX,
  IPFS_VIDEO_GATEWAY
} from "@/constants/assets";
import LoadingIndicator from "./LoadingIndicator.vue";

const props = defineProps<{
  src?: string;
  class?: HTMLAttributes["class"];
  height?: string;
  objectFit?: string;
  overflow?: string;
}>();

const loading = ref(true);

const contentUrl = computed(() => {
  if (!props.src) return;

  let query = "";
  if (props.height) query += `&height=${props.height}`;
  if (props.objectFit) query += `&fit=${props.objectFit}`;
  if (props.overflow) query += `&overflow=${props.overflow}`;

  return `${CONTENT_SANDBOX_URL}/?url=${encodeURIComponent(resolveIpfs(props.src))}${query}`;
});

watch(
  () => props.src,
  () => {
    loading.value = true;
  }
);

function resolveIpfs(url?: string, isVideo = false): string {
  if (!url) return "";
  if (!url.startsWith(IPFS_PROTOCOL_PREFIX)) return url;
  if (isVideo) return url.replace(IPFS_PROTOCOL_PREFIX, IPFS_VIDEO_GATEWAY);
  return url.replace(IPFS_PROTOCOL_PREFIX, IPFS_GENERAL_GATEWAY);
}
</script>

<template>
  <div v-if="loading" :class="props.class" class="flex">
    <loading-indicator type="circular" class="m-auto h-1/3 w-1/3 !stroke-muted-foreground" />
  </div>
  <div v-else-if="!contentUrl" :class="props.class" class="flex">
    <circle-alert-icon class="m-auto text-orange-400" :size="48" />
  </div>
  <iframe
    v-show="!loading && contentUrl"
    :key="contentUrl"
    :src="contentUrl"
    sandbox=""
    :class="props.class"
    class="m-0 p-0"
    frameborder="0"
    @load="loading = false"
  ></iframe>
</template>
