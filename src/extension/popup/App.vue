<script setup lang="ts">
import { defineAsyncComponent, watch } from "vue";
import { useAppStore } from "@/stores/appStore";
import NautilusLogo from "@/components/NautilusLogo.vue";
import Toaster from "@/components/ui/toast/Toaster.vue";
import { WalletSwitcher } from "@/components/wallet";
import { isPopup } from "@/common/browser";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import NavHeader from "./components/NavHeader.vue";

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
    class="min-h-[600px] bg-background h-screen flex overflow-hidden flex-col min-w-[360px] md:mx-auto md:w-4/12 md:shadow-lg"
    :class="{ 'max-w-[360px]': isPopup() }"
  >
    <div v-if="$route.meta.fullPage" class="flex flex-row items-center p-6 gap-4">
      <div class="flex flex-col w-full text-center">
        <div v-if="$route.meta.title" class="text-lg font-semibold leading-tight tracking-tight">
          {{ $route.meta.title }}
        </div>
        <div v-if="$route.meta.description" class="text-muted-foreground text-sm">
          {{ $route.meta.description }}
        </div>
      </div>
    </div>
    <div v-else class="flex-initial">
      <div class="flex flex-row items-center gap-6 bg-header px-4 py-3 pb-0 justify-between">
        <WalletSwitcher />
        <NautilusLogo class="mx-4 my-2" />
      </div>
      <NavHeader />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
