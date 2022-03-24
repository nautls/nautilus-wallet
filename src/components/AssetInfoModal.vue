<template>
  <o-modal
    v-model:active="active"
    :auto-focus="true"
    :can-cancel="true"
    @onClose="emitOnClose()"
    scroll="clip"
    content-class="max-h-10/12 bg-transparent !w-11/12"
    overlay-class="opacity-40"
  >
    <div
      class="p-4 pt-14 mt-10 text-xs flex flex-col gap-4 tracking-normal rounded overflow-x-hidden bg-light-50"
    >
      <asset-icon
        class="mx-auto w-20 left-0 right-0 absolute top-0"
        :token-id="asset?.id"
        :type="asset?.subtype"
      />
      <div>
        <h1 class="font-bold text-lg">
          {{ asset?.name ?? $filters.compactString(asset?.id, 20) }}
        </h1>
        <p v-if="asset?.description">{{ asset?.description }}</p>
      </div>
      <div class="flex flex-row gap-4">
        <div class="w-1/2">
          <small class="uppercase text-gray-500">Emission Amount</small>
          <p class="text-sm">{{ asset?.emissionAmount }}</p>
        </div>
        <div class="w-1/2">
          <small class="uppercase text-gray-500">Decimals</small>
          <p class="text-sm">{{ asset?.decimals ?? 0 }}</p>
        </div>
      </div>
      <div class="flex flex-row gap-4">
        <div class="w-1/2">
          <small class="uppercase text-gray-500">Id</small>
          <p class="text-sm">
            {{ $filters.compactString(asset?.id, 12) }}
            <click-to-copy class="pl-1" :value="asset?.id" size="12" />
          </p>
        </div>
        <div class="w-1/2">
          <small class="uppercase text-gray-500">Minting Transaction</small>
          <p class="text-sm">
            {{ $filters.compactString(asset?.mintingTransactionId, 12) }}
            <click-to-copy class="pl-1" :value="asset?.id" size="12" />
          </p>
        </div>
      </div>
      <div></div>
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { IAssetInfo } from "@/types/database";
import { assetInfoDbService } from "@/api/database/assetInfoDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { isEmpty } from "lodash";

export default defineComponent({
  name: "AssetInfoModal",
  props: {
    tokenId: { type: String, required: true }
  },
  data() {
    return {
      active: false,
      internalTokenId: "",
      tet: "",
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
