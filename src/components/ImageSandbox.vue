<script setup lang="ts">
import { computed, HTMLAttributes, ref, watch } from "vue";
import { CircleAlertIcon, ExternalLinkIcon, LoaderCircleIcon } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  CONTENT_SANDBOX_URL,
  IPFS_GENERAL_GATEWAY,
  IPFS_PROTOCOL_PREFIX,
  IPFS_VIDEO_GATEWAY
} from "@/constants/assets";

const props = defineProps<{
  src?: string;
  class?: HTMLAttributes["class"];
  height?: string;
  objectFit?: string;
  overflow?: string;
  displayExternalLink?: boolean;
}>();

const loading = ref(true);

const content = computed(() => resolveIpfs(props.src));
const isContentUrl = computed(() => content.value?.startsWith("http"));

const sandboxUrl = computed(() => {
  if (!props.src) return;

  let query = "";
  if (props.height) query += `&height=${props.height}`;
  if (props.objectFit) query += `&fit=${props.objectFit}`;
  if (props.overflow) query += `&overflow=${props.overflow}`;

  return `${CONTENT_SANDBOX_URL}/?url=${encodeURIComponent(content.value)}${query}`;
});

watch(
  () => props.src,
  () => {
    loading.value = true;
  }
);

function openLink(url: string | undefined) {
  window.open(url, "_blank");
}

function resolveIpfs(url?: string, isVideo = false): string {
  if (!url) return "";
  if (!url.startsWith(IPFS_PROTOCOL_PREFIX)) return url;
  if (isVideo) return url.replace(IPFS_PROTOCOL_PREFIX, IPFS_VIDEO_GATEWAY);
  return url.replace(IPFS_PROTOCOL_PREFIX, IPFS_GENERAL_GATEWAY);
}
</script>

<template>
  <div class="relative">
    <div v-if="loading" :class="props.class" class="flex">
      <LoaderCircleIcon
        type="circular"
        class="animate-spin m-auto size-1/3 text-muted-foreground"
      />
    </div>
    <div v-else-if="!sandboxUrl" :class="props.class" class="flex">
      <circle-alert-icon class="m-auto text-orange-400" :size="48" />
    </div>

    <iframe
      v-show="!loading && sandboxUrl"
      :key="sandboxUrl"
      :src="sandboxUrl"
      sandbox=""
      :class="props.class"
      class="m-0 p-0"
      frameborder="0"
      @load="loading = false"
    ></iframe>

    <Button
      v-if="props.displayExternalLink && isContentUrl"
      class="absolute top-0 right-0 m-2 hover:opacity-100 opacity-70 transition-all"
      size="icon"
      variant="outline"
      @click="openLink(content)"
    >
      <ExternalLinkIcon />
    </Button>
  </div>
</template>
