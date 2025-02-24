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
    class="bg-background flex h-screen min-w-[360px] flex-col gap-6 overflow-hidden p-6 text-sm md:mx-auto md:w-4/12 md:shadow-lg"
  >
    <div
      class="bg-header -mx-6 -mt-6 flex flex-row items-center gap-6 px-6 py-4"
      :class="$route.meta.fullPage ? 'justify-center' : 'justify-between'"
    >
      <WalletItem v-if="!$route.meta.fullPage && currentWalletItem" :wallet="currentWalletItem" />
      <NautilusLogo />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
