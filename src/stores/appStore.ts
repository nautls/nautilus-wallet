import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { getDefaultServerUrl, graphQLService } from "../chains/ergo/services/graphQlService";
import { DEFAULT_EXPLORER_URL } from "../constants/explorer";
import { MAINNET } from "../constants/ergo";
import { sendBackendServerUrl } from "../rpc/uiRpcHandlers";

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

const usePrivateState = defineStore("_app", { state: () => ({ loading: true }) });

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

  onMounted(() => {
    privateState.loading = false;
  });

  watch(
    () => settings.value.graphQLServer,
    (newServerUrl) => {
      graphQLService.updateServerUrl(newServerUrl);
      sendBackendServerUrl(newServerUrl);
    }
  );

  const loading = computed(() => privateState.loading);

  return {
    settings,
    loading
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
