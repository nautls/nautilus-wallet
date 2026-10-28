<script setup lang="ts">
import { computed } from "vue";
import { ExternalLinkIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MnemonicBackupDialog } from "@/components/wallet";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";
import { AddressState } from "@/types/internal";

const STORAGE_RENT_URL = "https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/";

const wallet = useWalletStore();
const router = useRouter();
const { t } = useI18n();

const { open: openMnemonicBackupDialog } = useProgrammaticDialog(MnemonicBackupDialog);

// only display the backup alert if the wallet is used
const showBackupAlert = computed(
  () => wallet.needsBackup && wallet.addresses.some((a) => a.state === AddressState.Used)
);

const goToOptimizationDapp = () => router.push({ name: "wallet-optimization" });

function openUrl(url: string) {
  window.open(url, "_blank");
}
</script>

<template>
  <Alert v-if="showBackupAlert" variant="destructive-outline">
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
