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
    class="flex h-screen min-h-[600px] min-w-[360px] flex-col overflow-hidden bg-background md:mx-auto md:w-4/12 md:shadow-lg"
    :class="{ 'max-w-[360px]': isPopup() }"
  >
    <template v-if="$route.meta.fullPage">
      <div v-if="$route.meta.title" class="flex w-full flex-row items-center p-6">
        <Button class="z-10" variant="ghost" size="icon" @click="$router.back">
          <ChevronLeftIcon />
        </Button>

        <div class="-ml-9 flex w-full flex-col text-center">
          <div class="text-xl font-semibold leading-tight tracking-tight">
            {{ $route.meta.title }}
          </div>
          <div v-if="$route.meta.description" class="text-sm text-muted-foreground">
            {{ $route.meta.description }}
          </div>
        </div>
      </div>
    </template>
    <div v-else class="flex-initial">
      <div class="flex flex-row items-center justify-between gap-6 bg-header px-4 py-3 pb-0">
        <WalletSwitcher />
        <NautilusLogo class="mx-4 my-2" />
      </div>
      <NavHeader />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
