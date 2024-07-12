import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, shallowReactive } from "vue";
import { isEmpty, some, uniq } from "@fleet-sdk/common";
import { difference } from "lodash-es";
import { assetInfoDbService } from "../database/assetInfoDbService";
import { graphQLService } from "../chains/ergo/services/graphQlService";
import { BasicAssetMetadata } from "@/types/internal";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";

const ERG_METADATA: BasicAssetMetadata = { name: "ERG", decimals: ERG_DECIMALS };

const usePrivateState = defineStore("_assets", () => {
  const metadata = shallowReactive(new Map([[ERG_TOKEN_ID, ERG_METADATA]]));
  const blacklist = shallowReactive({ lastUpdated: Date.now(), tokenIds: [] as string[] });

  return { metadata, blacklist };
});

export const useAssetsStore = defineStore("assets", () => {
  const privateState = usePrivateState();
  const metadata = computed(() => privateState.metadata);
  const blacklist = computed(() => privateState.blacklist);

  async function loadMetadataFor(tokenIds: string[]) {
    const unloaded = difference(uniq(tokenIds), Array.from(privateState.metadata.keys()));
    if (isEmpty(unloaded)) return;

    const metadata = await assetInfoDbService.getAnyOf(unloaded);
    if (unloaded.length > metadata.length) {
      const missing = difference(
        unloaded,
        metadata.map((x) => x.id)
      );

      const newMetadata = await graphQLService.getAssetsInfo(missing);
      if (some(newMetadata)) {
        await assetInfoDbService.bulkPut(newMetadata);
        metadata.push(...newMetadata);
      }
    }

    for (const info of metadata) {
      privateState.metadata.set(info.id, {
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
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
