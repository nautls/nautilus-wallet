<template>
  <div class="flex flex-col gap-4">
    <div>
      <input v-model="filter" type="text" placeholder="Search" class="w-full control block" />
    </div>
    <div class="flex flex-wrap gap-4 justify-between">
      <div
        v-for="nft in nfts"
        :key="nft.tokenId"
        class="border cursor-pointer border-gray-300 rounded w-39 transition duration-250 hover:bg-gray-100 active:bg-gray-200"
        @click="selectedAsset = nft"
      >
        <div class="relative">
          <image-sandbox
            :src="nft.info?.artworkUrl"
            class="w-full rounded-t h-39"
            height="9.6rem"
            object-fit="contain"
            overflow="hidden"
          />
          <!-- clickable overlay -->
          <div class="h-39 w-full bg-transparent absolute top-0 left-0"></div>
        </div>
        <p class="text-sm p-2">
          {{ $filters.compactString(nft.info?.name ?? nft.tokenId, 30) }}
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
import { mapState } from "vuex";
import { GETTERS } from "@/constants/store/getters";
import { StateAsset } from "@/types/internal";
import AssetInfoModal from "@/components/AssetInfoModal.vue";
import ImageSandbox from "@/components/ImageSandbox.vue";

export default defineComponent({
  name: "NftGalleryView",
  components: {
    AssetInfoModal,
    ImageSandbox
  },
  computed: {
    ...mapState({
      currentWallet: "currentWallet"
    }),
    nfts(): StateAsset[] {
      const assetList = this.$store.getters[GETTERS.PICTURE_NFT_BALANCE];

      if (this.filter !== "" && assetList.length > 0) {
        return assetList.filter((a: StateAsset) =>
          a.info?.name?.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
        );
      }

      return assetList;
    }
  },
  watch: {
    currentWallet() {
      this.$router.push({ name: "assets-page" });
    }
  },
  data() {
    return {
      filter: "",
      selectedAsset: undefined as StateAsset | undefined
    };
  }
});
</script>
