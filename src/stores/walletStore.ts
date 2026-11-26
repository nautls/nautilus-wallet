import { computed, ref, shallowRef, toRaw, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import type BigNumber from "bignumber.js";
import { groupBy, isEqual, maxBy } from "es-toolkit";
import type { Assets, Relay, Subscription } from "@hergmes/sdk";
import { useRouter } from "vue-router";
import HdKey, { IndexedAddress } from "@/chains/ergo/hdKey";
import {
  AddressBalance,
  getAddressBalances,
  hasBoxesCreatedBefore
} from "@/chains/ergo/services/hergmesService";
import { log } from "@/common/logger";
import { hdKeyPool } from "@/common/objectPool";
import { patchArray } from "@/common/reactivity";
import { CHUNK_DERIVE_LENGTH, ERG_TOKEN_ID, HEALTHY_BLOCKS_AGE } from "@/constants/ergo";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { walletSyncDbService } from "@/database/walletSyncDbService";
import { assetIconMap } from "@/mappers/assetIconMap";
import { IDbAddress, IDbAsset } from "@/types/database";
import {
  AddressState,
  AddressType,
  AssetInfo,
  AssetSubtype,
  BasicAssetMetadata,
  WalletSettings,
  WalletType
} from "@/types/internal";
import { bn, decimalize, sumBy } from "../common/bigNumber";
import { MIN_SYNC_INTERVAL } from "../constants/intervals";
import { useAppStore } from "./appStore";
import { useAssetsStore } from "./assetsStore";
import { useChainStore } from "./chainStore";
import { useRelayStore } from "./relayStore";

export interface AssetBalance extends AssetInfo {
  balance: BigNumber;
}

interface StateAsset extends AssetInfo {
  confirmedAmount: BigNumber;
  unconfirmedAmount?: BigNumber;
  address?: string;
}

export interface StateAddress {
  script: string;
  state: AddressState;
  index: number;
  assets: StateAsset[];
}

const KNOWN_ASSETS = new Set(assetIconMap.keys());

/**
 * Addresses followed over the relay's socket, which takes 200 subscriptions; the rest are left
 * for built-in dApps' keys. Addresses past it are read again on each new block.
 */
export const MAX_ADDRESS_SUBSCRIPTIONS = 180;

const usePrivateStateStore = defineStore("_wallet", () => {
  const addresses = shallowRef<IDbAddress[]>([]);
  const assets = shallowRef<IDbAsset[]>([]);

  function pushAddress(address: IDbAddress) {
    addresses.value = [...addresses.value, address];
  }

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
    type: ref<WalletType>("standard"),
    publicKey: ref(""),
    chainCode: ref(""),
    lastSynced: ref(0),
    hasOldUtxos: ref(false),
    addresses,
    assets,
    patchAddresses,
    pushAddress,
    patchAssets
  };
});

