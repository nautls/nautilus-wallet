<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ExternalLinkIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MnemonicBackupDialog } from "@/components/wallet";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";
import { RECENT_WALLET_INTERVAL } from "@/constants/intervals";
import { walletsDbService } from "@/database/walletsDbService";
import { AddressState } from "@/types/internal";

const STORAGE_RENT_URL = "https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/";

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();
const { t } = useI18n();

const { open: openMnemonicBackupDialog } = useProgrammaticDialog(MnemonicBackupDialog);

const isUsed = computed(() => wallet.addresses.some((a) => a.state === AddressState.Used));
const isRecent = computed(() => Date.now() - wallet.createdAt < RECENT_WALLET_INTERVAL);

// only display the backup alert if the wallet is used or not recently added
const showBackupAlert = computed(
  () => !wallet.loading && wallet.needsBackup && (isUsed.value || !isRecent.value)
);

// unused wallets get a neutral alert, used ones get more urgent as time passes
const backupAlertVariant = computed(() =>
  !isUsed.value ? "default" : isRecent.value ? "destructive-outline" : "destructive"
);

const goToOptimizationDapp = () => router.push({ name: "wallet-optimization" });

const hasMaster = ref<boolean>();
watch(
  () => app.wallets.length,
  async () => (hasMaster.value = await walletsDbService.hasMasterPassword()),
  { immediate: true }
);

const hasStandardWallet = computed(() => app.wallets.some((w) => w.type === "standard"));

const showMasterPasswordAlert = computed(
  () =>
    hasMaster.value === false &&
    hasStandardWallet.value &&
    !app.settings.masterPasswordAlertDismissed
);

function openUrl(url: string) {
  window.open(url, "_blank");
}
</script>

<template>
  <Alert v-if="showMasterPasswordAlert" data-master-password-alert>
    <AlertTitle>{{ t("masterSetup.alert") }}</AlertTitle>

    <AlertDescription class="hyphens-auto">
      {{ t("masterSetup.alertDesc") }}
    </AlertDescription>

    <div class="col-start-2 mt-4 flex gap-2">
      <Button
        class="flex-1"
        variant="ghost"
        @click="app.settings.masterPasswordAlertDismissed = true"
        >{{ t("masterSetup.dontAskAgain") }}</Button
      >
      <Button class="flex-1" @click="router.push({ name: 'master-password-setup' })">{{
        t("settings.password.setUp")
      }}</Button>
    </div>
  </Alert>

  <Alert v-if="showBackupAlert" :variant="backupAlertVariant">
    <AlertTitle>{{ t("wallet.alerts.backup") }}</AlertTitle>

    <AlertDescription class="hyphens-auto">
      {{ t("wallet.alerts.backupDesc") }}
    </AlertDescription>

    <Button class="col-start-2 mt-4 w-full" @click="openMnemonicBackupDialog">{{
      t("wallet.alerts.backupNow")
    }}</Button>
  </Alert>

  <Alert v-if="wallet.health.hasOldUtxos" variant="destructive">
    <AlertTitle>{{ t("wallet.alerts.demurrage") }}</AlertTitle>

    <div class="col-start-2 space-y-4">
      <AlertDescription class="hyphens-auto">
        {{ t("wallet.alerts.demurrageDesc") }}
      </AlertDescription>

      <Button class="w-full" variant="ghost" @click="() => openUrl(STORAGE_RENT_URL)"
        >{{ t("common.learnMore") }}<ExternalLinkIcon
      /></Button>
      <Button class="w-full" @click="goToOptimizationDapp">{{ t("common.consolidate") }}</Button>
    </div>
  </Alert>

  <Alert v-else-if="wallet.health.utxoCount > HEALTHY_UTXO_COUNT">
    <AlertTitle>{{ t("wallet.alerts.fragmentation") }}</AlertTitle>

    <AlertDescription class="hyphens-auto">
      {{ t("wallet.alerts.fragmentationDesc") }}
    </AlertDescription>

    <Button class="col-start-2 mt-4 w-full" @click="goToOptimizationDapp">{{
      t("common.optimize")
    }}</Button>
  </Alert>
</template>
