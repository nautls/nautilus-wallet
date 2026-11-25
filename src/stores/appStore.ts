import { computed, inject, onMounted, ref, shallowReactive, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { hex } from "@fleet-sdk/crypto";
import { useColorMode } from "@vueuse/core";
import { Locale } from "vue-i18n";
import { useRouter } from "vue-router";
import HdKey from "@/chains/ergo/hdKey";
import { PRELOADED_SETTINGS } from "@/boot/preload";
import { log } from "@/common/logger";
import { hdKeyPool } from "@/common/objectPool";
import { useWebExtStorage } from "@/composables/useWebExtStorage";
import { MAINNET } from "@/constants/ergo";
import { DEFAULT_SETTINGS } from "@/constants/settings";
import { mergeSettings } from "@/extension/background/settings";
import { PasswordKind, WalletPatch, walletsDbService } from "@/database/walletsDbService";
import { IDbWallet, NotNullId } from "@/types/database";
import { useChainStore } from "./chainStore";
import { TransportType } from "@/common/ledger";

export type Settings = {
  lastOpenedWalletId: number;
  conversionCurrency: string;
  devMode: boolean;
  relayUrl: string;
  explorerUrl: string;
  ipfsGateway: string;
  hideBalances: boolean;
  blacklistedTokensLists: string[];
  locale: Locale | "auto";
  colorMode: "light" | "dark" | "auto";
  extension: { viewMode: "popup" | "sidebar" };
  ledger: { transport: TransportType };
  masterPasswordAlertDismissed: boolean;
};

type StandardWallet = {
  name: string;
  type: "standard";
  mnemonic: string;
  /** Leave out for the master password to use the unlock session. */
  password?: string;
  passwordKind: PasswordKind;
  needsBackup?: boolean;
};

type ReadOnlyWallet = {
  name: string;
  type: "readonly" | "ledger";
  extendedPublicKey: string;
};

const usePrivateState = defineStore("_app", () => ({
  loading: ref(true),
  wallets: shallowReactive<NotNullId<IDbWallet>[]>([])
}));

export const useAppStore = defineStore("app", () => {
  const viewTitle = ref("");
  const privateState = usePrivateState();
  // created here so that its height polling lives as long as the app
  useChainStore();
  const router = useRouter();
  const settings = useWebExtStorage<Settings>(
    "settings",
    inject(PRELOADED_SETTINGS, DEFAULT_SETTINGS),
    {
      mergeDefaults: mergeSettings
    }
  );
  const colorMode = useColorMode({
    storageKey: null /** disable storage */,
    initialValue: settings.value.colorMode
  });

  walletsDbService.onChange(() => loadWallets().catch((e) => log.error(e)));

  onMounted(async () => {
    await loadWallets();

    if (!settings.value.lastOpenedWalletId && privateState.wallets.length === 0) goTo("add-wallet");

    privateState.loading = false;
  });

  // clean up view title on route change
  watch(router.currentRoute, () => {
    if (!viewTitle.value) return;
    viewTitle.value = "";
  });

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
      data.type === "standard"
        ? await HdKey.fromMnemonic(data.mnemonic)
        : HdKey.fromPublicKey(data.extendedPublicKey);

    hdKeyPool.alloc(hex.encode(key.publicKey), key.neutered());
    const dbObj: IDbWallet = {
      name: data.name.trim(),
      chain: { id: "ergo", network: MAINNET ? "mainnet" : "testnet" },
      type: data.type,
      publicKey: hex.encode(key.publicKey),
      chainCode: hex.encode(key.chainCode),
      settings: {
        avoidAddressReuse: false,
        addressFilter: "all",
        defaultChangeIndex: 0
      },
      needsBackup: data.type === "standard" && data.needsBackup === true,
      createdAt: Date.now()
    };

    const walletId = await walletsDbService.put(
      dbObj,
      data.type === "standard"
        ? { value: data.mnemonic, password: data.password, by: data.passwordKind }
        : undefined
    );
    await loadWallets();

    return walletId;
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
