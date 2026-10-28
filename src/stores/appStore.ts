import { computed, onMounted, ref, shallowReactive, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { uniq } from "@fleet-sdk/common";
import { hex } from "@fleet-sdk/crypto";
import { useColorMode } from "@vueuse/core";
import { Locale } from "vue-i18n";
import { useRouter } from "vue-router";
import HdKey from "@/chains/ergo/hdKey";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { log } from "@/common/logger";
import { hdKeyPool } from "@/common/objectPool";
import { useWebExtStorage } from "@/composables/useWebExtStorage";
import { UTXO_CHECK_INTERVAL } from "@/constants/intervals";
import { DEFAULT_SETTINGS } from "@/constants/settings";
import { utxosDbService } from "@/database/utxosDbService";
import { WalletPatch, walletsDbService } from "@/database/walletsDbService";
import { sendBackendServerUrl } from "@/extension/connector/rpc/uiRpcHandlers";
import { setLocale } from "@/i18n";
import { IDbWallet, NotNullId } from "@/types/database";
import { Network, WalletType } from "@/types/internal";
import { useChainStore } from "./chainStore";
import { TransportType } from "@/common/ledger";

export type Settings = {
  lastOpenedWalletId: number;
  conversionCurrency: string;
  devMode: boolean;
  graphQLServer: string;
  explorerUrl: string;
  ipfsGateway: string;
  hideBalances: boolean;
  blacklistedTokensLists: string[];
  zeroConf: boolean;
  locale: Locale | "auto";
  colorMode: "light" | "dark" | "auto";
  extension: { viewMode: "popup" | "sidebar" };
  ledger: { transport: TransportType };
};

type StandardWallet = {
  name: string;
  type: WalletType.Standard;
  mnemonic: string;
  password: string;
  needsBackup?: boolean;
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
  const viewTitle = ref("");
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

  walletsDbService.onChange(() => loadWallets().catch((e) => log.error(e)));

  onMounted(async () => {
    await loadWallets();
    setLocale(settings.value.locale !== "auto" ? settings.value.locale : navigator.language);

    if (!settings.value.lastOpenedWalletId && privateState.wallets.length === 0) goTo("add-wallet");

    privateState.loading = false;
  });

  // clean up view title on route change
  watch(router.currentRoute, () => {
    if (!viewTitle.value) return;
    viewTitle.value = "";
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
    () => {
      colorMode.value = settings.value.colorMode;
    }
  );

  const loading = computed(() => privateState.loading);
  const wallets = computed(() => privateState.wallets);

  // loads run one after another, so an older read never overwrites a newer one
  let lastLoad = Promise.resolve();
  function loadWallets(): Promise<void> {
    const load = lastLoad.then(async () => {
      privateState.wallets = await walletsDbService.getAll();
    });
    lastLoad = load.catch(() => {}); // a failed load doesn't block the next ones
    return load;
  }

  async function updateWallet(id: number, wallet: WalletPatch) {
    await walletsDbService.updateSettings(id, wallet);
    await loadWallets();
  }

  async function deleteWallet(id: number) {
    await walletsDbService.delete(id);
    await loadWallets();
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
      settings: {
        avoidAddressReuse: false,
        addressFilter: "all",
        defaultChangeIndex: 0
      },
      needsBackup: data.type === WalletType.Standard && data.needsBackup === true,
      createdAt: Date.now()
    };

    const walletId = await walletsDbService.put(
      dbObj,
      data.type === WalletType.Standard
        ? { value: data.mnemonic, password: data.password }
        : undefined
    );
    await loadWallets();

    return walletId;
  }

  async function checkPendingBoxes() {
    const dbBoxes = await utxosDbService.getAllPending();
    const boxesToCheck = dbBoxes.filter(
      (b) => b.spentTimestamp && Date.now() - b.spentTimestamp >= UTXO_CHECK_INTERVAL
    );
    if (boxesToCheck.length === 0) return;

    const txIds = uniq(boxesToCheck.map((b) => b.spentTxId));
    const mempool = await graphQLService.mempoolTransactionsLookup(txIds);
    await utxosDbService.removeByTxIds(txIds.filter((id) => !mempool.has(id)));
  }

  function goTo(name: string) {
    if (window.location.href.includes("redirect=false")) return;
    router.push({ name });
  }

  return {
    settings,
    wallets,
    loading,
    updateWallet,
    deleteWallet,
    putWallet,
    viewTitle
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
