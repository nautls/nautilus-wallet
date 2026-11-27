import { computed, reactive, shallowReactive, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { ensureDefaults, isEmpty, uniq } from "@fleet-sdk/common";
import { assetPricingService, AssetRate } from "@/chains/ergo/services/assetPricingService";
import { getAssetsMetadata } from "@/chains/ergo/services/hergmesService";
import { log } from "@/common/logger";
import {
  ErgoTokenBlacklist,
  ergoTokenBlacklistService
} from "@/chains/ergo/services/tokenBlacklistService";
import { useWebExtStorage } from "@/composables/useWebExtStorage";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { assetInfoDbService } from "@/database/assetInfoDbService";
import { IAssetInfo } from "@/types/database";
import { AssetType, BasicAssetMetadata } from "@/types/internal";
import { useAppStore } from "./appStore";

export type LoadMetadataOptions = { fetchInBackground: boolean; persist: boolean };

const ERG_METADATA: BasicAssetMetadata = { name: "ERG", decimals: ERG_DECIMALS };
const METADATA_RETRY_MS = 15_000;
const METADATA_RETRY_MAX_MS = 5 * 60_000;

const PRICE_RATES_UPDATE_INTERVAL = 5 * 30 * 1000;
const PRICE_RATES_DEFAULTS = { lastUpdated: 0, prices: new Map<string, AssetRate>() };
const PRICE_RATES_SERIALIZER = {
  read: (raw: string): typeof PRICE_RATES_DEFAULTS => {
    const parsed = JSON.parse(raw);
    return {
      lastUpdated: parsed.lastUpdated,
      prices: new Map<string, AssetRate>(parsed.prices)
    };
  },
  write(val: typeof PRICE_RATES_DEFAULTS): string {
    return JSON.stringify({
      lastUpdated: val.lastUpdated,
      prices: Array.from(val.prices.entries())
    });
  }
};

const BLACKLIST_UPDATE_INTERVAL = 10 * 60 * 1000;
const BLACKLIST_DEFAULTS = {
  lastUpdated: 0,
  nsfw: [] as string[],
  scam: [] as string[]
};

const DEFAULT_DB_CONFIG = { shallow: true, mergeDefaults: true };

const elapsed = (interval: number, lastUpdated: number) => Date.now() - lastUpdated >= interval;

const usePrivateState = defineStore("_assets", () => ({
  blacklist: useWebExtStorage("ergoTokensBlacklist", BLACKLIST_DEFAULTS, DEFAULT_DB_CONFIG),
  prices: useWebExtStorage("ergoTokenRates", PRICE_RATES_DEFAULTS, {
    ...DEFAULT_DB_CONFIG,
    serializer: PRICE_RATES_SERIALIZER
  })
}));

export const useAssetsStore = defineStore("assets", () => {
  const app = useAppStore();
  const privateState = usePrivateState();

  const metadata = shallowReactive(new Map([[ERG_TOKEN_ID, ERG_METADATA]]));

  const loaded = reactive({ blacklists: false, prices: false });

  watch(
    () => privateState.blacklist,
    () => {
      loaded.blacklists = true;
      fetchBlacklists();
    },
    { once: true }
  );

  watch(
    () => privateState.prices,
    () => {
      loaded.prices = true;
      loadAssetPriceRates();
    },
    { once: true }
  );

  watch(
    () => app.settings.conversionCurrency,
    () => loadAssetPriceRates(true)
  );

  watch(
    () => app.settings.blacklistedTokensLists,
    () => fetchBlacklists(true)
  );

  async function fetchBlacklists(force = false) {
    if (!loaded.blacklists) return;

    const lastUpdated = privateState.blacklist.lastUpdated ?? Date.now();
    if (!force && !elapsed(BLACKLIST_UPDATE_INTERVAL, lastUpdated)) return;

    const ergoBlacklists = await ergoTokenBlacklistService.fetch();
    if (!ergoBlacklists) return;

    privateState.blacklist = { ...ergoBlacklists, lastUpdated: Date.now() };
  }

  async function loadAssetPriceRates(force = false) {
    if (!loaded.prices) return;

    const lastUpdated = privateState.prices.lastUpdated ?? Date.now();
    if (!force && !elapsed(PRICE_RATES_UPDATE_INTERVAL, lastUpdated)) return;

    const prices = await assetPricingService.getRates(app.settings.conversionCurrency);
    if (prices) privateState.prices = { lastUpdated: Date.now(), prices };
  }

  const blacklist = computed(() => {
    let tokenIds = [] as string[];
    if (isEmpty(app.settings.blacklistedTokensLists) || isEmpty(privateState.blacklist)) {
      return tokenIds;
    }

    for (const listName of app.settings.blacklistedTokensLists) {
      const list = privateState.blacklist[listName as keyof ErgoTokenBlacklist];
      if (Array.isArray(list) && list.length > 0) tokenIds = tokenIds.concat(list);
    }

    return tokenIds;
  });

  /** Token blacklists as published, regardless of which ones are enabled in the settings. */
  const blacklists = computed((): ErgoTokenBlacklist => ({
    nsfw: privateState.blacklist.nsfw ?? [],
    scam: privateState.blacklist.scam ?? []
  }));

  const prices = computed(() => privateState.prices.prices);

  async function loadMetadata(tokenIds: string[], options?: Partial<LoadMetadataOptions>) {
    const { fetchInBackground, persist } = ensureDefaults(options, {
      fetchInBackground: false,
      persist: true
    });

    const unloaded = uniq(tokenIds).filter((x) => !metadata.has(x));
    if (unloaded.length === 0) return;

    let dbMeta: IAssetInfo[] = [];
    try {
      dbMeta = await assetInfoDbService.getAnyOf(unloaded);
    } catch (e) {
      log.error("Failed to read stored metadata", e);
    }
    patchMetadata(dbMeta);

    const stored = new Set(dbMeta.map((x) => x.id));
    const missing = unloaded.filter((id) => !stored.has(id));
    if (missing.length === 0) return;

    const loading = loadRemoteMetadata(missing, persist);
    if (!fetchInBackground) await loading;
  }

  /** Tokens whose metadata couldn't be fetched; they are tried again until it is. */
  const unavailable = shallowReactive(new Set<string>());
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = METADATA_RETRY_MS;

  async function loadRemoteMetadata(missing: string[], persist: boolean) {
    const fetched = await getAssetsMetadata(missing);
    if (!fetched) {
      for (const id of missing) unavailable.add(id);
      scheduleRetry();
      return;
    }

    const known = new Set(fetched.map((x) => x.id));
    // kept in memory only, so a token the relay hasn't indexed yet is asked for next session
    patchMetadata([...fetched, ...missing.filter((id) => !known.has(id)).map(unknownMetadata)]);
    if (persist && fetched.length > 0) {
      await assetInfoDbService
        .bulkPut(fetched)
        .catch((e) => log.error("Failed to store metadata", e));
    }
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(retryUnavailable, retryDelay);
    retryDelay = Math.min(retryDelay * 2, METADATA_RETRY_MAX_MS);
  }

  async function retryUnavailable() {
    retryTimer = undefined;
    if (unavailable.size > 0) await loadRemoteMetadata([...unavailable], false);
    if (unavailable.size === 0) retryDelay = METADATA_RETRY_MS;
  }

  function patchMetadata(patch: IAssetInfo[]) {
    if (patch.length === 0) return;
    for (const info of patch) {
      unavailable.delete(info.id);
      metadata.set(info.id, {
        name: info.name,
        decimals: info.decimals,
        type: info.subtype,
        artworkUrl: info.artworkCover ?? info.artworkUrl
      });
    }
  }

  const pricesLoaded = computed(() => loaded.prices);

  return { blacklist, blacklists, metadata, unavailable, prices, pricesLoaded, loadMetadata };
});

function unknownMetadata(id: string): IAssetInfo {
  return { id, mintingBoxId: "", type: AssetType.Unknown };
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetsStore, import.meta.hot));
}
