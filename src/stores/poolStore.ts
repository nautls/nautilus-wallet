import { computed, onUnmounted, shallowRef, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { utxoSum } from "@fleet-sdk/common";
import { ErgoAddress } from "@fleet-sdk/core";
import { useIntervalFn } from "@vueuse/core";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { summarizeTransaction } from "@/chains/ergo/transaction/interpreter/utils";
import { bn, decimalize } from "@/common/bigNumber";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { UnconfirmedTransactionSummary } from "@/types/transactions";
import { useAssetsStore } from "./assetsStore";
import { useWalletStore } from "./walletStore";

const REFRESH_INTERVAL = 10000; // ten seconds

export const usePoolStore = defineStore("pool", () => {
  const wallet = useWalletStore();
  const assets = useAssetsStore();

  const transactions = shallowRef<UnconfirmedTransactionSummary[]>([]);
  const interval = useIntervalFn(fetchTransactions, REFRESH_INTERVAL);

  const addresses = computed(() => wallet.addresses.map((x) => x.script));
  const ergoTrees = computed(
    () => new Set(wallet.addresses.map((x) => ErgoAddress.decodeUnsafe(x.script).ergoTree))
  );

  watch(
    () => wallet.loading,
    (loading) => {
      if (loading) {
        interval.pause();
      } else if (!loading) {
        transactions.value = [];
        fetchTransactions();
        interval.resume();
      }
    }
  );

  watch(
    () => wallet.addresses,
    (addresses) => {
      if (!addresses.length) return;
      resetInterval();
    }
  );

  const balance = computed(() => {
    const sum = utxoSum(
      transactions.value
        .flatMap((x) => x.delta)
        .map((x) => ({ value: x.nanoErgs, assets: x.tokens }))
    );

    const balance = new Map(
      sum.tokens.map((x) => [
        x.tokenId,
        decimalize(bn(x.amount.toString()), assets.metadata.get(x.tokenId)?.decimals ?? 0)
      ])
    );
    balance.set(
      ERG_TOKEN_ID,
      decimalize(bn(sum.nanoErgs.toString()), assets.metadata.get(ERG_TOKEN_ID)?.decimals ?? 0)
    );

    return balance;
  });

  onUnmounted(interval.pause);

  function resetInterval() {
    interval.pause();
    interval.resume();
  }

  async function fetchTransactions() {
    if (addresses.value.length === 0) return;

    const wId = wallet.id;
    const response = await graphQLService.getUnconfirmedTransactions({
      where: { addresses: addresses.value }
    });

    // Check if wallet has changed since the request was made
    if (wId !== wallet.id) return;

    const txns = response.map((x) => summarizeTransaction(x, ergoTrees.value));
    transactions.value = txns;

    if (txns.length > 0) {
      assets.loadMetadata(txns.flatMap((x) => x.delta.tokens.map((y) => y.tokenId)));
    }
  }

  return { transactions, balance };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePoolStore, import.meta.hot));
}
