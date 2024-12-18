<template>
  <div class="flex flex-col gap-4 py-4">
    <div>
      <input v-model="filter" type="text" placeholder="Search" class="control block w-full" />
    </div>
    <div class="flex flex-wrap justify-between gap-4">
      <div
        v-for="nft in assets"
        :key="nft.tokenId"
        class="w-39 duration-250 cursor-pointer rounded border border-gray-300 transition hover:bg-gray-100 active:bg-gray-200"
        @click="selectedAsset = nft"
      >
        <div class="relative">
          <image-sandbox
            :src="nft.metadata?.artworkUrl"
            class="h-39 w-full rounded-t"
            height="9.6rem"
            object-fit="contain"
            overflow="hidden"
          />
          <!-- clickable overlay -->
          <div class="h-39 absolute left-0 top-0 w-full bg-transparent"></div>
        </div>
        <p class="p-2 text-sm">
          {{ format.string.shorten(nft.metadata?.name ?? nft.tokenId, 30) }}
        </p>
      </div>
    </div>
    <asset-info-modal
      :token-id="selectedAsset?.tokenId"
      :confirmed-balance="selectedAsset?.confirmedAmount"
      @close="selectedAsset = undefined"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import AssetInfoModal from "@/components/AssetInfoModal.vue";
import ImageSandbox from "@/components/ImageSandbox.vue";
import { StateAssetSummary, useWalletStore } from "@/stores/walletStore";
import { useFormat } from "@/composables/useFormat";

export default defineComponent({
  name: "NftGalleryView",
  components: {
    AssetInfoModal,
    ImageSandbox
  },
  setup() {
    return { wallet: useWalletStore(), format: useFormat() };
  },
  data() {
    return {
      filter: "",
      selectedAsset: undefined as StateAssetSummary | undefined
    };
  },
  computed: {
    assets() {
      const assetList = this.wallet.artworkBalance;

      if (this.filter !== "" && assetList.length > 0) {
        return assetList.filter((a) =>
          a.metadata?.name?.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
        );
      }

      return assetList;
    }
  },
  watch: {
    assets() {
      if (this.assets.length === 0) {
        this.$router.push({ name: "assets-page" });
      }
    }
  }
});
</script>
