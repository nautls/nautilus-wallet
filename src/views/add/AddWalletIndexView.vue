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
  <div class="flex flex-row items-center px-6 pt-8 gap-4">
    <div class="flex flex-col w-full text-center">
      <div class="relative m-auto size-24 mb-4">
        <div
          class="absolute top-1/2 left-1/2 -translate-y-1/2 bg-gradient-to-br from-50% to-50% from-yellow-500 to-sky-500 -translate-x-1/2 blur-lg rounded-full size-full"
        ></div>
        <NautilusLogo
          class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full size-20"
        />
      </div>
      <div class="text-xl font-semibold leading-tight tracking-tight">
        Welcome to Nautilus Wallet
      </div>
      <div class="text-muted-foreground text-sm">Choose an option to get started</div>
    </div>
  </div>

  <div class="flex h-full flex-col gap-6 p-6 justify-end">
    <router-link
      v-for="route in routes"
      :key="route.path"
      v-slot="{ navigate }"
      :to="route.path"
      custom
    >
      <Button
        variant="outline"
        class="w-full h-auto text-left [&_svg]:size-10 justify-center py-4 px-6 gap-6 whitespace-normal"
        @click="navigate"
      >
        <component :is="route.icon.component" :class="route.icon.class" />

        <div class="flex flex-col w-full">
          <span class="font-semibold">{{ route.title }}</span>
          <span class="text-muted-foreground text-xs">{{ route.description }}</span>
        </div>
      </Button>
    </router-link>

    <Button v-if="hasWallets" variant="outline" class="w-full" size="lg" @click="$router.back()"
      >Cancel</Button
    >
  </div>
</template>
