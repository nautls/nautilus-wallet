<script setup lang="ts">
import { computed } from "vue";
import { RotateCcwIcon, WalletIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import LedgerLogo from "@/assets/images/hw-devices/ledger-logo.svg";

const wallet = useWalletStore();
const hasWallets = computed(() => wallet.id !== 0);

const routes = [
  {
    path: "/add/new",
    icon: {
      component: WalletIcon,
      class: "stroke-[1.3px]"
    },
    title: "Create New Wallet",
    description: "Create a new Ergo Wallet"
  },
  {
    path: "/add/hw/ledger",
    icon: {
      component: LedgerLogo,
      class: ""
    },
    title: "Connect Ledger Wallet",
    description: "Connect to a Ledger Hardware Wallet"
  },
  {
    path: "/add/restore",
    icon: {
      component: RotateCcwIcon,
      class: "stroke-[1.3px]"
    },
    title: "Restore Wallet",
    description: "Restore an existing Ergo Wallet"
  }
];
</script>

<template>
  <div class="flex h-full flex-col gap-6 p-4">
    <div class="flex-grow"></div>
    <router-link
      v-for="route in routes"
      :key="route.path"
      v-slot="{ navigate }"
      :to="route.path"
      custom
    >
      <Button
        variant="outline"
        class="w-full h-auto text-left [&_svg]:size-10 justify-center p-6 gap-6 whitespace-normal"
        @click="navigate"
      >
        <component :is="route.icon.component" :class="route.icon.class" />

        <div class="flex flex-col w-full">
          <span class="font-semibold">{{ route.title }}</span>
          <span class="text-muted-foreground text-xs">{{ route.description }}</span>
        </div>
      </Button>
    </router-link>

    <div class="flex-grow"></div>
    <Button v-if="hasWallets" class="w-full" size="lg" @click="$router.back()">Cancel</Button>
  </div>
</template>
