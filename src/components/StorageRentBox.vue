<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import store from "@/store";
import { graphQLService } from "@/api/explorer/graphQlService";
import { addressesDbService } from "@/api/database/addressesDbService";

const oldestBoxAge = ref<number | undefined>(undefined);
let walletId = 0;

watch(() => store.state.currentWallet, loadBoxInfo);
onMounted(loadBoxInfo);

async function loadBoxInfo() {
  if (!store.state.currentWallet.id || store.state.currentWallet.id === walletId) {
    return;
  }

  walletId = store.state.currentWallet.id;
  oldestBoxAge.value = undefined;

  const currentHeight = (await graphQLService.getCurrentHeight()) || 0;
  const addresses = (await addressesDbService.getByWalletId(walletId)).map(
    (address) => address.script
  );

  const oldestHeight = await graphQLService.getOldestUnspentBoxCreationHeight(addresses);
  if (!oldestHeight) {
    return;
  }

  oldestBoxAge.value = currentHeight - oldestHeight;
}
</script>

<template>
  <div
    v-if="oldestBoxAge"
    class="rounded rounded border-1 bg-red-100 border-red-300 text-sm py-3 px-4"
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
    <router-link to="/dapps/wallet-optimization" custom v-slot="{ navigate }">
      <button class="btn w-full mt-4" @click="navigate">Consolidate</button>
    </router-link>
  </div>
</template>
