import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, ref, shallowReactive, toRaw, watch } from "vue";
import { groupBy, maxBy } from "lodash-es";
import { bn, decimalize, sumBy } from "../common/bigNumber";
import { useAppStore } from "./appStore";
import { useAssetsStore } from "./assetsStore";
import { IDbAddress, IDbAsset } from "@/types/database";
import {
  AddressState,
  AddressType,
  AssetSubtype,
  StateAddress,
  StateAsset,
  WalletSettings,
  WalletType
} from "@/types/internal";
import { walletsDbService } from "@/database/walletsDbService";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { CHUNK_DERIVE_LENGTH, ERG_TOKEN_ID } from "@/constants/ergo";
import { hdKeyPool } from "@/common/objectPool";
import HdKey from "@/chains/ergo/hdKey";
import router from "@/router";

const usePrivateState = defineStore("_wallet", () => ({
  loading: ref(true),
  syncing: ref(true),
  id: ref(0),
  type: ref(WalletType.Standard),
  publicKey: ref(""),
  addresses: shallowReactive<IDbAddress[]>([]),
  assets: shallowReactive<IDbAsset[]>([])
}));

export const useWalletStore = defineStore("wallet", () => {
  const privateState = usePrivateState();
  const app = useAppStore();
  const assets = useAssetsStore();

  const name = ref("");
  const settings = ref<WalletSettings>({
    avoidAddressReuse: false,
    hideUsedAddresses: false,
    defaultChangeIndex: 0
  });

  watch(
    [name, settings],
    async () => {
      if (privateState.loading) return;
      app.patchWallet(id.value, { name: name.value, settings: toRaw(settings.value) });
    },
    { deep: true }
  );

  watch(
    () => app.wallets.length,
    () => {
      if (loading.value || app.loading) return;

      const stillExists = app.wallets.find((w) => w.id === id.value);
      if (stillExists) return;

      const wallet = app.wallets[0];
      if (wallet) {
        load(wallet.id);
        router.push({ name: "assets-page" });
      } else {
        router.push({ name: "add-wallet" });
      }
    }
  );

  const id = computed(() => privateState.id);
  const type = computed(() => privateState.type);
  const publicKey = computed(() => privateState.publicKey);
  const loading = computed(() => privateState.loading);
  const syncing = computed(() => privateState.syncing);

  const balance = computed((): StateAsset[] => {
    if (loading.value) return [];

    const balance = [] as StateAsset[];
    const groupedAssets = groupBy(privateState.assets, (x) => x.tokenId);
    for (const tokenId in groupedAssets) {
      if (assets.blacklist.includes(tokenId)) continue;

      const assetGroup = groupedAssets[tokenId];
      const metadata = assets.metadata.get(tokenId);
      balance.push({
        tokenId: assetGroup[0].tokenId,
        address: assetGroup[0].address,
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
          tokenId: ERG_TOKEN_ID,
          address: "",
          confirmedAmount: bn(0),
          metadata: assets.metadata.get(ERG_TOKEN_ID)
        }
      ];
    }

    return balance.sort((a, b) =>
      a.tokenId === ERG_TOKEN_ID ? 1 : a.tokenId.localeCompare(b.tokenId)
    );
  });

  const addresses = computed((): StateAddress[] =>
    privateState.addresses
      .map((address) => ({
        script: address.script,
        state: address.state,
        index: address.index,
        assets: balance.value.filter((asset) => asset.address === address.script)
      }))
      .sort((a, b) => a.index - b.index)
  );

  const filteredAddresses = computed((): StateAddress[] => {
    if (!settings.value.hideUsedAddresses) return addresses.value;
    return addresses.value.filter(
      (address) =>
        address.index === settings.value.defaultChangeIndex || // default address
        address.state === AddressState.Unused || // unused addresses
        privateState.assets.findIndex((x) => x.address === address.script) > -1 // addresses with assets
    );
  });

  const changeAddress = computed(() => {
    const address = settings.value.avoidAddressReuse
      ? addresses.value.find((a) => a.state === AddressState.Unused)
      : addresses.value.find((a) => a.index === settings.value.defaultChangeIndex);

    if (!address) throw new Error(`Change address not found`);
    return address;
  });

  const artworkBalance = computed(() => balance.value.filter(artwork));
  const nonArtworkBalance = computed(() => balance.value.filter((x) => !artwork(x)));

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

    const [dbAddresses, dbAssets] = await Promise.all([
      addressesDbService.getByWalletId(walletId),
      assetsDbService.getByWalletId(walletId)
    ]);

    privateState.addresses = dbAddresses;
    privateState.assets = dbAssets;
    app.settings.lastOpenedWalletId = walletId;

    assets.loadMetadataFor(dbAssets.map((x) => x.tokenId));
    hdKeyPool.alloc(
      privateState.publicKey,
      HdKey.fromPublicKey({ publicKey: dbWallet.publicKey, chainCode: dbWallet.chainCode })
    );
  }

  async function deriveNewAddress() {
    const lastUsed = addresses.value.findLastIndex((x) => x.state === AddressState.Used);
    if (addresses.value.length - lastUsed > CHUNK_DERIVE_LENGTH) {
      throw Error(`You cannot add more than ${CHUNK_DERIVE_LENGTH} consecutive unused addresses.`);
    }

    const lastIndex = maxBy(addresses.value, (x) => x.index)?.index ?? -1;
    const address = hdKeyPool.get(privateState.publicKey).deriveAddress(lastIndex + 1);

    const dbObj: IDbAddress = {
      type: AddressType.P2PK,
      state: AddressState.Unused,
      script: address.script,
      index: address.index,
      walletId: id.value
    };
    privateState.addresses.push(dbObj);
    await addressesDbService.put(dbObj);
  }

  return {
    id,
    name,
    type,
    publicKey,
    settings,
    addresses,
    filteredAddresses,
    changeAddress,
    balance,
    nonArtworkBalance,
    artworkBalance,
    loading,
    syncing,
    load,
    deriveNewAddress
  };
});

function artwork(asset: StateAsset) {
  return (
    asset.metadata &&
    (asset.metadata.type === AssetSubtype.PictureArtwork ||
      asset.metadata.type === AssetSubtype.AudioArtwork ||
      asset.metadata.type === AssetSubtype.VideoArtwork)
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(useWalletStore, import.meta.hot));
}
