import { computed, onScopeDispose, shallowRef, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { ErgoAddress } from "@fleet-sdk/core";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { summarizeTransaction } from "@/chains/ergo/transaction/summarizer";
import { log } from "@/common/logger";
import { UnconfirmedTransactionSummary } from "@/types/transactions";
import { useAssetsStore } from "./assetsStore";
import { useChainStore } from "./chainStore";
import { useWalletStore } from "./walletStore";

/**
 * Pending txs come from GraphQL, whose node can see a tx later than the relay that reported the
 * change, so they are read again a little after it, and on each block.
 */
const REFETCH_DELAY = 5_000;

export const usePoolStore = defineStore("pool", () => {
  const wallet = useWalletStore();
  const assets = useAssetsStore();
  const chain = useChainStore();
  let refetch: ReturnType<typeof setTimeout> | undefined;
  let lastRequest = 0;

  const transactions = shallowRef<UnconfirmedTransactionSummary[]>([]);

  const addresses = computed(() => wallet.addresses.map((x) => x.script));
  const ergoTrees = computed(
    () => new Set(wallet.addresses.map((x) => ErgoAddress.decodeUnsafe(x.script).ergoTree))
  );

  /** Changes whenever the mempool's effect on the wallet does. */
  const pendingChanges = computed(() =>
    wallet.addresses
      .flatMap((a) =>
        a.assets
          .filter((x) => x.unconfirmedAmount && !x.unconfirmedAmount.isZero())
          .map((x) => `${a.script}:${x.tokenId}:${x.unconfirmedAmount}`)
      )
      .join()
  );

  watch(
    [() => wallet.loading, () => wallet.id, pendingChanges, () => chain.height],
    ([loading, walletId, changes], previous) => {
      if (walletId !== previous?.[1]) transactions.value = [];
      if (loading) return;

      fetchTransactions();
      if (changes !== previous?.[2]) {
        clearTimeout(refetch);
        refetch = setTimeout(fetchTransactions, REFETCH_DELAY);
      }
    },
    { immediate: true }
  );

  onScopeDispose(() => clearTimeout(refetch));

  async function fetchTransactions() {
    if (addresses.value.length === 0) return;

    const request = ++lastRequest;
    let response;
    try {
      response = await graphQLService.getUnconfirmedTransactions({
        where: { addresses: addresses.value }
      });
    } catch (e) {
      log.error("Failed to fetch pending transactions", e);
      return;
    }

    // a later request, maybe for another wallet, has the newer list
    if (request !== lastRequest) return;

    const txns = response.map((x) => summarizeTransaction(x, ergoTrees.value));
    transactions.value = txns;

    if (txns.length > 0) {
      assets.loadMetadata(txns.flatMap((x) => x.delta.tokens.map((y) => y.tokenId)));
    }
  }

  return { transactions };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePoolStore, import.meta.hot));
}
