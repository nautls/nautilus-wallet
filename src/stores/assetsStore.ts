import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, shallowReactive } from "vue";
import { isEmpty, some, uniq } from "@fleet-sdk/common";
import { difference } from "lodash-es";
import { useStorage } from "@vueuse/core";
import { assetInfoDbService } from "../database/assetInfoDbService";
import { graphQLService } from "../chains/ergo/services/graphQlService";
import { useAppStore } from "./appStore";
import { BasicAssetMetadata } from "@/types/internal";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import {
  ErgoTokenBlacklist,
  ergoTokenBlacklistService
} from "@/chains/ergo/services/tokenBlacklistService";

const _ = undefined;
const UPDATE_BLACKLIST_INTERVAL = 10 * 60 * 1000;
const BLACKLIST_DB_KEY = "ergoTokensBlacklist";
const ERG_METADATA: BasicAssetMetadata = { name: "ERG", decimals: ERG_DECIMALS };
const BLACKLIST_DEFAULTS: Required<ErgoTokenBlacklist> = {
  lastUpdated: Date.now(),
  nsfw: [],
  scam: []
};

const hasElapsed = (interval: number, lastUpdated: number) => Date.now() - lastUpdated >= interval;

const usePrivateState = () => {
  const blacklist = useStorage(BLACKLIST_DB_KEY, BLACKLIST_DEFAULTS, _, {
    shallow: true,
    mergeDefaults: true
  });

  return { blacklist };
};

export const useAssetsStore = defineStore("assets", () => {
  const app = useAppStore();
  const privateState = usePrivateState();

  const metadata = shallowReactive(new Map([[ERG_TOKEN_ID, ERG_METADATA]]));

  onMounted(fetchBlacklists);

  const blacklist = computed(() => {
    let tokenIds = [] as string[];
    for (const listName of app.settings.blacklistedTokensLists) {
      const list = privateState.blacklist.value[listName as keyof ErgoTokenBlacklist];
      if (Array.isArray(list) && list.length > 0) tokenIds = tokenIds.concat(list);
    }

    return tokenIds;
  });

  async function fetchBlacklists() {
    const lastUpdated = privateState.blacklist.value.lastUpdated ?? Date.now();
    if (!hasElapsed(UPDATE_BLACKLIST_INTERVAL, lastUpdated)) return;
    const ergoBlacklists = await ergoTokenBlacklistService.fetch();

    privateState.blacklist.value = { ...ergoBlacklists, lastUpdated: Date.now() };
  }

  async function loadMetadataFor(tokenIds: string[]) {
    const unloaded = difference(uniq(tokenIds), Array.from(metadata.keys()));
    if (isEmpty(unloaded)) return;

    const patch = await assetInfoDbService.getAnyOf(unloaded);
    if (unloaded.length > patch.length) {
      const missing = difference(
        unloaded,
        patch.map((x) => x.id)
      );

      const newMetadata = await graphQLService.getAssetsInfo(missing);
      if (some(newMetadata)) {
        await assetInfoDbService.bulkPut(newMetadata);
        patch.push(...newMetadata);
      }
    }

    for (const info of patch) {
      metadata.set(info.id, {
        name: info.name,
        decimals: info.decimals,
        type: info.subtype,
        artworkUrl: info.artworkCover ?? info.artworkUrl
      });
    }
  }

  return { blacklist, metadata, loadMetadataFor };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetsStore, import.meta.hot));
}
