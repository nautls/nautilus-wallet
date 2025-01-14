<script setup lang="ts">
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";

const wallet = useWalletStore();
const STORAGE_RENT_URL = "https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/";
</script>

<template>
  <Alert v-if="!wallet.health.hasOldUtxos" variant="destructive">
    <AlertTitle v-once
      >You may soon incur <Link external :href="STORAGE_RENT_URL">demurrage</Link>
    </AlertTitle>

    <AlertDescription>
      UTxOs holding tokens must have sufficient ERG to cover demurrage fee, or you risk losing them.
      Consolidate your assets to avoid this.
    </AlertDescription>

    <router-link v-slot="{ navigate }" class="mt-4" to="/dapps/wallet-optimization" custom>
      <Button class="w-full" @click="navigate">Consolidate</Button>
    </router-link>
  </Alert>

  <Alert v-else-if="wallet.health.utxoCount > HEALTHY_UTXO_COUNT">
    <AlertTitle>Your wallet looks fragmented. </AlertTitle>

    <AlertDescription>
      Consider optimizing your wallet for improved performance and efficiency.
    </AlertDescription>

    <router-link v-slot="{ navigate }" class="mt-4" to="/dapps/wallet-optimization" custom>
      <Button class="w-full" @click="navigate">Optimize</Button>
    </router-link>
  </Alert>
</template>
