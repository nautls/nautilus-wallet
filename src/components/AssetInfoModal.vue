<template>
  <o-modal
    v-model:active="active"
    :auto-focus="false"
    :can-cancel="true"
    scroll="clip"
    content-class="max-h-95vh bg-transparent relative overflow-hidden !max-w-100 !w-90vw"
  >
    <button type="button" class="fixed top-0 right-0 m-2 text-light-300" @click="close()">
      <mdi-icon name="close" size="24" />
    </button>

    <div v-if="!isImageNft" class="h-10" @click="close()"></div>
    <div class="text-xs tracking-normal rounded bg-light-50" :class="{ 'pt-10': !isImageNft }">
      <image-sandbox v-if="isImageNft" :src="contentUrl" class="h-83.1 w-full rounded-t" />
      <asset-icon
        v-else
        class="w-20 h-20 mx-auto absolute left-0 right-0 top-0"
        :token-id="asset?.id ?? tokenId"
        :type="asset?.subtype"
      />
      <div
        class="p-4 gap-4 flex flex-col overflow-x-hidden overflow-y-auto"
        :class="isImageNft ? 'max-h-52' : 'max-h-100'"
      >
        <div>
          <h1 class="font-bold text-lg">
            {{ asset?.name ?? format.string.shorten(asset?.id, 20) }}
          </h1>
          <p v-if="description" class="whitespace-pre-wrap">{{ description }}</p>
        </div>
        <div class="flex flex-row gap-4 mt-2">
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Emission Amount</small>
            <p class="text-sm font-bold">{{ emissionAmount }}</p>
          </div>
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Balance</small>
            <p v-if="hideBalances" class="skeleton animate-none h-4.5 w-2/4 block rounded"></p>
            <p v-else class="text-sm font-bold">
              {{ format.bn.format(confirmedBalance) ?? 0 }}
            </p>
          </div>
        </div>
        <div class="flex flex-row gap-4">
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Token Id</small>
            <p class="text-sm font-bold">
              {{ format.string.shorten(asset?.id, 12) }}
              <click-to-copy class="pl-1" :content="tokenId" />
            </p>
          </div>
          <div class="w-1/2">
            <small class="uppercase text-gray-500">Minting Transaction</small>
            <p class="text-sm font-bold">
              {{ format.string.shorten(asset?.mintingTransactionId, 12) }}
              <click-to-copy class="pl-1" :content="asset?.mintingTransactionId" />
            </p>
          </div>
        </div>
      </div>
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { isEmpty } from "@fleet-sdk/common";
import { BigNumber } from "bignumber.js";
import ImageSandbox from "./ImageSandbox.vue";
import { IAssetInfo } from "@/types/database";
import { assetInfoDbService } from "@/database/assetInfoDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { bn, decimalize } from "@/common/bigNumber";
import { AssetSubtype } from "@/types/internal";
import { useAppStore } from "@/stores/appStore";
import { useFormat } from "@/composables/useFormat";

export default defineComponent({
  name: "AssetInfoModal",
  components: {
    ImageSandbox
  },
  props: {
    tokenId: { type: String, required: false },
    confirmedBalance: { type: Object as PropType<BigNumber>, required: false }
  },
  setup() {
    return { app: useAppStore(), format: useFormat() };
  },
  data() {
    return {
      active: false,
      internalTokenId: "",
      asset: Object.freeze({} as IAssetInfo | undefined)
    };
  },
  computed: {
    emissionAmount(): string {
      if (!this.asset?.emissionAmount) {
        return "";
      }

      let amount = bn(this.asset.emissionAmount);
      if (this.asset.decimals) {
        amount = decimalize(amount, this.asset.decimals);
      }

      return this.format.bn.format(amount ?? bn(0), undefined, Number.MAX_SAFE_INTEGER);
    },
    isImageNft(): boolean {
      return this.asset?.subtype === AssetSubtype.PictureArtwork;
    },
    contentUrl(): string | undefined {
      if (!this.asset?.artworkUrl && !this.asset?.artworkCover) {
        return;
      }

      return this.asset.artworkUrl ?? this.asset.artworkCover;
    },
    description(): string | undefined {
      if (!this.asset?.description) {
        return;
      }

      if (
        (this.asset.description.startsWith("{") && this.asset.description.endsWith("}")) ||
        (this.asset.description.startsWith("[") && this.asset.description.endsWith("]"))
      ) {
        try {
          return JSON.stringify(JSON.parse(this.asset.description), null, 2);
        } catch {
          return this.asset.description;
        }
      }

      return this.asset.description;
    },
    hideBalances(): boolean {
      return this.app.settings.hideBalances;
    }
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
      if (!this.tokenId) {
        return;
      }

      this.asset = Object.freeze(await assetInfoDbService.get(this.tokenId));
    },
    emitOnClose(): void {
      this.$emit("close");
    },
    close(): void {
      this.active = false;
    }
  }
});
</script>
