<template>
  <div class="flex flex-col gap-5">
    <label>
      Receiver
      <input type="text" :disabled="loading" v-model="filter" class="w-full control block" />
    </label>
    <label>
      Asset
      <div class="asset-input flex flex-row gap-2 relative">
        <span
          class="inline-flex cursor-pointer border-1 border-gray-400 bg-gray-200 w-6 h-6 -top-4 right-0 absolute rounded-full ring-2 ring-white transform translate-x-1/3 translate-y-1/3"
        >
          <vue-feather type="trash-2" class="p-1" size="14" />
        </span>
        <div class="flex flex-col gap-2 flex-grow">
          <div class="flex flex-row gap-2 text-base">
            <div class="w-8/12">
              <input class="w-full outline-none" placeholder="Amount" />
            </div>
            <div class="w-4/12 text-right">
              <span>ERG</span>
            </div>
          </div>
          <div class="flex flex-row gap-2">
            <div class="flex-grow">
              <span class="text-xs text-gray-400">≈ 123.00 USD</span>
            </div>
            <div class="flex-grow text-right">
              <span class="text-xs text-gray-400">Balance: 10 ERG</span>
            </div>
          </div>
        </div>
        <div class="flex-shrink align-middle">
          <img src="@/assets/images/defaultAssetLogo.svg" class="h-full w-11" />
        </div>
        <!-- <drop-down>
            <template v-slot:trigger>ERG <vue-feather type="chevron-down" size="16" /></template>
            <template v-slot:items>
              <div class="group">
                <a class="group-item narrow">Test 1</a>
                <a class="group-item narrow">Test 2</a>
                <a class="group-item narrow">Test 3</a>
              </div>
            </template>
          </drop-down> -->
      </div>
    </label>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { assetLogoMapper } from "@/mappers/assetLogoMapper";
import { GETTERS } from "@/constants/store/getters";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { StateAsset } from "@/types/internal";

export default defineComponent({
  name: "SendView",
  computed: {
    loading(): boolean {
      if (!this.$store.state.loading.balance) {
        return false;
      }

      const assetList: StateAsset[] = this.$store.getters[GETTERS.BALANCE];
      if (assetList.length === 0) {
        return true;
      }

      return false;
    },
    assets(): StateAsset[] {
      const assetList = this.$store.getters[GETTERS.BALANCE];

      if (this.filter !== "" && assetList.length > 0) {
        return assetList.filter((a: StateAsset) =>
          a.name?.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
        );
      }

      return assetList;
    }
  },
  watch: {
    ["assets.length"](newLen, oldLen) {
      const length = oldLen || 1;
      if (length > 1) {
        this.prevCount = length;
      }
    }
  },
  data() {
    return {
      filter: "",
      prevCount: 1
    };
  },
  methods: {
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    },
    logoFor(tokenId: string): string {
      const assetLogo = assetLogoMapper[tokenId];
      return `/icons/assets/${assetLogo ?? "default.svg"}`;
    }
  }
});
</script>
