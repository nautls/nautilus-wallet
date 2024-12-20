<script setup lang="ts">
import { computed } from "vue";
import {
  ChartPieIcon,
  ClockIcon,
  DownloadIcon,
  ImageIcon,
  LayoutGridIcon,
  SendIcon
} from "lucide-vue-next";
import { WalletType } from "@/types/internal";
import { useWalletStore } from "@/stores/walletStore";

const wallet = useWalletStore();
const iconSize = 22;

const readonly = computed(() => wallet.type === WalletType.ReadOnly);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
</script>

<template>
  <nav class="tabs">
    <div class="tab-item spacing"></div>
    <router-link to="/" active-class="active" class="tab-item w-full">
      <tool-tip position="bottom" label="Assets">
        <chart-pie-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <!-- <router-link v-if="containsArtwork" to="/nft" active-class="active" class="tab-item w-full">
      <tool-tip position="bottom" label="NFT gallery">
        <image-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link> -->
    <router-link to="/history" active-class="active" class="tab-item w-full">
      <tool-tip position="bottom" label="History">
        <clock-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link to="/receive" active-class="active" class="tab-item w-full">
      <tool-tip position="bottom" label="Receive">
        <download-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link v-if="!readonly" to="/send" active-class="active" class="tab-item w-full">
      <tool-tip position="bottom" label="Send">
        <send-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link to="/dapps" active-class="active" class="tab-item w-full">
      <tool-tip position="bottom" label="dApps">
        <layout-grid-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <div class="tab-item spacing"></div>
  </nav>
</template>

<style lang="css" scoped>
.tabs {
  @apply flex flex-row bg-foreground/5 p-0 text-sm text-foreground;
}

.tabs .tab-item {
  @apply block max-w-20 border-b-0 border-foreground/10 text-center outline-none transition-all duration-150 ease-linear hover:text-primary focus:outline-none active:text-primary active:outline-none;
}

.tabs .tab-item.spacing {
  @apply max-w-full flex-grow;
}

.tabs .tab-item.active {
  @apply border-b-0 border-blue-600 text-blue-700;
}
</style>
