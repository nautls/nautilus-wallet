<template>
  <div class="flex flex-col gap-5">
    <label>
      Receiver
      <input
        type="text"
        spellcheck="false"
        :disabled="loading"
        v-model="filter"
        class="w-full control block"
      />
    </label>
    <div class="flex-grow">
      <div class="flex flex-col gap-2">
        <asset-input
          :label="index === 0 ? 'Assets' : ''"
          v-for="(asset, index) in assets"
          :key="index"
          :asset="asset"
          :disposable="!isErg(asset.tokenId)"
        />
        <p class="text-xs text-right">Fee: 0.0011 ERG</p>
      </div>
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

    <div class="flex-shrink"><button class="btn w-full">Confirm</button></div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { assetLogoMapper } from "@/mappers/assetLogoMapper";
import { GETTERS } from "@/constants/store/getters";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { StateAsset } from "@/types/internal";
import AssetInput from "@/components/AssetInput.vue";

export default defineComponent({
  name: "SendView",
  components: { AssetInput },
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
    }
  }
});
</script>
