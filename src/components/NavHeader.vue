<script setup lang="ts">
import { computed } from "vue";
import { WalletType } from "@/types/internal";
import { useWalletStore } from "@/stores/walletStore";

const wallet = useWalletStore();

const readonly = computed(() => wallet.type === WalletType.ReadOnly);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
</script>

<template>
  <nav class="tabs">
    <div class="tab-item spacing"></div>
    <router-link to="/" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Assets">
        <vue-feather type="pie-chart" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <router-link v-if="containsArtwork" to="/nft" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="NFT gallery">
        <vue-feather type="image" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <router-link to="/receive" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Receive">
        <vue-feather type="download" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <router-link v-if="!readonly" to="/send" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Send">
        <vue-feather type="send" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <router-link to="/dapps" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="dApps">
        <vue-feather type="grid" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <div class="tab-item spacing"></div>
  </nav>
</template>
