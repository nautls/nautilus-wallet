import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, ref, shallowRef, toRaw, watch } from "vue";
import { groupBy, maxBy } from "lodash-es";
import type { BigNumber } from "bignumber.js";
import { bn, decimalize, sumBy } from "../common/bigNumber";
import { MIN_SYNC_INTERVAL } from "../constants/intervals";
import { useAppStore } from "./appStore";
import { useAssetsStore } from "./assetsStore";
import { IDbAddress, IDbAsset } from "@/types/database";
import {
  AddressState,
  AddressType,
  AssetSubtype,
  BasicAssetMetadata,
  StateAddress,
  StateAsset,
  WalletSettings,
  WalletType
} from "@/types/internal";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { CHUNK_DERIVE_LENGTH, ERG_TOKEN_ID } from "@/constants/ergo";
import { hdKeyPool } from "@/common/objectPool";
import HdKey, { IndexedAddress } from "@/chains/ergo/hdKey";
import router from "@/router";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { patchArray } from "@/common/reactivity";

export type StateAssetSummary = {
  tokenId: string;
  confirmedAmount: BigNumber;
  unconfirmedAmount?: BigNumber;
  metadata?: BasicAssetMetadata;
};

const usePrivateStateStore = defineStore("_wallet", () => {
  const addresses = shallowRef<IDbAddress[]>([]);
  const assets = shallowRef<IDbAsset[]>([]);

  function patchAddresses(changedAddresses: IDbAddress[], removedAddresses: IDbAddress[] = []) {
    patchArray(addresses, changedAddresses, removedAddresses, (a, b) => a.script === b.script);
  }

  function patchAssets(changedAssets: IDbAsset[], removedAssets: IDbAsset[] = []) {
    patchArray(
      assets,
      changedAssets,
      removedAssets,
      (a, b) => a.tokenId === b.tokenId && a.address === b.address
    );
  }

  return {
    loading: ref(true),
    syncing: ref(false),
    id: ref(0),
    type: ref(WalletType.Standard),
    publicKey: ref(""),
    chainCode: ref(""),
    lastSynced: ref(0),
    addresses,
    assets,
    patchAddresses,
    patchAssets
  };
});

