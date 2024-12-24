<script setup lang="ts">
import { useWalletStore } from "@/stores/walletStore";
import { HEALTHY_UTXO_COUNT } from "@/constants/ergo";

const wallet = useWalletStore();
</script>

<template>
  <div
    v-if="wallet.health.hasOldUtxos"
    class="rounded border border-red-300 bg-red-100 px-4 py-3 text-sm"
  >
    <div>
      <strong
        >You are about to be charged
        <a
          class="link text-blue-600"
          target="_blank"
          rel="noopener noreferrer"
          href="https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/"
          >storage rent</a
        ></strong
      >, UTxOs containing tokens must have enough ERG to cover rent or you risk losing them. Please
      consider consolidating your assets avoid this.
    </div>
    <router-link v-slot="{ navigate }" to="/dapps/wallet-optimization" custom>
      <button class="btn mt-4 w-full" @click="navigate">Consolidate</button>
    </router-link>
  </div>
  <div
    v-else-if="wallet.health.utxoCount > HEALTHY_UTXO_COUNT"
    class="rounded border border-yellow-300 bg-yellow-100 px-4 py-3 text-sm"
  >
    <div>
      <strong>Your wallet looks fragmented.</strong> Consider optimizing your wallet for improved
      performance and efficiency.
    </div>
    <router-link v-slot="{ navigate }" to="/dapps/wallet-optimization" custom>
      <button class="btn mt-4 w-full" @click="navigate">Optimize</button>
    </router-link>
  </div>
</template>
