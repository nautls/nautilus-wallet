<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@/stores/appStore";
import { isPopup } from "@/common/browser";
import KyaModal from "@/components/KYAModal.vue";
import WalletLogo from "@/components/WalletLogo.vue";
import WalletHeader from "@/components/WalletHeader.vue";
import NavHeader from "@/components/NavHeader.vue";

const app = useAppStore();
const maxWidth = computed(() => (isPopup() ? "max-w-365px" : undefined));
</script>

<template>
  <div class="app" :class="maxWidth">
    <div
      v-if="$route.meta.fullPage"
      class="flex flex-row p-4 gap-4 items-center justify-between bg-gray-100 border-b-1 border-gray-200"
    >
      <wallet-logo root-class="ml-2" content-class="w-11 h-11" />
      <h1 class="text-base font-semibold w-full pl-2">
        <template v-if="$route.meta.title">{{ $route.meta.title }}</template>
        <template v-else>Nautilus Wallet</template>
      </h1>
    </div>
    <template v-else>
      <wallet-header />
      <nav-header />
    </template>

    <div class="flex-grow overflow-y-auto overflow-x-hidden px-4">
      <router-view />
    </div>

    <kya-modal :active="!app.loading && !app.settings.isKyaAccepted" />
  </div>
</template>
