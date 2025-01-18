<script setup lang="ts">
import { useAppStore } from "@/stores/appStore";
import KyaModal from "@/components/KYAModal.vue";
import NavHeader from "@/components/NavHeader.vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import Toaster from "@/components/ui/toast/Toaster.vue";
import WalletHeader from "@/components/WalletHeader.vue";
import WalletLogo from "@/components/WalletLogo.vue";
import { isPopup } from "@/common/browser";

const app = useAppStore();
const isPopupView = isPopup();
</script>

<template>
  <div
    class="min-h-[600px] h-screen flex flex-col min-w-[365px] md:mx-auto md:w-4/12 md:shadow-lg"
    :class="{ 'max-w-[365px]': isPopupView }"
  >
    <div
      v-if="$route.meta.fullPage"
      class="flex flex-row items-center justify-between gap-4 border-b border-gray-200 bg-gray-100 p-4"
    >
      <wallet-logo root-class="ml-2" content-class="w-11 h-11" />
      <h1 class="w-full pl-2 font-semibold">
        <template v-if="$route.meta.title">{{ $route.meta.title }}</template>
        <template v-else>Nautilus Wallet</template>
      </h1>
    </div>
    <div v-else class="flex-initial">
      <wallet-header />
      <nav-header />
    </div>

    <ScrollArea class="flex-auto" type="scroll">
      <div class="min-h-[470px] flex-col flex gap-4 px-4 py-6">
        <router-view />
      </div>
    </ScrollArea>
  </div>

  <kya-modal :active="!app.loading && !app.settings.isKyaAccepted" />
  <Toaster />
</template>
