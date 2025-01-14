<script setup lang="ts">
import { useRouter } from "vue-router";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";

const STORAGE_RENT_URL = "https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/";

const wallet = useWalletStore();
const router = useRouter();

const goToOptimizationDapp = () => router.push({ name: "wallet-optimization" });
</script>

<template>
  <Alert v-if="wallet.health.hasOldUtxos" variant="destructive">
    <AlertTitle v-once
      >You may soon incur <Link external :href="STORAGE_RENT_URL">demurrage</Link>
    </AlertTitle>

    <AlertDescription>
      UTxOs holding tokens must have sufficient ERG to cover demurrage fee, or you risk losing them.
      Consolidate your assets to avoid this.
    </AlertDescription>

    <Button class="w-full mt-4" @click="goToOptimizationDapp">Consolidate</Button>
  </Alert>

  <Alert v-else-if="wallet.health.utxoCount > HEALTHY_UTXO_COUNT">
    <AlertTitle>Your wallet looks fragmented. </AlertTitle>

    <AlertDescription>
      Consider optimizing your wallet for improved performance and efficiency.
    </AlertDescription>

    <Button class="w-full mt-4" @click="goToOptimizationDapp">Optimize</Button>
  </Alert>
</template>
