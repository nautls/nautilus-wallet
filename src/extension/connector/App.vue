<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import NautilusLogo from "@/components/NautilusLogo.vue";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UnlockSessionButton, UnlockSessionDialog, WalletItem } from "@/components/wallet";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";

const app = useAppStore();
const wallet = useWalletStore();

const { open: openUnlockDialog } = useProgrammaticDialog(UnlockSessionDialog);

const currentWalletItem = computed(() => app.wallets.find((w) => w.id === wallet.id));
</script>

<template>
  <div
    class="bg-background flex h-screen min-w-[360px] flex-col gap-4 overflow-hidden p-4 text-sm md:mx-auto md:w-4/12 md:shadow-lg"
  >
    <div
      class="bg-header -mx-4 -mt-4 flex flex-row items-center gap-4 px-6 py-4"
      :class="$route.meta.fullPage ? 'justify-center' : 'justify-between'"
    >
      <div v-if="!$route.meta.fullPage" class="flex min-w-0 items-center gap-2">
        <WalletItem v-if="currentWalletItem" :wallet="currentWalletItem" class="w-auto min-w-0" />
        <TooltipProvider :delay-duration="100">
          <UnlockSessionButton @unlock="openUnlockDialog()" />
        </TooltipProvider>
      </div>
      <NautilusLogo class="shrink-0" />
    </div>

    <router-view />
  </div>

  <Toaster />
</template>
