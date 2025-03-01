<script setup lang="ts">
import { computed } from "vue";
import { ChartPieIcon, ClockIcon, DownloadIcon, LayoutGridIcon, SendIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import { WalletType } from "@/types/internal";

const wallet = useWalletStore();

const readonly = computed(() => wallet.type === WalletType.ReadOnly);
const navItems = computed(() => [
  { to: "/", icon: ChartPieIcon, label: "Overview", disabled: false },
  { to: "/history", icon: ClockIcon, label: "History", disabled: false },
  { to: "/receive", icon: DownloadIcon, label: "Receive", disabled: false },
  { to: "/send", icon: SendIcon, label: "Send", disabled: readonly.value },
  { to: "/dapps", icon: LayoutGridIcon, label: "DApps", disabled: false }
]);
</script>

<template>
  <nav class="bg-header flex flex-row items-center border-b px-4 text-sm">
    <router-link
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      :class="{ 'pointer-events-none opacity-40': item.disabled }"
      active-class="text-primary cursor-default"
      class="text-muted-foreground hover:text-primary active:text-primary grow py-4 outline-hidden transition-colors focus:outline-hidden active:outline-hidden"
    >
      <component :is="item.icon" class="mx-auto size-[22px] stroke-[1.5px]" />
    </router-link>
  </nav>
</template>
