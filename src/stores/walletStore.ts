import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, ref, ShallowReactive, shallowReactive, toRaw, watch } from "vue";
import { groupBy, maxBy } from "lodash-es";
import type { BigNumber } from "bignumber.js";
import { bn, decimalize, sumBy } from "../common/bigNumber";
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
import { walletsDbService } from "@/database/walletsDbService";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { CHUNK_DERIVE_LENGTH, ERG_TOKEN_ID } from "@/constants/ergo";
import { hdKeyPool } from "@/common/objectPool";
import HdKey, { IndexedAddress } from "@/chains/ergo/hdKey";
import router from "@/router";
import { graphQLService } from "@/chains/ergo/services/graphQlService";

export type StateAssetSummary = {
  tokenId: string;
  confirmedAmount: BigNumber;
  unconfirmedAmount?: BigNumber;
  metadata?: BasicAssetMetadata;
};

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
  const assetsStore = useAssetsStore();

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
    if (loading.value) return [];

    const balance = [] as StateAssetSummary[];
    const groupedAssets = groupBy(assets.value, (x) => x.tokenId);
    for (const tokenId in groupedAssets) {
      if (assetsStore.blacklist.includes(tokenId)) continue;

      const assetGroup = groupedAssets[tokenId];
      balance.push({
        tokenId: assetGroup[0].tokenId,
        confirmedAmount: sumBy(assetGroup, (x) => x.confirmedAmount),
        unconfirmedAmount: sumBy(assetGroup, (x) => x.unconfirmedAmount ?? 0),
        metadata: assetGroup[0].metadata
      });
    }

    if (balance.length === 0) {
      return [
        {
          tokenId: ERG_TOKEN_ID,
          confirmedAmount: bn(0),
          metadata: assetsStore.metadata.get(ERG_TOKEN_ID)
        }
      ];
    }

    return balance.sort((a, b) =>
      a.tokenId === ERG_TOKEN_ID ? 1 : a.tokenId.localeCompare(b.tokenId)
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

    assetsStore.loadMetadataFor(dbAssets.map((x) => x.tokenId));
    hdKeyPool.alloc(
      privateState.publicKey,
      HdKey.fromPublicKey({ publicKey: dbWallet.publicKey, chainCode: dbWallet.chainCode })
    );

    sync();
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

  async function sync() {
    privateState.syncing = true;

    const walletId = id.value;
    const deriver = hdKeyPool.get(privateState.publicKey);
    let offset = 0;
    let keepChecking = true;
    const addressesChunks = [] as IDbAddress[][];
    const assetsChunks = [] as IDbAsset[][];

    while (keepChecking && walletId === id.value) {
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

    const { changedAddresses, changedAssets, removedAssets } = getChanges(
      privateState.addresses,
      addressesChunks.flat(),
      privateState.assets,
      assetsChunks.flat()
    );

    console.log("changedAddresses", changedAddresses);
    console.log("changedBalance", changedAssets);
    console.log("removedAssets", removedAssets);

    // await addressesDbService.bulkPut(changedAddresses, walletId);
    // await assetsDbService.bulkPut(changedAssets, walletId);
    // await assetsDbService.bulkDelete(removedAssets);

    await assetsStore.loadMetadataFor(changedAssets.map((x) => x.tokenId));

    if (walletId !== id.value) return; // wallet changed while syncing
    // patch state
    patchState(privateState.addresses, changedAddresses, [], (a, b) => a.script === b.script);
    patchState(
      privateState.assets,
      changedAssets,
      removedAssets,
      (a, b) => a.tokenId === b.tokenId && a.address === b.address
    );
    privateState.syncing = false;
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

function patchState<T>(
  state: ShallowReactive<T[]>,
  changes: T[],
  removed: T[],
  predicate: (current: T, changed: T) => boolean
) {
  for (const changed of changes) {
    const index = state.findIndex((old) => predicate(old, changed));

    if (index > -1) {
      state[index] = changed;
    } else {
      state.push(changed);
    }
  }

  if (removed.length > 0) {
    for (const item of removed) {
      const index = state.findIndex((old) => predicate(old, item));
      if (index > -1) state.splice(index, 1);
    }
  }
}

function getChanges(
  currentAddresses: IDbAddress[],
  newAddress: IDbAddress[],
  currentAssets: IDbAsset[],
  newAssets: IDbAsset[]
) {
  const sortedAddresses = newAddress.sort((a, b) => a.index - b.index);
  const latUsedIndex = sortedAddresses.findLastIndex((a) => a.state === AddressState.Used);
  const prunedAddresses = sortedAddresses.slice(0, latUsedIndex + 2); // keep last used and next unused

  const changedAddresses = prunedAddresses.filter((derivedAddress) => {
    const stateAddress = currentAddresses.find((a) => a.script === derivedAddress.script);
    if (!stateAddress) return true;
    return stateAddress.state !== derivedAddress.state;
  });

  const changedAssets = newAssets.filter((asset) => {
    if (!prunedAddresses.some((address) => asset.address === address.script)) return false;
    const stateAsset = currentAssets.find(
      (a) => a.tokenId === asset.tokenId && a.address === asset.address
    );

    if (!stateAsset) return true;
    return (
      stateAsset.confirmedAmount !== asset.confirmedAmount ||
      stateAsset.unconfirmedAmount !== asset.unconfirmedAmount
    );
  });

  const removedAssets = currentAssets.filter(
    (c) => !newAssets.some((n) => c.address === n.address)
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
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(useWalletStore, import.meta.hot));
}