export const useWalletStore = defineStore("wallet", () => {
  const router = useRouter();
  const appStore = useAppStore();
  const assetsStore = useAssetsStore();
  const privateState = usePrivateStateStore();
  const chain = useChainStore();
  const relayStore = useRelayStore();

  // #region state
  const name = ref("");
  const settings = ref<WalletSettings>({
    avoidAddressReuse: false,
    addressFilter: "all",
    defaultChangeIndex: 0
  });

  let pendingWrites = 0;
  let loadCount = 0; // bumped on every load, so syncs started by a previous one are discarded
  const storedWallet = () => appStore.wallets.find((w) => w.id === privateState.id);

  /** Applies changes to the loaded wallet made by other windows, such as a rename. */
  function applyStoredChanges() {
    const stored = storedWallet();
    if (!stored || privateState.loading || pendingWrites > 0) return;

    if (stored.name !== name.value) name.value = stored.name;
    if (!isEqual(stored.settings, toRaw(settings.value))) settings.value = { ...stored.settings };
  }

  // #region watches
  watch(
    [name, settings],
    async () => {
      if (privateState.loading) return;

      const stored = storedWallet();
      if (stored?.name === name.value && isEqual(stored.settings, toRaw(settings.value))) {
        return; // already stored, e.g. just applied from another window
      }

      pendingWrites++;
      try {
        await appStore.updateWallet(privateState.id, {
          name: name.value,
          settings: toRaw(settings.value)
        });
      } finally {
        pendingWrites--;
        applyStoredChanges(); // in case another window changed it meanwhile
      }
    },
    { deep: true }
  );

  watch(storedWallet, applyStoredChanges);

  watch(
    () => appStore.loading,
    () => {
      if (appStore.loading) return;
      const walletId = appStore.settings.lastOpenedWalletId;
      if (appStore.wallets.length > 0) {
        load(appStore.wallets.some((x) => x.id === walletId) ? walletId : appStore.wallets[0].id);
      } else {
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
        router.push({ name: "assets" });
      } else {
        appStore.settings.lastOpenedWalletId = 0;
        router.push({ name: "add-wallet" });
      }
    }
  );

  watch(
    [
      () => relayStore.relay,
      () => privateState.id,
      () => privateState.loading || !storedWallet(),
      () => privateState.addresses,
      // ranks addresses by whether they hold assets
      () => [...new Set(privateState.assets.map((x) => x.address))].sort().join()
    ],
    ([relay, walletId, idle]) => follow(relay, walletId, idle)
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

  const balance = computed(() => summarizeBalance(new Set(assetsStore.blacklist)));

  /** Same as `balance`, but includes tokens hidden by the enabled token blacklists. */
  const unfilteredBalance = computed(() => summarizeBalance());

  function summarizeBalance(hidden?: Set<string>): AssetBalance[] {
    const groupedAssets = groupBy(assets.value, (x) => x.tokenId);
    let summary = [] as AssetBalance[];

    for (const tokenId in groupedAssets) {
      if (hidden?.has(tokenId)) continue;

      const assetGroup = groupedAssets[tokenId];
      const balance = sumBy(assetGroup, (x) => x.confirmedAmount.plus(x.unconfirmedAmount ?? 0));
      if (tokenId !== ERG_TOKEN_ID && balance.lte(0)) continue;

      summary.push({ tokenId, balance, metadata: assetGroup[0].metadata });
    }

    if (summary.length === 0) {
      return [
        {
          tokenId: ERG_TOKEN_ID,
          balance: bn(0),
          metadata: assetsStore.metadata.get(ERG_TOKEN_ID)
        }
      ];
    }

    if (summary.length <= 1) return summary;

    // sort alphabetically
    summary = summary.sort((a, b) =>
      (a.metadata?.name ?? a.tokenId).localeCompare(b.metadata?.name ?? b.tokenId)
    );

    // rank assets and return
    return summary.sort(rankAssets);
  }

  const health = computed(() => ({
    utxoCount: 0, // see: https://github.com/nautls/nautilus-wallet/issues/176
    hasOldUtxos: privateState.hasOldUtxos
  }));

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
    // all addresses
    if (settings.value.addressFilter === "all") {
      return addresses.value;
    }

    // unused addresses
    if (settings.value.addressFilter === "unused") {
      return addresses.value.filter((address) => address.state !== AddressState.Used);
    }

    // active addresses (with assets)
    return addresses.value.filter((address) => address.assets.length > 0);
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
  async function load(walletId: number, opt: { syncInBackground?: boolean; force?: boolean } = {}) {
    if (privateState.id === walletId && !opt.force) return;
    const wlt = appStore.wallets.find((w) => w.id === walletId);
    if (!wlt) throw new Error(`Wallet 'id:${walletId}' not found`);
    const syncInBackground = opt.syncInBackground ?? true;
    loadCount++;
    setLoading(true);

    try {
      privateState.id = wlt.id!;
      privateState.type = wlt.type;
      privateState.publicKey = wlt.publicKey;
      privateState.chainCode = wlt.chainCode;
      privateState.hasOldUtxos = false;
      name.value = wlt.name;
      settings.value = { ...wlt.settings }; // a copy, so edits aren't applied to the stored list

      const dbAssets = await assetsDbService.getByWalletId(walletId);
      const tokenIds = dbAssets.map((x) => x.tokenId);
      await assetsStore.loadMetadata(tokenIds, { fetchInBackground: syncInBackground });
      privateState.assets = dbAssets;

      const dbAddresses = await addressesDbService.getByWalletId(walletId);
      privateState.addresses = dbAddresses;
      privateState.lastSynced = await walletSyncDbService.getLastSynced(walletId);

      appStore.settings.lastOpenedWalletId = walletId;

      hdKeyPool.alloc(
        privateState.publicKey,
        HdKey.fromPublicKey({ publicKey: wlt.publicKey, chainCode: wlt.chainCode })
      );

      if (syncInBackground) {
        sync().catch((e) => log.error("Failed to sync wallet", e));
      } else {
        await sync();
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * Wipes the opened wallet's locally stored chain data and rebuilds it from scratch, the
   * same way an imported wallet is synced.
   */
  async function resync() {
    const walletId = privateState.id;
    const lastIndex = () => maxBy(privateState.addresses, (x) => x.index)?.index ?? -1;
    const lastKnownIndex = lastIndex();
    loadCount++; // discard in-flight syncs, so they don't persist stale data after the wipe
    setLoading(true); // hold off height-triggered syncs while the data is wiped

    try {
      await walletSyncDbService.clear(walletId);
    } catch (e) {
      setLoading(false);
      throw e;
    }

    await load(walletId, { syncInBackground: false, force: true });

    // sync only keeps one unused address past the last used one, so restore the manually
    // derived ones, as they can be set as the default change address
    while (privateState.id === walletId && lastIndex() < lastKnownIndex) {
      await deriveNewAddress();
    }
  }

  async function deriveNewAddress() {
    const lastUsed = addresses.value.findLastIndex((x) => x.state === AddressState.Used);
    if (addresses.value.length - lastUsed > CHUNK_DERIVE_LENGTH) {
      throw new RangeError(
        `Cannot generate more than ${CHUNK_DERIVE_LENGTH} unused addresses in a row.`
      );
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

    privateState.pushAddress(dbObj);
    await addressesDbService.put(dbObj);
  }

  let checkOldUtxosOnHeight = false;
  watch(
    () => chain.height,
    (height) => {
      if (!height || !checkOldUtxosOnHeight) return;
      checkOldUtxosOnHeight = false;
      checkOldUtxos();
    }
  );

  async function checkOldUtxos() {
    if (!chain.height) {
      checkOldUtxosOnHeight = true;
      return;
    }

    const walletId = privateState.id;
    // every box holds ERG, so only these addresses have confirmed boxes
    const holders = privateState.assets
      .filter((x) => x.tokenId === ERG_TOKEN_ID && x.confirmedAmount !== "0")
      .map((x) => x.address);

    try {
      const hasOld = await hasBoxesCreatedBefore(chain.height - HEALTHY_BLOCKS_AGE, holders);
      if (walletId === privateState.id) privateState.hasOldUtxos = hasOld;
    } catch (e) {
      log.error("Failed to check for old boxes", e);
    }
  }

  // #region relay subscriptions
  type Hold = { subscription: Subscription; stop: () => void };
  const holds = new Map<string, Hold>();
  /** Bumped on every change of a hold's state, which isn't reactive. */
  const holdsVersion = shallowRef(0);
  const followPhases = computed(() => {
    void holdsVersion.value;
    return [...holds.values()].map((h) => h.subscription.state.phase);
  });
  let followed: { relay: Relay; walletId: number } | undefined;
  let stopPolling: (() => void) | undefined;

  /**
   * Follows the balances of the wallet's addresses: by subscription up to
   * `MAX_ADDRESS_SUBSCRIPTIONS`, the most likely to change first, and the rest on each block.
   */
  function follow(relay: Relay | undefined, walletId: number, idle: boolean) {
    if (followed && (followed.relay !== relay || followed.walletId !== walletId || idle)) {
      unfollow();
    }
    if (!relay || !walletId || idle) return;
    followed = { relay, walletId };

    const holding = new Set(privateState.assets.map((x) => x.address));
    const rank = (a: IDbAddress) =>
      holding.has(a.script)
        ? 0
        : a.index === settings.value.defaultChangeIndex
          ? 1
          : a.state === AddressState.Unused
            ? 2
            : 3;
    const ranked = [...privateState.addresses].sort(
      (a, b) => rank(a) - rank(b) || a.index - b.index
    );
    const subscribed = new Set(ranked.slice(0, MAX_ADDRESS_SUBSCRIPTIONS).map((x) => x.script));
    const polled = ranked.slice(MAX_ADDRESS_SUBSCRIPTIONS).map((x) => x.script);

    for (const [script, hold] of holds) {
      if (subscribed.has(script)) continue;
      release(hold);
      holds.delete(script);
    }

    for (const script of subscribed) {
      if (holds.has(script)) continue;
      const subscription = relay.subscribe({ address: script }, { boxes: false });
      const stop = subscription.subscribe(({ balance }) => {
        holdsVersion.value++;
        if (balance) applyBalance(walletId, script, balance.confirmed, balance.pending);
      });
      holds.set(script, { subscription, stop });
    }
    holdsVersion.value++;

    stopPolling?.();
    stopPolling = undefined;
    if (polled.length > 0) {
      const poll = () => refreshBalances(walletId, loadCount, polled);
      stopPolling = relay.onTip(poll);
      poll();
    }
  }

  function unfollow() {
    for (const hold of holds.values()) release(hold);
    holds.clear();
    stopPolling?.();
    stopPolling = undefined;
    followed = undefined;
    holdsVersion.value++;
  }

  function release(hold: Hold) {
    hold.stop();
    hold.subscription.close();
  }

  async function refreshBalances(walletId: number, loadId: number, scripts: string[]) {
    try {
      const balances = await getAddressBalances(scripts);
      // a resync wiped what this read would patch
      if (loadId !== loadCount) return;
      for (const b of balances) {
        applyBalance(walletId, b.address, b.confirmed, b.pending);
      }
    } catch (e) {
      log.error("Failed to refresh balances", e);
    }
  }

  /** Applies and stores an address's latest balance; an address that holds assets is used. */
  function applyBalance(walletId: number, script: string, confirmed: Assets, pending: Assets) {
    // while loading, the store may be wiped; subscriptions start again once it's done
    if (walletId !== privateState.id || privateState.loading || !storedWallet()) return;
    const address = privateState.addresses.find((x) => x.script === script);
    if (!address) return;

    const { changedAssets, removedAssets } = diffAssets(
      privateState.assets.filter((x) => x.address === script),
      toDbAssets(walletId, script, confirmed, pending)
    );
    const becameUsed = address.state !== AddressState.Used && changedAssets.length > 0;
    const changedAddresses = becameUsed ? [{ ...address, state: AddressState.Used }] : [];
    if (changedAssets.length === 0 && removedAssets.length === 0) return;

    privateState.patchAssets(changedAssets, removedAssets);
    privateState.patchAddresses(changedAddresses);
    if (changedAssets.length > 0) assetsStore.loadMetadata(changedAssets.map((x) => x.tokenId));

    walletSyncDbService
      .save(walletId, { changedAddresses, changedAssets, removedAssets })
      .catch((e) => log.error("Failed to store balances", e));

    // keeps an unused address past the last used one
    if (becameUsed) sync({ force: true }).catch((e) => log.error("Failed to sync wallet", e));
  }

  // #region private actions
  let discovery: Promise<void> | undefined;
  let discoverAgain = false;

  /**
   * Looks for addresses used past the last known used one; balances of known addresses are
   * followed by `follow`. A sync asked for while one runs runs again after it.
   */
  function sync(opt: { force?: boolean } = {}): Promise<void> {
    if (!opt.force && Date.now() - privateState.lastSynced < MIN_SYNC_INTERVAL) {
      setSyncing(false);
      return Promise.resolve();
    }

    if (discovery) {
      discoverAgain = true;
      return discovery;
    }

    discovery = (async () => {
      try {
        do {
          discoverAgain = false;
          await discover();
        } while (discoverAgain);
      } finally {
        discovery = undefined;
      }
    })();

    return discovery;
  }

  async function discover() {
    setSyncing(true);

    const walletId = privateState.id;
    const loadId = loadCount;
    const isCurrent = () => walletId === privateState.id && loadId === loadCount;

    try {
      const deriver = hdKeyPool.get(privateState.publicKey);
      const known = [...privateState.addresses].sort((a, b) => a.index - b.index);
      const scanned = [] as IDbAddress[];
      const balances = new Map<string, AddressBalance>();
      let offset = known.findLastIndex((x) => x.state === AddressState.Used) + 1;
      let keepChecking = true;

      while (keepChecking && isCurrent()) {
        const derived = getOrDerive(known, deriver, CHUNK_DERIVE_LENGTH, offset);
        const info = await getAddressBalances(derived.map((x) => x.script));
        for (const b of info) balances.set(b.address, b);

        scanned.push(
          ...derived.map((d) => ({
            type: AddressType.P2PK,
            state: balances.get(d.script)?.used ? AddressState.Used : AddressState.Unused,
            script: d.script,
            index: d.index,
            walletId
          }))
        );

        offset += derived.length;
        keepChecking = info.some((x) => x.used);
      }

      if (!isCurrent()) return;

      // keep the last used address and the next unused one
      const kept = scanned.slice(
        0,
        scanned.findLastIndex((x) => x.state === AddressState.Used) + 2
      );
      const keptScripts = new Set(kept.map((x) => x.script));
      const changedAddresses = kept.filter((a) => {
        const current = known.find((x) => x.script === a.script);
        return !current || current.state !== a.state;
      });

      // a followed balance is newer than the one read here
      const nextAssets = kept.flatMap((a) => {
        const b = holds.get(a.script)?.subscription.state.balance ?? balances.get(a.script);
        return b ? toDbAssets(walletId, a.script, b.confirmed, b.pending) : [];
      });
      const { changedAssets, removedAssets } = diffAssets(
        privateState.assets.filter((x) => keptScripts.has(x.address)),
        nextAssets
      );

      // patched and saved before any await, so a balance that arrives meanwhile lands after it
      const syncedAt = Date.now();
      privateState.patchAddresses(changedAddresses);
      privateState.patchAssets(changedAssets, removedAssets);
      privateState.lastSynced = syncedAt;
      const saved = walletSyncDbService.save(
        walletId,
        { changedAddresses, changedAssets, removedAssets },
        syncedAt
      );

      if (changedAssets.length > 0) {
        assetsStore
          .loadMetadata(changedAssets.map((x) => x.tokenId))
          .catch((e) => log.error("Failed to load metadata", e));
      }
      await saved;

      if (isCurrent()) checkOldUtxos();
    } finally {
      if (isCurrent()) setSyncing(false);
    }
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
    synced: computed(() => privateState.lastSynced > 0),
    health,
    followPhases,
    needsBackup: computed(() => storedWallet()?.needsBackup ?? false),
    createdAt: computed(() => storedWallet()?.createdAt ?? 0),
    name,
    settings,
    addresses,
    filteredAddresses,
    changeAddress,
    balance,
    unfilteredBalance,
    nonArtworkBalance,
    artworkBalance,
    load,
    resync,
    deriveNewAddress
  };
});

/** An address's assets as stored: one row per asset it holds or the mempool changes. */
function toDbAssets(
  walletId: number,
  address: string,
  confirmed: Assets,
  pending: Assets
): IDbAsset[] {
  const amounts = new Map<string, { confirmed: bigint; pending: bigint }>();
  const add = (tokenId: string, kind: "confirmed" | "pending", amount: bigint) => {
    const entry = amounts.get(tokenId) ?? { confirmed: 0n, pending: 0n };
    entry[kind] += amount;
    amounts.set(tokenId, entry);
  };

  add(ERG_TOKEN_ID, "confirmed", confirmed.nanoErgs);
  add(ERG_TOKEN_ID, "pending", pending.nanoErgs);
  for (const [tokenId, amount] of confirmed.tokens) add(tokenId, "confirmed", amount);
  for (const [tokenId, amount] of pending.tokens) add(tokenId, "pending", amount);

  return [...amounts]
    .filter(([, x]) => x.confirmed !== 0n || x.pending !== 0n)
    .map(([tokenId, x]) => ({
      address,
      tokenId,
      confirmedAmount: x.confirmed.toString(),
      unconfirmedAmount: x.pending !== 0n ? x.pending.toString() : undefined,
      walletId
    }));
}

/** What changed from `current` to `next`, both the assets of the same addresses. */
function diffAssets(current: IDbAsset[], next: IDbAsset[]) {
  const same = (a: IDbAsset, b: IDbAsset) => a.tokenId === b.tokenId && a.address === b.address;

  const changedAssets = next.filter((n) => {
    const c = current.find((x) => same(x, n));
    return (
      !c || c.confirmedAmount !== n.confirmedAmount || c.unconfirmedAmount !== n.unconfirmedAmount
    );
  });
  const removedAssets = current.filter((c) => !next.some((n) => same(c, n)));

  return { changedAssets, removedAssets };
}

/**
 * Compares two assets and ranks them based on predefined criteria.
 *
 * The ranking criteria are as follows:
 * 1. The asset with the token ID matching `ERG_TOKEN_ID` is ranked higher.
 * 2. If one asset's token ID is in the `KNOWN_ASSETS` set and the other is not, the known asset is ranked higher.
 * 3. If both assets are either known or unknown, they are compared alphabetically by their metadata name.
 *    If the metadata name is not available, the token ID is used for comparison.
 *
 * @param a - The first asset to compare.
 * @param b - The second asset to compare.
 * @returns A negative number if `a` should be ranked higher, a positive number if `b` should be ranked higher,
 *          or zero if they are considered equal in ranking.
 */
function rankAssets(a: AssetInfo, b: AssetInfo) {
  if (a.tokenId === ERG_TOKEN_ID) return -1;
  if (b.tokenId === ERG_TOKEN_ID) return 1;
  if (KNOWN_ASSETS.has(a.tokenId) && !KNOWN_ASSETS.has(b.tokenId)) return -1;
  if (KNOWN_ASSETS.has(b.tokenId) && !KNOWN_ASSETS.has(a.tokenId)) return 1;
  return (a.metadata?.name ?? a.tokenId).localeCompare(b.metadata?.name ?? b.tokenId);
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
