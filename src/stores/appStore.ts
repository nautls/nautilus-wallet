import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, ref, shallowReactive, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { isEmpty, uniq } from "@fleet-sdk/common";
import { getDefaultServerUrl, graphQLService } from "@/chains/ergo/services/graphQlService";
import { DEFAULT_EXPLORER_URL } from "@/constants/explorer";
import { MAINNET } from "@/constants/ergo";
import { sendBackendServerUrl } from "@/rpc/uiRpcHandlers";
import { IDbWallet, NotNullId } from "@/types/database";
import { WalletPatch, walletsDbService } from "@/database/walletsDbService";
import { MIN_UTXO_SPENT_CHECK_TIME } from "@/constants/intervals";
import { utxosDbService } from "@/database/utxosDbService";

export type Settings = {
  lastOpenedWalletId: number;
  isKyaAccepted: boolean;
  conversionCurrency: string;
  devMode: boolean;
  graphQLServer: string;
  explorerUrl: string;
  hideBalances: boolean;
  blacklistedTokensLists: string[];
};

const usePrivateState = defineStore("_app", () => ({
  loading: ref(true),
  wallets: shallowReactive<NotNullId<IDbWallet>[]>([])
}));

export const useAppStore = defineStore("app", () => {
  const privateState = usePrivateState();

  const settings = useStorage<Settings>("settings", {
    lastOpenedWalletId: 0,
    isKyaAccepted: false,
    conversionCurrency: "usd",
    devMode: !MAINNET,
    graphQLServer: getDefaultServerUrl(),
    explorerUrl: DEFAULT_EXPLORER_URL,
    hideBalances: false,
    blacklistedTokensLists: ["nsfw", "scam"]
  });

  onMounted(async () => {
    privateState.wallets = await walletsDbService.getAll();
    privateState.loading = false;

    // todo: do this verification on chain height change
    checkPendingBoxes();
  });

  watch(
    () => settings.value.graphQLServer,
    (newServerUrl) => {
      graphQLService.updateServerUrl(newServerUrl);
      sendBackendServerUrl(newServerUrl);
    }
  );

  const loading = computed(() => privateState.loading);
  const wallets = computed(() => privateState.wallets);

  async function patchWallet(id: number, wallet: WalletPatch) {
    const index = privateState.wallets.findIndex((w) => w.id === id);
    if (index === -1) return;

    await walletsDbService.updateSettings(id, wallet);
    privateState.wallets[index] = { ...privateState.wallets[index], ...wallet };
  }

  async function deleteWallet(id: number) {
    const index = privateState.wallets.findIndex((w) => w.id === id);
    if (index === -1) return;

    await walletsDbService.delete(id);
    privateState.wallets.splice(index, 1);
  }

  async function checkPendingBoxes() {
    const dbBoxes = await utxosDbService.getAllPending();
    const boxesToCheck = dbBoxes.filter(
      (b) => b.spentTimestamp && Date.now() - b.spentTimestamp >= MIN_UTXO_SPENT_CHECK_TIME
    );

    if (boxesToCheck.length == 0) return;

    const txIds = uniq(boxesToCheck.map((b) => b.spentTxId));
    const mempoolResult = await graphQLService.areTransactionsInMempool(txIds);

    if (isEmpty(mempoolResult)) return;
    await utxosDbService.removeByTxId(txIds.filter((id) => mempoolResult[id] === false));
  }

  return {
    settings,
    wallets,
    loading,
    patchWallet,
    deleteWallet
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
