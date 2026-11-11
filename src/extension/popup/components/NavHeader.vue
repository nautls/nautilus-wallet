<script setup lang="ts">
import { computed } from "vue";
import { ChartPieIcon, ClockIcon, DownloadIcon, LayoutGridIcon, SendIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";

const wallet = useWalletStore();
const { t } = useI18n();

const readonly = computed(() => wallet.type === "readonly");
const navItems = computed(() => [
  { to: "/", icon: ChartPieIcon, label: t("header.nav.assets"), disabled: false },
  { to: "/history", icon: ClockIcon, label: t("header.nav.history"), disabled: false },
  { to: "/receive", icon: DownloadIcon, label: t("header.nav.receive"), disabled: false },
  { to: "/send", icon: SendIcon, label: t("header.nav.send"), disabled: readonly.value },
  { to: "/dapps", icon: LayoutGridIcon, label: t("header.nav.dApps"), disabled: readonly.value }
]);
</script>

<template>
  <nav class="bg-header flex flex-row items-stretch border-b px-2">
    <router-link
      v-for="item in navItems"
      :key="item.to"
      v-slot="{ href, navigate, isActive }"
      :to="item.to"
      custom
    >
      <a
        :href="href"
        :data-nav="item.to"
        :aria-current="isActive ? 'page' : undefined"
        :aria-disabled="item.disabled || undefined"
        :tabindex="item.disabled ? -1 : undefined"
        :class="[
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          { 'pointer-events-none opacity-40': item.disabled }
        ]"
        :title="item.label"
        class="focus-visible:ring-ring/60 relative flex grow justify-center rounded-md py-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset"
        @click="navigate"
      >
        <component
          :is="item.icon"
          class="size-5.5"
          :class="isActive ? 'stroke-2' : 'stroke-[1.5px]'"
          aria-hidden="true"
        />
        <span class="sr-only">{{ item.label }}</span>
        <span
          v-if="isActive"
          class="bg-primary absolute inset-x-4 -bottom-px h-0.5 rounded-full"
          aria-hidden="true"
        />
      </a>
    </router-link>
  </nav>
</template>
