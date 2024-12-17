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
    <router-link to="/" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Assets">
        <chart-pie-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link v-if="containsArtwork" to="/nft" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="NFT gallery">
        <image-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link to="/history" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="History">
        <clock-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link to="/receive" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Receive">
        <download-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link v-if="!readonly" to="/send" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Send">
        <send-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <router-link to="/dapps" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="dApps">
        <layout-grid-icon class="m-3" :size="iconSize" />
      </tool-tip>
    </router-link>
    <div class="tab-item spacing"></div>
  </nav>
</template>
