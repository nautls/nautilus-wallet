<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ExternalLinkIcon } from "@lucide/vue";
import { useIntervalFn } from "@vueuse/core";
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

const now = ref(Date.now());
useIntervalFn(() => (now.value = Date.now()), 60_000);

const isUsed = computed(() => wallet.addresses.some((a) => a.state === AddressState.Used));
const isRecent = computed(() => now.value - wallet.createdAt < RECENT_WALLET_INTERVAL);

// only display the backup alert if the wallet is used or not recently added
const showBackupAlert = computed(
  () => !wallet.loading && wallet.needsBackup && (isUsed.value || !isRecent.value)
);

// unused wallets get a neutral alert, used ones get more urgent as time passes
const backupAlertVariant = computed(() =>
  !isUsed.value ? "default" : isRecent.value ? "destructive-outline" : "destructive"
);

// read-only wallets would reach the optimizer only to be refused at signing
const canOptimize = computed(() => wallet.type !== "readonly");

const goToOptimizationDapp = () => router.push({ name: "wallet-optimization" });

const hasMaster = ref<boolean>();
let masterCheckId = 0;
watch(
  () => app.wallets.length,
  async () => {
    const checkId = ++masterCheckId;
    let result: boolean | undefined;
    try {
      result = await walletsDbService.hasMasterPassword();
    } catch {
      result = undefined; // unknown, so don't nag
    }

    // a slower earlier check must not overwrite a newer one
    if (checkId === masterCheckId) hasMaster.value = result;
  },
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
  window.open(url, "_blank", "noopener,noreferrer");
}
</script>

<template>
  <Alert v-if="showMasterPasswordAlert" data-master-password-alert>
    <AlertTitle>{{ t("masterSetup.alert") }}</AlertTitle>

    <AlertDescription>
      {{ t("masterSetup.alertDesc") }}
    </AlertDescription>

    <div class="col-start-2 mt-3 flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="ghost" @click="app.settings.masterPasswordAlertDismissed = true">{{
        t("masterSetup.dontAskAgain")
      }}</Button>
      <Button size="sm" @click="router.push({ name: 'master-password-setup' })">{{
        t("settings.password.setUp")
      }}</Button>
    </div>
  </Alert>

  <Alert v-if="showBackupAlert" :variant="backupAlertVariant">
    <AlertTitle>{{ t("wallet.alerts.backup") }}</AlertTitle>

    <AlertDescription>
      {{ t("wallet.alerts.backupDesc") }}
    </AlertDescription>

    <div class="col-start-2 mt-3 flex flex-wrap justify-end gap-2">
      <Button size="sm" @click="openMnemonicBackupDialog">{{
        t("wallet.alerts.backupNow")
      }}</Button>
    </div>
  </Alert>

  <Alert v-if="wallet.health.hasOldUtxos" variant="destructive">
    <AlertTitle>{{ t("wallet.alerts.demurrage") }}</AlertTitle>

    <AlertDescription>
      {{ t("wallet.alerts.demurrageDesc") }}
    </AlertDescription>

    <div class="col-start-2 mt-3 flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="ghost" @click="() => openUrl(STORAGE_RENT_URL)"
        >{{ t("common.learnMore") }}<ExternalLinkIcon
      /></Button>
      <Button v-if="canOptimize" size="sm" @click="goToOptimizationDapp">{{
        t("common.consolidate")
      }}</Button>
    </div>
  </Alert>

  <Alert v-else-if="wallet.health.utxoCount > HEALTHY_UTXO_COUNT">
    <AlertTitle>{{ t("wallet.alerts.fragmentation") }}</AlertTitle>

    <AlertDescription>
      {{ t("wallet.alerts.fragmentationDesc") }}
    </AlertDescription>

    <div v-if="canOptimize" class="col-start-2 mt-3 flex flex-wrap justify-end gap-2">
      <Button size="sm" @click="goToOptimizationDapp">{{ t("common.optimize") }}</Button>
    </div>
  </Alert>
</template>
