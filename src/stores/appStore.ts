import { computed, onMounted, ref, shallowReactive, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { uniq } from "@fleet-sdk/common";
import { hex } from "@fleet-sdk/crypto";
import { useColorMode } from "@vueuse/core";
import AES from "crypto-js/aes";
import { useRouter } from "vue-router";
import HdKey from "@/chains/ergo/hdKey";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { hdKeyPool } from "@/common/objectPool";
import { useWebExtStorage } from "@/composables/useWebExtStorage";
import { UTXO_CHECK_INTERVAL } from "@/constants/intervals";
import { DEFAULT_SETTINGS } from "@/constants/settings";
import { utxosDbService } from "@/database/utxosDbService";
import { WalletPatch, walletsDbService } from "@/database/walletsDbService";
import { sendBackendServerUrl } from "@/extension/connector/rpc/uiRpcHandlers";
import { IDbWallet, NotNullId } from "@/types/database";
import { Network, WalletType } from "@/types/internal";
import { useChainStore } from "./chainStore";

export type Settings = {
  lastOpenedWalletId: number;
  isKyaAccepted: boolean;
  conversionCurrency: string;
  devMode: boolean;
  graphQLServer: string;
  explorerUrl: string;
  hideBalances: boolean;
  blacklistedTokensLists: string[];
  zeroConf: boolean;
  colorMode: "light" | "dark" | "auto";
  extension: { viewMode: "popup" | "sidebar" };
};

type StandardWallet = {
  name: string;
  type: WalletType.Standard;
  mnemonic: string;
  password: string;
};

type ReadOnlyWallet = {
  name: string;
  type: WalletType.ReadOnly | WalletType.Ledger;
  extendedPublicKey: string;
};

const usePrivateState = defineStore("_app", () => ({
  loading: ref(true),
  wallets: shallowReactive<NotNullId<IDbWallet>[]>([])
}));

export const useAppStore = defineStore("app", () => {
  const privateState = usePrivateState();
  const chain = useChainStore();
  const router = useRouter();
  const settings = useWebExtStorage<Settings>("settings", DEFAULT_SETTINGS, {
    mergeDefaults: true
  });
  const colorMode = useColorMode({
    storageKey: null /** disable storage */,
    initialValue: settings.value.colorMode
  });

  onMounted(async () => {
    privateState.wallets = await walletsDbService.getAll();

    // If KYA is not accepted and there are wallets, migrate settings from localStorage
    if (!settings.value.isKyaAccepted && privateState.wallets.length) {
      const oldSettings = localStorage.getItem("settings");
      if (oldSettings) {
        settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(oldSettings) }; // migrate settings
        localStorage.clear(); // clear old settings
      } else {
        settings.value = {
          ...DEFAULT_SETTINGS,
          isKyaAccepted: true, // if there are wallets, KYA was accepted previously
          lastOpenedWalletId: privateState.wallets[0].id
        };
      }
    }

    if (!settings.value.lastOpenedWalletId && privateState.wallets.length === 0) goTo("add-wallet");

    privateState.loading = false;
  });

  watch(
    () => settings.value.graphQLServer,
    (newServerUrl) => {
      graphQLService.setUrl(newServerUrl);
      sendBackendServerUrl(newServerUrl);
    }
  );

  watch(() => chain.height, checkPendingBoxes);

  watch(
    () => settings.value.colorMode,
    () => (colorMode.value = settings.value.colorMode)
  );

  const loading = computed(() => privateState.loading);
  const wallets = computed(() => privateState.wallets);

  async function updateWallet(id: number, wallet: WalletPatch) {
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

  async function putWallet(data: StandardWallet | ReadOnlyWallet): Promise<number> {
    const key =
      data.type === WalletType.Standard
        ? await HdKey.fromMnemonic(data.mnemonic)
        : HdKey.fromPublicKey(data.extendedPublicKey);

    hdKeyPool.alloc(hex.encode(key.publicKey), key.neutered());
    const dbObj: IDbWallet = {
      name: data.name.trim(),
      network: Network.ErgoMainnet,
      type: data.type,
      publicKey: hex.encode(key.publicKey),
      chainCode: hex.encode(key.chainCode),
      mnemonic:
        data.type === WalletType.Standard
          ? AES.encrypt(data.mnemonic, data.password).toString()
          : undefined,
      settings: {
        avoidAddressReuse: false,
        addressFilter: "all",
        defaultChangeIndex: 0
      }
    };

    const walletId = await walletsDbService.put(dbObj);
    dbObj.id = walletId;

    const index = privateState.wallets.findIndex((w) => w.id === walletId);
    if (index > -1) {
      privateState.wallets.splice(index, 1, dbObj as NotNullId<IDbWallet>);
      privateState.wallets = privateState.wallets.slice(); // trigger reactivity
    } else {
      privateState.wallets.push(dbObj as NotNullId<IDbWallet>);
    }

    return walletId;
  }

  async function checkPendingBoxes() {
    const dbBoxes = await utxosDbService.getAllPending();
    const boxesToCheck = dbBoxes.filter(
      (b) => b.spentTimestamp && Date.now() - b.spentTimestamp >= UTXO_CHECK_INTERVAL
    );
    if (boxesToCheck.length == 0) return;

    const txIds = uniq(boxesToCheck.map((b) => b.spentTxId));
    const mempool = await graphQLService.mempoolTransactionsLookup(txIds);
    await utxosDbService.removeByTxIds(txIds.filter((id) => !mempool.has(id)));
  }

  function goTo(name: string) {
    if (router.currentRoute.value.query.redirect === "false") return;
    router.push({ name });
  }

  return {
    settings,
    wallets,
    loading,
    updateWallet,
    deleteWallet,
    putWallet
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
