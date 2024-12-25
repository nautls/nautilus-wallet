<script setup lang="ts">
import { computed } from "vue";
import { ChartPieIcon, ClockIcon, DownloadIcon, LayoutGridIcon, SendIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import { WalletType } from "@/types/internal";

const wallet = useWalletStore();
const iconSize = 22;

const readonly = computed(() => wallet.type === WalletType.ReadOnly);
const visibleNavItems = computed(() =>
  [
    { to: "/", icon: ChartPieIcon, label: "Overview", visible: true },
    { to: "/history", icon: ClockIcon, label: "History", visible: true },
    { to: "/receive", icon: DownloadIcon, label: "Receive", visible: true },
    { to: "/send", icon: SendIcon, label: "Send", visible: !readonly.value },
    { to: "/dapps", icon: LayoutGridIcon, label: "DApps", visible: true }
  ].filter((i) => i.visible)
);
</script>

<template>
  <nav class="flex flex-row items-center bg-foreground/5 p-0 px-4 text-sm text-foreground">
    <router-link
      v-for="item in visibleNavItems"
      :key="item.to"
      :to="item.to"
      active-class="border-b-0 border-primary text-primary"
      class="flex-grow border-b-0 border-foreground/10 text-muted-foreground transition-colors outline-none hover:text-primary focus:outline-none active:text-primary active:outline-none"
    >
      <component :is="item.icon" :size="iconSize" class="m-3 mx-auto" />
    </router-link>
  </nav>
</template>
