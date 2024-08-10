import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, ref, shallowReactive, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { isEmpty, uniq } from "@fleet-sdk/common";
import { hex } from "@fleet-sdk/crypto";
import AES from "crypto-js/aes";
import { useRouter } from "vue-router";
import { useChainStore } from "./chainStore";
import { DEFAULT_SERVER_URL, graphQLService } from "@/chains/ergo/services/graphQlService";
import { DEFAULT_EXPLORER_URL } from "@/constants/explorer";
import { MAINNET } from "@/constants/ergo";
import { sendBackendServerUrl } from "@/extension/connector/rpc/uiRpcHandlers";
import { IDbWallet, NotNullId } from "@/types/database";
import { WalletPatch, walletsDbService } from "@/database/walletsDbService";
import { UTXO_CHECK_INTERVAL } from "@/constants/intervals";
import { utxosDbService } from "@/database/utxosDbService";
import HdKey from "@/chains/ergo/hdKey";
import { Network, WalletType } from "@/types/internal";
import { hdKeyPool } from "@/common/objectPool";

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

  const settings = useStorage<Settings>("settings", {
    lastOpenedWalletId: 0,
    isKyaAccepted: false,
    conversionCurrency: "usd",
    devMode: !MAINNET,
    graphQLServer: DEFAULT_SERVER_URL,
    explorerUrl: DEFAULT_EXPLORER_URL,
    hideBalances: false,
    blacklistedTokensLists: ["nsfw", "scam"]
  });

  onMounted(async () => {
    privateState.wallets = await walletsDbService.getAll();
    if (!settings.value.lastOpenedWalletId) goTo("add-wallet");

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
        hideUsedAddresses: false,
        defaultChangeIndex: 0
      }
    };

    const walletId = await walletsDbService.put(dbObj);
    dbObj.id = walletId;
    privateState.wallets.push(dbObj as NotNullId<IDbWallet>);

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

    if (isEmpty(mempool)) return;
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
