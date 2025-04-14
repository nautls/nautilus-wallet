<script setup lang="ts">
import { ExternalLinkIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";

const STORAGE_RENT_URL = "https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/";

const wallet = useWalletStore();
const router = useRouter();
const { t } = useI18n();

const goToOptimizationDapp = () => router.push({ name: "wallet-optimization" });

function openUrl(url: string) {
  window.open(url, "_blank");
}
</script>

<template>
  <Alert v-if="wallet.health.hasOldUtxos" variant="destructive">
    <AlertTitle>{{ t("wallet.alerts.demurrage") }}</AlertTitle>

    <div class="space-y-4">
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

    <Button class="mt-4 w-full" @click="goToOptimizationDapp">{{ t("common.optimize") }}</Button>
  </Alert>
</template>