export const useWalletStore = defineStore("wallet", () => {
  const appStore = useAppStore();
  const assetsStore = useAssetsStore();
  const privateState = usePrivateStateStore();

  // #region  state
  const name = ref("");
  const settings = ref<WalletSettings>({
    avoidAddressReuse: false,
    hideUsedAddresses: false,
    defaultChangeIndex: 0
  });

  // #region watches
  watch(
    [name, settings, () => privateState.lastSynced],
    async () => {
      if (privateState.loading) return;
      appStore.updateWallet(privateState.id, {
        name: name.value,
        lastSynced: privateState.lastSynced,
        settings: toRaw(settings.value)
      });
    },
    { deep: true }
  );

  watch(
    () => appStore.loading,
    () => {
      if (appStore.loading) return;
      const walletId = appStore.settings.lastOpenedWalletId;
      if (walletId > 0 && appStore.wallets.some((x) => x.id === walletId)) {
        load(walletId);
      } else {
        router.push({ name: "add-wallet" });
        setLoading(false);
      }
    }
  );

  watch(
    () => appStore.wallets.length,
    (newLen, oldLen) => {
      if (privateState.loading || appStore.loading) return;
      if (newLen > oldLen) return; // only care about removals

      const stillExists = appStore.wallets.find((w) => w.id === privateState.id);
      if (stillExists) return;

      const wallet = appStore.wallets[0];
      if (wallet) {
        load(wallet.id);
        router.push({ name: "assets-page" });
      } else {
        appStore.settings.lastOpenedWalletId = 0;
        router.push({ name: "add-wallet" });
      }
    }
  );

  // #region computed
  const assets = computed((): StateAsset[] => {
    return privateState.assets.map((x) => {
      const metadata = assetsStore.metadata.get(x.tokenId);

      return {
        tokenId: x.tokenId,
        address: x.address,
        confirmedAmount: decimalize(bn(x.confirmedAmount), metadata?.decimals),
        unconfirmedAmount: decimalize(bn(x.unconfirmedAmount), metadata?.decimals),
        metadata
      };
    });
  });

  const balance = computed((): StateAssetSummary[] => {
    const summary = [] as StateAssetSummary[];
    const groupedAssets = groupBy(assets.value, (x) => x.tokenId);
    for (const tokenId in groupedAssets) {
      if (assetsStore.blacklist.includes(tokenId)) continue;

      const assetGroup = groupedAssets[tokenId];
      summary.push({
        tokenId: assetGroup[0].tokenId,
        confirmedAmount: sumBy(assetGroup, (x) => x.confirmedAmount),
        unconfirmedAmount: sumBy(assetGroup, (x) => x.unconfirmedAmount ?? 0),
        metadata: assetGroup[0].metadata
      });
    }

    if (summary.length === 0) {
      return [
        {
          tokenId: ERG_TOKEN_ID,
          confirmedAmount: bn(0),
          metadata: assetsStore.metadata.get(ERG_TOKEN_ID)
        }
      ];
    }

    return summary.sort((a, b) =>
      a.tokenId === ERG_TOKEN_ID ? Number.MIN_SAFE_INTEGER : a.tokenId.localeCompare(b.tokenId)
    );
  });

  /**
   * Returns all addresses with their assets, sorted by index
   */
  const addresses = computed((): StateAddress[] =>
    privateState.addresses
      .map((address) => ({
        script: address.script,
        state: address.state,
        index: address.index,
        assets: assets.value.filter((asset) => asset.address === address.script)
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

  // #region public actions
  async function load(walletId: number, opt = { syncInBackground: true }) {
    if (privateState.id === walletId) return;
    const wlt = appStore.wallets.find((w) => w.id === walletId);
    if (!wlt) throw new Error(`Wallet 'id:${walletId}' not found`);
    setLoading(true);

    privateState.id = wlt.id!;
    privateState.type = wlt.type;
    privateState.publicKey = wlt.publicKey;
    privateState.chainCode = wlt.chainCode;
    privateState.lastSynced = wlt.lastSynced ?? 0;
    name.value = wlt.name;
    settings.value = wlt.settings;

    const dbAssets = await assetsDbService.getByWalletId(walletId);
    const dbAddresses = await addressesDbService.getByWalletId(walletId);

    await assetsStore.loadMetadata(
      dbAssets.map((x) => x.tokenId),
      { fetchInBackground: true }
    );
    privateState.assets = dbAssets;
    privateState.addresses = dbAddresses;
    appStore.settings.lastOpenedWalletId = walletId;

    hdKeyPool.alloc(
      privateState.publicKey,
      HdKey.fromPublicKey({ publicKey: wlt.publicKey, chainCode: wlt.chainCode })
    );

    if (opt.syncInBackground) {
      sync();
    } else {
      await sync();
    }

    setLoading(false);
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
      walletId: privateState.id
    };

    privateState.addresses.push(dbObj);
    await addressesDbService.put(dbObj);
  }

  // #region private actions
  async function sync() {
    if (Date.now() - privateState.lastSynced < MIN_SYNC_INTERVAL) return setSyncing(false);
    setSyncing(true);

    const walletId = privateState.id;
    const deriver = hdKeyPool.get(privateState.publicKey);
    const addressesChunks = [] as IDbAddress[][];
    const assetsChunks = [] as IDbAsset[][];
    let offset = 0;
    let keepChecking = true;

    while (keepChecking && walletId === privateState.id) {
      const derived = getOrDerive(privateState.addresses, deriver, CHUNK_DERIVE_LENGTH, offset);
      const info = await graphQLService.getAddressesInfo(derived.map((x) => x.script));

      addressesChunks.push(
        derived.map((d) => ({
          index: d.index,
          script: d.script,
          state: info.find((x) => x.address === d.script)?.used
            ? AddressState.Used
            : AddressState.Unused,
          type: AddressType.P2PK,
          walletId
        }))
      );

      assetsChunks.push(
        info.flatMap((address) =>
          address.assets.map(
            (asset): IDbAsset => ({
              address: address.address,
              tokenId: asset.tokenId,
              confirmedAmount: asset.confirmedAmount,
              unconfirmedAmount: asset.unconfirmedAmount,
              walletId
            })
          )
        )
      );

      offset += derived.length;
      keepChecking = info.some((x) => x.used);
    }

    if (walletId !== privateState.id) return; // ensure we are still on the same wallet

    // detect changes
    const { changedAddresses, changedAssets, removedAssets } = getChanges(
      privateState.addresses,
      addressesChunks.flat(),
      privateState.assets,
      assetsChunks.flat()
    );

    // persist data
    await addressesDbService.bulkPut(changedAddresses);
    await assetsDbService.bulkPut(changedAssets);
    await assetsDbService.bulkDelete(removedAssets);

    // load metadata for changed assets
    if (changedAssets.length > 0) {
      await assetsStore.loadMetadata(changedAssets.map((x) => x.tokenId));
    }

    // update state
    if (walletId !== privateState.id) return; // ensure we are still on the same wallet
    privateState.patchAddresses(changedAddresses);
    privateState.patchAssets(changedAssets, removedAssets);
    privateState.lastSynced = Date.now();

    setSyncing(false);
  }

  function setSyncing(value: boolean) {
    privateState.syncing = value;
  }

  function setLoading(value: boolean) {
    privateState.loading = value;
  }

  return {
    id: computed(() => privateState.id),
    type: computed(() => privateState.type),
    publicKey: computed(() => privateState.publicKey),
    chainCode: computed(() => privateState.chainCode),
    loading: computed(() => privateState.loading),
    syncing: computed(() => privateState.syncing),
    name,
    settings,
    addresses,
    filteredAddresses,
    changeAddress,
    balance,
    nonArtworkBalance,
    artworkBalance,
    load,
    deriveNewAddress
  };
});

function getChanges(
  currentAddresses: IDbAddress[],
  newAddress: IDbAddress[],
  currentAssets: IDbAsset[],
  newAssets: IDbAsset[]
) {
  const sortedAddresses = newAddress.sort((a, b) => a.index - b.index);
  const latUsedIndex = sortedAddresses.findLastIndex((a) => a.state === AddressState.Used);
  const prunedAddresses = sortedAddresses.slice(0, latUsedIndex + 2); // keep last used and next unused

  const changedAddresses = prunedAddresses.filter((newAddress) => {
    const currentAddress = currentAddresses.find((x) => x.script === newAddress.script);
    if (!currentAddress) return true;
    return currentAddress.state !== newAddress.state;
  });

  const changedAssets = newAssets.filter((newAsset) => {
    if (!prunedAddresses.some((x) => x.script === newAsset.address)) return false;

    const currentAsset = currentAssets.find(
      (x) => x.tokenId === newAsset.tokenId && x.address === newAsset.address
    );
    if (!currentAsset) return true;

    return (
      currentAsset.confirmedAmount !== newAsset.confirmedAmount ||
      currentAsset.unconfirmedAmount !== newAsset.unconfirmedAmount
    );
  });

  const removedAssets = currentAssets.filter(
    (c) => !newAssets.some((n) => n.address === c.address && n.tokenId === c.tokenId)
  );

  return { changedAddresses, changedAssets, removedAssets };
}

function getOrDerive(derived: IndexedAddress[], deriver: HdKey, count: number, offset: number) {
  const chunk = derived.slice(offset, offset + count);
  if (chunk.length < count) {
    const remaining = count - chunk.length;
    chunk.push(...deriver.deriveAddresses(remaining, offset + chunk.length));
  }

  return chunk;
}

function artwork(asset: { metadata?: BasicAssetMetadata }) {
  return (
    asset.metadata &&
    (asset.metadata.type === AssetSubtype.PictureArtwork ||
      asset.metadata.type === AssetSubtype.AudioArtwork ||
      asset.metadata.type === AssetSubtype.VideoArtwork)
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePrivateStateStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(useWalletStore, import.meta.hot));
}
