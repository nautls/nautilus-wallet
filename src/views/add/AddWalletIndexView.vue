<script setup lang="ts">
import { computed } from "vue";
import { ImportIcon, WalletIcon } from "lucide-vue-next";
import { I18nT, useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";
import NautilusLogo from "@/components/NautilusLogo.vue";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import LedgerLogo from "@/assets/images/hw-devices/ledger-logo.svg";
import { browser } from "@/common/browser";
import { EXT_ENTRY_ROOT } from "@/constants/extension";

const wallet = useWalletStore();
const { t } = useI18n();

const hasWallets = computed(() => wallet.id !== 0);
const commitHash = import.meta.env.GIT_COMMIT_HASH;

/**
 * Navigate to a route in a new tab
 * @param navigate - Router navigate function
 * @param href - Route href
 */
function navigateInTab(navigate: () => unknown, href: string) {
  if (!browser || !browser.tabs) return navigate();
  const url = browser.runtime.getURL(`${EXT_ENTRY_ROOT}/popup/index.html#${href}?redirect=false`);
  browser.tabs.create({ url, active: true });
  window.close();
}

/**
 * Handle navigation to a route
 * @param navigate - Router navigate function
 * @param href - Route href
 */
function handle(navigate: () => unknown, href: string) {
  // Interacting with devices over WebUSB or WebHID for the first time requires a
  // new tab to be opened. ore info: https://issues.chromium.org/issues/40233645.
  if (href === "/add/hw/ledger") {
    navigateInTab(navigate, href);
  } else {
    navigate();
  }
}

const routes = [
  {
    path: "/add/new",
    icon: {
      component: WalletIcon,
      class: "stroke-[1px]"
    },
    title: t("wallet.index.create"),
    description: t("wallet.index.createDesc")
  },
  {
    path: "/add/hw/ledger",
    icon: {
      component: LedgerLogo,
      class: "p-1"
    },
    title: t("wallet.index.connect"),
    description: t("wallet.index.connectDesc")
  },
  {
    path: "/add/import",
    icon: {
      component: ImportIcon,
      class: "stroke-[1px]"
    },
    title: t("wallet.index.import"),
    description: t("wallet.index.importDesc")
  }
];
</script>

<template>
  <div class="flex flex-row items-center gap-4 px-6 pt-8">
    <div class="flex w-full flex-col text-center">
      <div class="relative m-auto mb-4 size-24">
        <div
          class="absolute top-1/2 left-1/2 size-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-br from-yellow-500 from-50% to-sky-500 to-50% blur-lg"
        ></div>
        <NautilusLogo
          class="absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
      </div>
      <div class="text-xl leading-tight font-semibold tracking-tight" v-once>
        {{ t("wallet.index.title") }}
      </div>
      <div class="text-muted-foreground text-sm" v-once>{{ t("wallet.index.subtitle") }}</div>
    </div>
  </div>

  <div class="flex h-full flex-col justify-end gap-4 p-6">
    <router-link
      v-for="route in routes"
      :key="route.path"
      v-slot="{ navigate }"
      :to="route.path"
      custom
    >
      <Button
        variant="outline"
        class="h-auto w-full justify-center gap-6 px-6 py-4 text-left whitespace-normal [&_svg]:size-10"
        @click="handle(navigate, route.path)"
      >
        <component :is="route.icon.component" :class="route.icon.class" />

        <div class="flex w-full flex-col">
          <span class="font-semibold">{{ route.title }}</span>
          <span class="text-muted-foreground text-xs">{{ route.description }}</span>
        </div>
      </Button>
    </router-link>

    <div class="grow"></div>

    <div class="space-y-2" v-once>
      <Button v-if="hasWallets" variant="outline" class="w-full" @click="$router.back()">{{
        t("common.cancel")
      }}</Button>

      <I18nT
        keypath="wallet.index.kyaAgreement"
        tag="p"
        class="font-xs text-muted-foreground px-16 text-center"
        scope="global"
      >
        <template #termsOfUse>
          <Link
            external
            class="text-nowrap text-blue-500/80"
            :href="`https://github.com/nautls/nautilus-wallet/blob/${commitHash}/docs/legal/kya.md`"
            >{{ t("common.termsOfUse") }}</Link
          >
        </template>
      </I18nT>
    </div>
  </div>
</template>
