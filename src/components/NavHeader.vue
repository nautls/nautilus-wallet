<script setup lang="ts">
import { computed } from "vue";
import { ChartPieIcon, ClockIcon, DownloadIcon, LayoutGridIcon, SendIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import { WalletType } from "@/types/internal";

const wallet = useWalletStore();
const iconSize = 22;

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
  <nav class="flex flex-row items-center bg-header p-0 px-4 text-sm">
    <router-link
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      :class="{ 'pointer-events-none opacity-40': item.disabled }"
      active-class="border-b-0 border-primary text-primary cursor-default"
      class="flex-grow border-b-0 border-muted-foreground text-muted-foreground transition-colors outline-none hover:text-primary focus:outline-none active:text-primary active:outline-none"
    >
      <component :is="item.icon" :size="iconSize" class="m-3 mx-auto stroke-[1.5px]" />
    </router-link>
  </nav>
</template>
