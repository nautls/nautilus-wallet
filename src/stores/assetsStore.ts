import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, shallowReactive, watch } from "vue";
import { ensureDefaults, isEmpty, uniq } from "@fleet-sdk/common";
import { useAppStore } from "./appStore";
import { assetInfoDbService } from "@/database/assetInfoDbService";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { assetPricingService, AssetRate } from "@/chains/ergo/services/assetPricingService";
import { AssetType, BasicAssetMetadata } from "@/types/internal";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import {
  ErgoTokenBlacklist,
  ergoTokenBlacklistService
} from "@/chains/ergo/services/tokenBlacklistService";
import { IAssetInfo } from "@/types/database";
import { useWebExtStorage } from "@/composables/useWebExtStorage";

export type LoadMetadataOptions = { fetchInBackground: boolean; persist: boolean };

const ERG_METADATA: BasicAssetMetadata = { name: "ERG", decimals: ERG_DECIMALS };

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

  onMounted(() => Promise.all([fetchBlacklists(), loadAssetPriceRates()]));

  watch(
    () => app.settings.conversionCurrency,
    () => loadAssetPriceRates(true)
  );
  watch(
    () => app.settings.blacklistedTokensLists,
    () => fetchBlacklists(true)
  );

  async function fetchBlacklists(force = false) {
    const lastUpdated = privateState.blacklist.lastUpdated ?? Date.now();
    if (!force && !elapsed(BLACKLIST_UPDATE_INTERVAL, lastUpdated)) return;

    const ergoBlacklists = await ergoTokenBlacklistService.fetch();
    privateState.blacklist = { ...ergoBlacklists, lastUpdated: Date.now() };
  }

  async function loadAssetPriceRates(force = false) {
    const lastUpdated = privateState.prices.lastUpdated ?? Date.now();
    if (!force && !elapsed(PRICE_RATES_UPDATE_INTERVAL, lastUpdated)) return;

    const prices = await assetPricingService.getRates(app.settings.conversionCurrency);
    privateState.prices = { lastUpdated: Date.now(), prices };
  }

  const blacklist = computed(() => {
    let tokenIds = [] as string[];
    if (isEmpty(privateState.blacklist)) return tokenIds;

    for (const listName of app.settings.blacklistedTokensLists) {
      const list = privateState.blacklist[listName as keyof ErgoTokenBlacklist];
      if (Array.isArray(list) && list.length > 0) tokenIds = tokenIds.concat(list);
    }

    return tokenIds;
  });

  const prices = computed(() => privateState.prices.prices);

  async function loadMetadata(tokenIds: string[], options?: Partial<LoadMetadataOptions>) {
    const { fetchInBackground, persist } = ensureDefaults(options, {
      fetchInBackground: false,
      persist: true
    });

    const unloaded = uniq(tokenIds).filter((x) => !metadata.has(x));
    if (unloaded.length === 0) return;

    const dbMeta = await assetInfoDbService.getAnyOf(unloaded);
    patchMetadata(dbMeta);

    // fetch data for non-persisted metadata
    if (unloaded.length > dbMeta.length) {
      const missing = unloaded.filter((id) => !dbMeta.some((x) => x.id === id));

      if (fetchInBackground) {
        loadRemoteMetadata(missing, persist);
      } else {
        await loadRemoteMetadata(missing, persist);
      }
    }
  }

  async function loadRemoteMetadata(missing: string[], persist: boolean) {
    const newMeta = await graphQLService.getAssetsMetadata(missing);
    if (!newMeta) return;

    if (missing.length > newMeta.length) {
      // fill in missing metadata with unknown metadata
      newMeta.push(
        ...missing.filter((id) => !newMeta.some((x) => x.id === id)).map(unknownMetadata)
      );
    }

    if (newMeta.length > 0) {
      patchMetadata(newMeta);
      if (persist) await assetInfoDbService.bulkPut(newMeta);
    }
  }

  function patchMetadata(patch: IAssetInfo[]) {
    if (patch.length === 0) return;
    for (const info of patch) {
      metadata.set(info.id, {
        name: info.name,
        decimals: info.decimals,
        type: info.subtype,
        artworkUrl: info.artworkCover ?? info.artworkUrl
      });
    }
  }

  return { blacklist, metadata, prices, loadMetadata };
});

function unknownMetadata(id: string): IAssetInfo {
  return { id, mintingBoxId: "", type: AssetType.Unknown };
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetsStore, import.meta.hot));
}
