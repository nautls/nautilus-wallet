<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@/stores/appStore";
import WalletLogo from "@/components/WalletLogo.vue";
import WalletItem from "@/components/WalletItem.vue";
import { useWalletStore } from "@/stores/walletStore";

const app = useAppStore();
const wallet = useWalletStore();

const currentWalletItem = computed(() => app.wallets.find((w) => w.id === wallet.id));
</script>

<template>
  <div class="app">
    <div
      class="flex flex-row py-4 px-6 gap-4 items-center justify-between bg-gray-100 border-b-1 border-gray-200"
    >
      <wallet-logo content-class="w-11 h-11" />
      <wallet-item
        v-if="!app.loading && !$route.meta.fullPage && currentWalletItem"
        :key="wallet.id"
        class="w-min"
        :reverse="true"
        :wallet="currentWalletItem"
        :loading="wallet.loading || wallet.syncing"
      />
      <h1 v-else class="text-base font-semibold w-full">
        <template v-if="$route.meta.title">{{ $route.meta.title }}</template>
        <template v-else>Nautilus Wallet</template>
      </h1>
    </div>

    <div class="flex-grow overflow-y-auto overflow-x-hidden p-4">
      <router-view />
    </div>
  </div>
</template>
