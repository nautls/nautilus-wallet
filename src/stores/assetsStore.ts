import { acceptHMRUpdate, defineStore } from "pinia";
import { shallowReactive } from "vue";
import { isEmpty, some, uniq } from "@fleet-sdk/common";
import { difference } from "lodash-es";
import { assetInfoDbService } from "../database/assetInfoDbService";
import { graphQLService } from "../chains/ergo/services/graphQlService";
import { BasicAssetMetadata } from "@/types/internal";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";

const ERG_METADATA: BasicAssetMetadata = { name: "ERG", decimals: ERG_DECIMALS };

export const useAssetsStore = defineStore("assets", () => {
  const metadata = shallowReactive(new Map([[ERG_TOKEN_ID, ERG_METADATA]]));
  const blacklist = shallowReactive({ lastUpdated: Date.now(), tokenIds: [] as string[] });

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
