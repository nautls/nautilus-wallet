<script setup lang="ts">
import { defineAsyncComponent, watch } from "vue";
import { useAppStore } from "@/stores/appStore";
import NavHeader from "@/components/NavHeader.vue";
import Toaster from "@/components/ui/toast/Toaster.vue";
import WalletHeader from "@/components/WalletHeader.vue";
import WalletLogo from "@/components/WalletLogo.vue";
import { isPopup } from "@/common/browser";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";

const isPopupView = isPopup();

const app = useAppStore();
const { open: openKyaDialog } = useProgrammaticDialog(
  defineAsyncComponent(() => import("@/components/KYADialog.vue"))
);

watch(
  () => app.loading,
  (loading) => {
    if (loading || app.settings.isKyaAccepted) return;
    openKyaDialog();
  },
  { once: true }
);
</script>

<template>
  <div
    class="min-h-[600px] h-screen flex overflow-hidden flex-col min-w-[360px] md:mx-auto md:w-4/12 md:shadow-lg"
    :class="{ 'max-w-[360px]': isPopupView }"
  >
    <div
      v-if="$route.meta.fullPage"
      class="flex flex-row items-center justify-between gap-4 border-b border-gray-200 bg-gray-100 p-4"
    >
      <wallet-logo root-class="ml-2" content-class="size-11" />
      <h1 class="w-full pl-2 font-semibold">
        <template v-if="$route.meta.title">{{ $route.meta.title }}</template>
        <template v-else>Nautilus Wallet</template>
      </h1>
    </div>
    <div v-else class="flex-initial">
      <wallet-header />
      <nav-header />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
