<template>
  <o-modal
    v-model:active="active"
    :auto-focus="true"
    :can-cancel="true"
    scroll="clip"
    content-class="max-h-90vh bg-transparent overflow-hidden !max-w-110 !w-90vw"
    overlay-class="opacity-40"
  >
    <div class="h-10" v-if="!isImageNft" @click="active = false"></div>
    <div class="text-xs tracking-normal rounded bg-light-50" :class="{ 'pt-10': !isImageNft }">
      <iframe
        v-if="isImageNft"
        sandbox=""
        class="h-80 w-full rounded-t m-0 p-0"
        :src="contentUrl"
        frameborder="0"
      ></iframe>
      <asset-icon
        v-else
        class="w-20 h-20 mx-auto absolute left-0 right-0 top-0"
        :token-id="asset?.id"
        :type="asset?.subtype"
      />
      <div
        class="p-4 gap-4 flex flex-col overflow-x-hidden overflow-y-auto"
        :class="isImageNft ? 'max-h-50' : 'max-h-100'"
      >
        <div>
          <h1 class="font-bold text-lg">
            {{ asset?.name ?? $filters.compactString(asset?.id, 20) }}
          </h1>
          <p v-if="asset?.description">{{ asset?.description }}</p>
        </div>
        <div class="flex flex-row gap-4 mt-4">
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Emission Amount</small>
            <p class="text-sm font-bold">{{ emissionAmount }}</p>
          </div>
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Decimal Places</small>
            <p class="text-sm font-bold">{{ asset?.decimals ?? 0 }}</p>
          </div>
        </div>
        <div class="flex flex-row gap-4">
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Token Id</small>
            <p class="text-sm font-bold">
              {{ $filters.compactString(asset?.id, 12) }}
              <click-to-copy class="pl-1" :content="asset?.id" size="12" />
            </p>
          </div>
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Minting Transaction</small>
            <p class="text-sm font-bold">
              {{ $filters.compactString(asset?.mintingTransactionId, 12) }}
              <click-to-copy class="pl-1" :content="asset?.mintingTransactionId" size="12" />
            </p>
          </div>
        </div>
      </div>
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { IAssetInfo } from "@/types/database";
import { assetInfoDbService } from "@/api/database/assetInfoDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { isEmpty } from "lodash";
import { decimalize, toBigNumber } from "@/utils/bigNumbers";
import { AssetSubtype } from "@/types/internal";

const CONTENT_SANDBOX_URL = "https://localhost:7059";
function resolveIpfs(url?: string, isVideo = false): string {
  if (!url) {
    return "";
  }

  const ipfsPrefix = "ipfs://";
  if (!url.startsWith(ipfsPrefix)) {
    return url;
  } else {
    if (isVideo) {
      return url.replace(ipfsPrefix, "https://ipfs.blockfrost.dev/ipfs/");
    }
    return url.replace(ipfsPrefix, "https://cloudflare-ipfs.com/ipfs/");
  }
}

export default defineComponent({
  name: "AssetInfoModal",
  props: {
    tokenId: { type: String, required: true }
  },
  computed: {
    emissionAmount(): string {
      if (!this.asset?.emissionAmount) {
        return "";
      }

      let n = toBigNumber(this.asset.emissionAmount);
      if (this.asset.decimals) {
        n = decimalize(n, this.asset.decimals);
      }

      return this.$filters.formatBigNumber(n, undefined, Number.MAX_SAFE_INTEGER);
    },
    isImageNft(): boolean {
      return this.asset?.subtype === AssetSubtype.PictureArtwork;
    },
    contentUrl(): string | undefined {
      if (!this.asset?.artworkUrl && !this.asset?.artworkCover) {
        return;
      }

      const url = this.asset.artworkUrl ?? this.asset.artworkCover;
      return `${CONTENT_SANDBOX_URL}/?url=${resolveIpfs(url)}`;
    }
  },
  data() {
    return {
      active: false,
      internalTokenId: "",
      asset: Object.freeze({} as IAssetInfo | undefined)
    };
  },
  watch: {
    tokenId(newVal: string) {
      if (isEmpty(newVal) || newVal === ERG_TOKEN_ID) {
        return;
      }

      this.getAssetInfo();
      this.active = true;
    },
    active(newVal: boolean) {
      if (newVal) {
        return;
      }

      this.emitOnClose();
    }
  },
  methods: {
    async getAssetInfo() {
      this.asset = Object.freeze(await assetInfoDbService.get(this.tokenId));
    },
    emitOnClose(): void {
      this.$emit("close");
    }
  }
});
</script>
