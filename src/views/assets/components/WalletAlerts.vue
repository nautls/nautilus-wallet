<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";

const wallet = useWalletStore();
const router = useRouter();
const { t } = useI18n();
const firstOldBox = computed(() => wallet.health.oldUtxos[0]);
const additionalOldBoxes = computed(() => Math.max(wallet.health.oldUtxos.length - 1, 0));

const goToOptimizationDapp = () => router.push({ name: "wallet-optimization" });
</script>

<template>
  <Alert
    v-if="wallet.health.hasOldUtxos"
    variant="destructive"
    class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
  >
    <div class="min-w-0 grow">
      <AlertTitle class="text-sm leading-tight">{{ t("wallet.alerts.storageRent") }}</AlertTitle>
      <AlertDescription class="mt-0.5 truncate text-xs">
        {{ t("wallet.alerts.storageRentBox", { boxId: firstOldBox?.boxId.slice(0, 12) }) }}
        <template v-if="additionalOldBoxes">
          {{ t("wallet.alerts.storageRentAdditional", { count: additionalOldBoxes }) }}
        </template>
      </AlertDescription>
    </div>
    <Button
      size="sm"
      class="border-destructive-foreground/35 bg-destructive-foreground/10 text-destructive-foreground hover:bg-destructive-foreground/20 w-full shrink-0 border shadow-none sm:w-auto"
      @click="goToOptimizationDapp"
      >{{ t("common.consolidate") }}</Button
    >
  </Alert>

  <Alert v-else-if="wallet.health.utxoCount > HEALTHY_UTXO_COUNT">
    <AlertTitle>{{ t("wallet.alerts.fragmentation") }}</AlertTitle>

    <AlertDescription class="hyphens-auto">
      {{ t("wallet.alerts.fragmentationDesc") }}
    </AlertDescription>

    <Button class="mt-4 w-full" @click="goToOptimizationDapp">{{ t("common.optimize") }}</Button>
  </Alert>
</template>
