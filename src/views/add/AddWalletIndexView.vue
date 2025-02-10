<script setup lang="ts">
import { computed } from "vue";
import { RotateCcwIcon, WalletIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import NautilusLogo from "@/components/NautilusLogo.vue";
import { Button } from "@/components/ui/button";
import LedgerLogo from "@/assets/images/hw-devices/ledger-logo.svg";

const wallet = useWalletStore();
const hasWallets = computed(() => wallet.id !== 0);

const routes = [
  {
    path: "/add/new",
    icon: {
      component: WalletIcon,
      class: "stroke-[1px]"
    },
    title: "Create a new wallet",
    description: "Create a new Ergo Wallet"
  },
  {
    path: "/add/hw/ledger",
    icon: {
      component: LedgerLogo,
      class: "p-1"
    },
    title: "Connect a Ledger wallet",
    description: "Connect to a Ledger Hardware Wallet"
  },
  {
    path: "/add/restore",
    icon: {
      component: RotateCcwIcon,
      class: "stroke-[1px]"
    },
    title: "Import a wallet",
    description: "Import an existing Ergo Wallet"
  }
];
</script>

<template>
  <div class="flex flex-row items-center gap-4 px-6 pt-8">
    <div class="flex w-full flex-col text-center">
      <div class="relative m-auto mb-4 size-24">
        <div
          class="absolute left-1/2 top-1/2 size-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-yellow-500 from-50% to-sky-500 to-50% blur-lg"
        ></div>
        <NautilusLogo
          class="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
      </div>
      <div class="text-xl font-semibold leading-tight tracking-tight">
        Welcome to Nautilus Wallet
      </div>
      <div class="text-sm text-muted-foreground">Choose an option to get started</div>
    </div>
  </div>

  <div class="flex h-full flex-col justify-end gap-6 p-6">
    <router-link
      v-for="route in routes"
      :key="route.path"
      v-slot="{ navigate }"
      :to="route.path"
      custom
    >
      <Button
        variant="outline"
        class="h-auto w-full justify-center gap-6 whitespace-normal px-6 py-4 text-left [&_svg]:size-10"
        @click="navigate"
      >
        <component :is="route.icon.component" :class="route.icon.class" />

        <div class="flex w-full flex-col">
          <span class="font-semibold">{{ route.title }}</span>
          <span class="text-xs text-muted-foreground">{{ route.description }}</span>
        </div>
      </Button>
    </router-link>

    <Button v-if="hasWallets" variant="outline" class="w-full" size="lg" @click="$router.back()"
      >Cancel</Button
    >
  </div>
</template>
