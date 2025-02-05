<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import NautilusLogo from "@/components/NautilusLogo.vue";
import WalletItem from "@/components/WalletItem.vue";

const app = useAppStore();
const wallet = useWalletStore();

const currentWalletItem = computed(() => app.wallets.find((w) => w.id === wallet.id));
</script>

<template>
  <div class="app">
    <div
      class="border-b-1 flex flex-row items-center justify-between gap-4 border-gray-200 bg-gray-100 px-6 py-4"
    >
      <NautilusLogo content-class="w-11 h-11" />
      <WalletItem
        v-if="!app.loading && !$route.meta.fullPage && currentWalletItem"
        :key="wallet.id"
        class="w-min"
        :reverse="true"
        :wallet="currentWalletItem"
        :loading="wallet.loading || wallet.syncing"
      />
      <h1 v-else class="w-full text-base font-semibold">
        <template v-if="$route.meta.title">{{ $route.meta.title }}</template>
        <template v-else>Nautilus Wallet</template>
      </h1>
    </div>

    <div class="flex-grow overflow-y-auto overflow-x-hidden p-4">
      <router-view />
    </div>
  </div>
</template>
