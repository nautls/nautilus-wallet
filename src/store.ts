import { createStore } from "vuex";
import AES from "crypto-js/aes";
import { hex } from "@fleet-sdk/crypto";
import { useAppStore } from "./stores/appStore";
import { useAssetsStore } from "./stores/assetsStore";
import { useWalletStore } from "./stores/walletStore";
import { walletsDbService } from "@/database/walletsDbService";
import HdKey from "@/chains/ergo/hdKey";
import { Network, WalletType } from "@/types/internal";
import { hdKeyPool } from "@/common/objectPool";
import { ACTIONS } from "@/constants/store";
import router from "@/router";

function goTo(routerName: string) {
  const { redirect, popup } = router.currentRoute.value.query;
  if (redirect !== "false" || popup !== "true") router.push({ name: routerName });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let app: ReturnType<typeof useAppStore>;
let assets: ReturnType<typeof useAssetsStore>;
let wallet: ReturnType<typeof useWalletStore>;

export default createStore({
  state: {},
  mutations: {},
  actions: {
    async [ACTIONS.INIT]() {
      // workaround to keep everything working while refactoring and migrating to pinia
      // todo: remove this
      app = useAppStore();
      assets = useAssetsStore();
      wallet = useWalletStore();
      await sleep(20); // wait for stores to be initialized

      if (router.currentRoute.value.query.popup === "true") return;
      if (!app.settings.lastOpenedWalletId) {
        goTo("add-wallet");
      }
    },
    async [ACTIONS.PUT_WALLET](
      { dispatch },
      wallet:
        | { extendedPublicKey: string; name: string; type: WalletType.ReadOnly | WalletType.Ledger }
        | { mnemonic: string; password: string; name: string; type: WalletType.Standard }
    ) {
      const key =
        wallet.type === WalletType.Standard
          ? await HdKey.fromMnemonic(wallet.mnemonic)
          : HdKey.fromPublicKey(wallet.extendedPublicKey);

      hdKeyPool.alloc(hex.encode(key.publicKey), key.neutered());
      const walletId = await walletsDbService.put({
        name: wallet.name.trim(),
        network: Network.ErgoMainnet,
        type: wallet.type,
        publicKey: hex.encode(key.publicKey),
        chainCode: hex.encode(key.chainCode),
        mnemonic:
          wallet.type === WalletType.Standard
            ? AES.encrypt(wallet.mnemonic, wallet.password).toString()
            : undefined,
        settings: {
          avoidAddressReuse: false,
          hideUsedAddresses: false,
          defaultChangeIndex: 0
        }
      });

      await dispatch(ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET, walletId);
    },
    async [ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET](_, id: number) {
      wallet.load(id);
    }
  }
});
