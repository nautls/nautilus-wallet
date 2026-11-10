<script setup lang="ts">
import { computed } from "vue";
import { ImportIcon, WalletIcon } from "@lucide/vue";
import { I18nT, useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";
import NautilusLogoGlow from "@/components/NautilusLogoGlow.vue";
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

const paths = [
  {
    path: "/add/new",
    icon: WalletIcon,
    variant: "default",
    title: t("wallet.index.create"),
    description: t("wallet.index.createDesc")
  },
  {
    path: "/add/import",
    icon: ImportIcon,
    variant: "outline",
    title: t("wallet.index.import"),
    description: t("wallet.index.importDesc")
  }
] as const;
</script>

<template>
  <div class="flex min-h-0 grow flex-col overflow-y-auto">
    <div class="flex grow flex-col justify-center gap-8 px-4 pt-8 pb-4">
      <div class="flex flex-col items-center text-center">
        <NautilusLogoGlow class="mb-6" />
        <h1 class="text-2xl leading-tight font-semibold tracking-tight text-balance" v-once>
          {{ t("wallet.index.title") }}
        </h1>
        <p class="text-muted-foreground mt-2 max-w-64 text-sm text-balance" v-once>
          {{ t("wallet.index.subtitle") }}
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <router-link
          v-for="item in paths"
          :key="item.path"
          v-slot="{ navigate }"
          :to="item.path"
          custom
        >
          <Button
            :variant="item.variant"
            size="lg"
            class="h-auto w-full justify-start gap-3 px-4 py-3 text-left whitespace-normal [&_svg]:size-5"
            @click="navigate"
          >
            <component :is="item.icon" class="stroke-[1.5]" />
            <span class="flex flex-col gap-0.5">
              <span class="font-semibold">{{ item.title }}</span>
              <span
                class="text-xs font-normal"
                :class="
                  item.variant === 'default'
                    ? 'text-primary-foreground/75'
                    : 'text-muted-foreground'
                "
              >
                {{ item.description }}
              </span>
            </span>
          </Button>
        </router-link>

        <router-link v-slot="{ navigate }" to="/add/hw/ledger" custom>
          <Button
            variant="ghost"
            class="text-muted-foreground self-center"
            @click="handle(navigate, '/add/hw/ledger')"
          >
            <LedgerLogo />
            {{ t("wallet.index.connect") }}
          </Button>
        </router-link>
      </div>
    </div>

    <div class="flex flex-col gap-3 px-4 pb-4">
      <Button v-if="hasWallets" variant="outline" class="w-full" @click="$router.back()">{{
        t("common.cancel")
      }}</Button>

      <I18nT
        keypath="wallet.index.kyaAgreement"
        tag="p"
        class="text-muted-foreground text-center text-xs text-balance"
        scope="global"
      >
        <template #termsOfUse>
          <Link
            external
            class="text-foreground text-nowrap"
            :href="`https://github.com/nautls/nautilus-wallet/blob/${commitHash}/docs/legal/kya.md`"
            >{{ t("common.termsOfUse") }}</Link
          >
        </template>
      </I18nT>
    </div>
  </div>
</template>
