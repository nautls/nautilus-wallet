import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { getDefaultServerUrl, graphQLService } from "../chains/ergo/services/graphQlService";
import { DEFAULT_EXPLORER_URL } from "../constants/explorer";
import { MAINNET } from "../constants/ergo";
import { sendBackendServerUrl } from "../rpc/uiRpcHandlers";
import { usePrivateStateStore } from "./privateStateStore";

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

export const useAppStore = defineStore("settings", () => {
  const privateState = usePrivateStateStore();

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
    privateState.loading.app = false;
  });

  watch(
    () => settings.value.graphQLServer,
    (newServerUrl) => {
      graphQLService.updateServerUrl(newServerUrl);
      sendBackendServerUrl(newServerUrl);
    }
  );

  const loading = computed(() => privateState.loading.app);

  return {
    settings,
    loading
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot));
}
