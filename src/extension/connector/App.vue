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
    class="bg-background flex h-screen min-w-90 flex-col overflow-hidden text-sm md:mx-auto md:w-4/12 md:shadow-lg"
  >
    <div
      class="bg-header flex shrink-0 flex-row items-center gap-4 px-4 py-3"
      :class="$route.meta.fullPage ? 'justify-center' : 'justify-between'"
    >
      <div v-if="!$route.meta.fullPage" class="flex min-w-0 items-center">
        <WalletItem v-if="currentWalletItem" :wallet="currentWalletItem" class="w-auto min-w-0" />
      </div>
      <NautilusLogo class="shrink-0" />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
