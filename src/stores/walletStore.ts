import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, ref, shallowReactive } from "vue";
import { groupBy } from "lodash-es";
import { bn, decimalize, sumBy } from "../common/bigNumber";
import { useAppStore } from "./appStore";
import { useAssetsStore } from "./assetsStore";
import { IDbAddress, IDbAsset } from "@/types/database";
import { StateAsset, WalletSettings, WalletType } from "@/types/internal";
import { walletsDbService } from "@/database/walletsDbService";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";

const usePrivateState = defineStore("_wallet", () => ({
  loading: ref(true),
  syncing: ref(true),
  id: ref(0),
  type: ref(WalletType.Standard),
  publicKey: ref(""),
  addresses: shallowReactive<IDbAddress[]>([]),
  assets: shallowReactive<IDbAsset[]>([])
}));

export const useWallet = defineStore("wallet", () => {
  const privateState = usePrivateState();
  const app = useAppStore();
  const assets = useAssetsStore();

  const name = ref("");
  const settings = ref<WalletSettings>({
    avoidAddressReuse: false,
    hideUsedAddresses: false,
    defaultChangeIndex: 0
  });

  const id = computed(() => privateState.id);
  const type = computed(() => privateState.type);
  const publicKey = computed(() => privateState.publicKey);
  const loading = computed(() => privateState.loading);
  const syncing = computed(() => privateState.syncing);
  const addresses = computed(() => privateState.addresses);

  const balance = computed((): StateAsset[] => {
    const balance = [] as StateAsset[];
    const groupedAssets = groupBy(privateState.assets, (x) => x.tokenId);
    for (const tokenId in groupedAssets) {
      if (assets.blacklist.includes(tokenId)) continue;

      const assetGroup = groupedAssets[tokenId];
      const metadata = assets.metadata.get(tokenId);
      balance.push({
        tokenId: assetGroup[0].tokenId,
        confirmedAmount: decimalize(
          sumBy(assetGroup, (x) => x.confirmedAmount),
          metadata?.decimals
        ),
        unconfirmedAmount: decimalize(
          sumBy(assetGroup, (x) => x.unconfirmedAmount ?? 0),
          metadata?.decimals
        ),
        metadata
      });
    }

    if (balance.length === 0) {
      return [
        {
          tokenId: "ERG",
          confirmedAmount: bn(0),
          metadata: assets.metadata.get("ERG")
        }
      ];
    }

    return balance.sort((a, b) =>
      a.tokenId === ERG_TOKEN_ID ? 1 : a.tokenId.localeCompare(b.tokenId)
    );
  });

  onMounted(async () => {
    await load(app.settings.lastOpenedWalletId);
    privateState.loading = false;
  });

  async function load(walletId: number) {
    const dbWallet = await walletsDbService.getById(walletId);
    if (!dbWallet) throw new Error(`Wallet 'id:${walletId}' not found`);

    privateState.id = dbWallet.id!;
    privateState.type = dbWallet.type;
    privateState.publicKey = dbWallet.publicKey;
    name.value = dbWallet.name;
    settings.value = dbWallet.settings;

    const [addresses, assets] = await Promise.all([
      addressesDbService.getByWalletId(walletId),
      assetsDbService.getByWalletId(walletId)
    ]);

    privateState.addresses = addresses;
    privateState.assets = assets;
  }

  return { id, name, type, publicKey, settings, addresses, balance, loading, syncing, load };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(useWallet, import.meta.hot));
}
