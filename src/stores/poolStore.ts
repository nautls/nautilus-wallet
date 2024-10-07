import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onUnmounted, shallowRef, watch } from "vue";
import { useIntervalFn } from "@vueuse/core";
import { ErgoAddress } from "@fleet-sdk/core";
import { useWalletStore } from "./walletStore";
import { useAssetsStore } from "./assetsStore";
import { UnconfirmedTransactionSummary } from "@/types/transactions";
import { summarizeTransaction } from "@/chains/ergo/transaction/interpreter/utils";
import { graphQLService } from "@/chains/ergo/services/graphQlService";

const REFRESH_INTERVAL = 10000; // 10 seconds

export const usePoolStore = defineStore("pool", () => {
  const wallet = useWalletStore();
  const assets = useAssetsStore();

  const addresses = computed(() => wallet.addresses.map((x) => x.script));
  const ergoTrees = computed(
    () => new Set(wallet.addresses.map((x) => ErgoAddress.decodeUnsafe(x.script).ergoTree))
  );

  const transactions = shallowRef<UnconfirmedTransactionSummary[]>([]);
  const interval = useIntervalFn(fetchTransactions, REFRESH_INTERVAL, { immediateCallback: true });

  onUnmounted(() => interval.pause());

  watch(
    () => wallet.addresses,
    () => {
      if (!wallet.addresses.length) return;

      interval.pause();
      interval.resume();
    }
  );

  async function fetchTransactions() {
    if (addresses.value.length === 0) return;

    const response = await graphQLService.getUnconfirmedTransactions({
      where: { addresses: addresses.value }
    });

    const txns = response.map((x) => summarizeTransaction(x, ergoTrees.value));
    transactions.value = txns;

    if (txns.length > 0) {
      assets.loadMetadata(txns.flatMap((x) => x.delta.map((y) => y.tokenId)));
    }
  }

  return {
    transactions
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePoolStore, import.meta.hot));
}
