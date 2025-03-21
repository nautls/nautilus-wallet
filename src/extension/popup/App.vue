<script setup lang="ts">
import { defineAsyncComponent, watch } from "vue";
import { ChevronLeftIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import NautilusLogo from "@/components/NautilusLogo.vue";
import { Button } from "@/components/ui/button";
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
    class="bg-background flex h-screen min-h-[600px] min-w-[360px] flex-col overflow-hidden md:mx-auto md:w-4/12 md:shadow-lg"
    :class="{ 'max-w-[360px]': isPopup() }"
  >
    <template v-if="$route.meta.fullPage">
      <div v-if="$route.meta.title" class="flex w-full flex-row items-center p-6">
        <Button class="z-10" variant="ghost" size="icon" @click="$router.back">
          <ChevronLeftIcon />
        </Button>

        <div class="-ml-9 flex w-full flex-col text-center">
          <div class="text-xl leading-tight font-semibold tracking-tight">
            {{ $route.meta.title }}
          </div>
          <div v-if="$route.meta.description" class="text-muted-foreground text-sm">
            {{ $route.meta.description }}
          </div>
        </div>
      </div>
    </template>
    <div v-else class="flex-initial">
      <div class="bg-header flex flex-row items-center justify-between gap-6 px-4 py-3 pb-0">
        <WalletSwitcher />
        <NautilusLogo class="mx-4" />
      </div>
      <NavHeader />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
