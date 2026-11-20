<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChartPieIcon, ClockIcon, DownloadIcon, LayoutGridIcon, SendIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useWalletStore } from "@/stores/walletStore";

const wallet = useWalletStore();
const route = useRoute();
const { t } = useI18n();

const readonly = computed(() => wallet.type === "readonly");
const navItems = computed(() => [
  { to: "/", icon: ChartPieIcon, label: t("header.nav.assets"), disabled: false },
  { to: "/history", icon: ClockIcon, label: t("header.nav.history"), disabled: false },
  { to: "/receive", icon: DownloadIcon, label: t("header.nav.receive"), disabled: false },
  { to: "/send", icon: SendIcon, label: t("header.nav.send"), disabled: readonly.value },
  { to: "/dapps", icon: LayoutGridIcon, label: t("header.nav.dApps"), disabled: readonly.value }
]);

const activeIndex = computed(() =>
  navItems.value.findIndex((item) => route.matched.some((record) => record.path === item.to))
);

// on routes outside the nav (settings, about) the bar fades out in place, and it fades back in
// at the new item instead of sliding across from the one it left
const indicatorIndex = ref(Math.max(activeIndex.value, 0));
const slide = ref(true);
watch(activeIndex, (index, previous) => {
  if (index === -1) return;
  slide.value = previous !== -1;
  indicatorIndex.value = index;
});
</script>

<template>
  <nav class="bg-header relative flex flex-row items-stretch border-b px-2">
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
      </a>
    </router-link>
    <div class="pointer-events-none absolute inset-x-2 -bottom-px h-0.5" aria-hidden="true">
      <div
        class="ease-snap h-full px-4 duration-200 motion-reduce:transition-none"
        :class="[
          slide ? 'transition-[translate,opacity]' : 'transition-opacity',
          activeIndex === -1 ? 'opacity-0' : 'opacity-100'
        ]"
        :style="{
          width: `${100 / navItems.length}%`,
          translate: `${indicatorIndex * 100}% 0`
        }"
      >
        <div class="bg-primary size-full rounded-full" />
      </div>
    </div>
  </nav>
</template>
