<script setup lang="ts">
import {
  ChainProviderConfirmedTransaction,
  ChainProviderUnconfirmedTransaction
} from "@fleet-sdk/blockchain-providers";
import { onMounted, shallowRef } from "vue";
import { useWalletStore } from "@/stores/walletStore";
import { graphQLService } from "@/chains/ergo/services/graphQlService";

const wallet = useWalletStore();

const confirmed = shallowRef<ChainProviderConfirmedTransaction<string>[]>([]);
const pending = shallowRef<ChainProviderUnconfirmedTransaction<string>[]>([]);

onMounted(async () => {
  const addresses = wallet.addresses.map((x) => x.script);
  pending.value = await graphQLService.getUnconfirmedTransactions({ where: { addresses } });
  for await (const data of graphQLService.streamConfirmedTransactions({ where: { addresses } })) {
    confirmed.value = data;
    break;
  }
});
</script>

<template>
  <div class="flex flex-col gap-4">tx history {{ confirmed }}</div>
</template>
