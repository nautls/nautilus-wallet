<script setup lang="ts">
import { computed, HTMLAttributes, ref, watch } from "vue";
import { CircleAlertIcon, ExternalLinkIcon, LoaderCircleIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { CONTENT_SANDBOX_URL, IPFS_PROTOCOL_PREFIX } from "@/constants/assets";

const props = defineProps<{
  src?: string;
  class?: HTMLAttributes["class"];
  height?: string;
  objectFit?: string;
  overflow?: string;
  displayExternalLink?: boolean;
}>();

const app = useAppStore();
const loading = ref(true);

const content = computed(() => resolveIpfs(props.src));
const isContentUrl = computed(() => content.value?.startsWith("http"));
const gateway = computed(() =>
  app.settings.ipfsGateway.endsWith("/") ? app.settings.ipfsGateway : `${app.settings.ipfsGateway}/`
);
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

function resolveIpfs(url?: string): string {
  if (!url) return "";
  if (!url.startsWith(IPFS_PROTOCOL_PREFIX)) return url;
  return url.replace(IPFS_PROTOCOL_PREFIX, gateway.value);
}
</script>

<template>
  <div class="relative">
    <div v-if="loading" :class="props.class" class="flex">
      <LoaderCircleIcon
        type="circular"
        class="text-muted-foreground m-auto size-1/3 animate-spin"
      />
    </div>
    <div v-else-if="!sandboxUrl" :class="props.class" class="flex">
      <CircleAlertIcon class="m-auto text-orange-400" :size="48" />
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
      class="absolute top-0 right-0 m-2 opacity-70 transition-all hover:opacity-100"
      size="icon"
      variant="outline"
      @click="openLink(content)"
    >
      <ExternalLinkIcon />
    </Button>
  </div>
</template>
