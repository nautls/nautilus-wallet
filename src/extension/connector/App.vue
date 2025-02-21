<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import NautilusLogo from "@/components/NautilusLogo.vue";
import { Toaster } from "@/components/ui/toast";
import { WalletItem } from "@/components/wallet";

const app = useAppStore();
const wallet = useWalletStore();

const currentWalletItem = computed(() => app.wallets.find((w) => w.id === wallet.id));
</script>

<template>
  <div
    class="flex h-screen min-w-[360px] flex-col overflow-hidden bg-background text-sm md:mx-auto md:w-4/12 md:shadow-lg"
  >
    <div
      class="flex flex-row items-center justify-center gap-6 bg-header px-8 py-5"
      :class="$route.meta.fullPage ? 'justify-center' : 'justify-between'"
    >
      <WalletItem v-if="!$route.meta.fullPage && currentWalletItem" :wallet="currentWalletItem" />
      <NautilusLogo class="mx-4 size-10" />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
