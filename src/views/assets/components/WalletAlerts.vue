<script setup lang="ts">
import { ExternalLinkIcon } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";

const STORAGE_RENT_URL = "https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/";

const wallet = useWalletStore();
const router = useRouter();

const goToOptimizationDapp = () => router.push({ name: "wallet-optimization" });

function openUrl(url: string) {
  window.open(url, "_blank");
}
</script>

<template>
  <Alert v-if="wallet.health.hasOldUtxos" variant="destructive">
    <AlertTitle v-once>You may soon incur demurrage</AlertTitle>

    <AlertDescription class="hyphens-auto">
      UTxOs holding tokens must have sufficient ERG to cover demurrage fee, or you risk losing them.
      Consolidate your assets to avoid this.
    </AlertDescription>

    <Button class="mt-4 w-full" variant="ghost" @click="() => openUrl(STORAGE_RENT_URL)"
      >Learn more <ExternalLinkIcon
    /></Button>
    <Button class="mt-4 w-full" @click="goToOptimizationDapp">Consolidate</Button>
  </Alert>

  <Alert v-else-if="wallet.health.utxoCount > HEALTHY_UTXO_COUNT">
    <AlertTitle>Your wallet looks fragmented.</AlertTitle>

    <AlertDescription class="hyphens-auto">
      Consider optimizing your wallet for improved performance and efficiency.
    </AlertDescription>

    <Button class="mt-4 w-full" @click="goToOptimizationDapp">Optimize</Button>
  </Alert>
</template>
