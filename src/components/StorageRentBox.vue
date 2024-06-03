<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import store from "@/store";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { addressesDbService } from "@/database/addressesDbService";
import { HEALTHY_BLOCKS_AGE, HEALTHY_UTXO_COUNT } from "@/constants/ergo";

const oldestBoxAge = ref<number | undefined>(undefined);
const boxCount = ref(0);
let walletId = 0;

watch(() => store.state.currentWallet, loadBoxInfo);
onMounted(loadBoxInfo);

async function loadBoxInfo() {
  if (!store.state.currentWallet.id || store.state.currentWallet.id === walletId) {
    return;
  }

  walletId = store.state.currentWallet.id;
  oldestBoxAge.value = undefined;
  boxCount.value = 0;

  const currentHeight = (await graphQLService.getCurrentHeight()) || 0;
  const addresses = (await addressesDbService.getByWalletId(walletId)).map(
    (address) => address.script
  );

  const boxes = await graphQLService.getUnspentBoxesInfo(addresses);
  if (!boxes.oldest) {
    return;
  }

  oldestBoxAge.value = currentHeight - boxes.oldest;
  boxCount.value = boxes.count;
}
</script>

<template>
  <div
    v-if="oldestBoxAge !== undefined && oldestBoxAge > HEALTHY_BLOCKS_AGE"
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
  <div
    v-else-if="boxCount > HEALTHY_UTXO_COUNT"
    class="rounded rounded border-1 bg-yellow-100 border-yellow-300 text-sm py-3 px-4"
  >
    <div>
      <strong>Your wallet looks fragmented.</strong> Consider optimizing your wallet for improved
      performance and efficiency.
    </div>
    <router-link to="/dapps/wallet-optimization" custom v-slot="{ navigate }">
      <button class="btn w-full mt-4" @click="navigate">Optimize</button>
    </router-link>
  </div>
</template>
