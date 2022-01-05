<template>
  <div class="flex flex-col gap-5">
    <label>
      Receiver
      <input type="text" :disabled="loading" v-model="filter" class="w-full control block" />
    </label>
    <label>
      Asset
      <div class="asset-input flex flex-row">
        <div class="flex-grow">
          <input class="w-full outline-none p-1.5" placeholder="Amount" />
        </div>
        <tool-tip label="28374">
          <a class="flex-shrink cursor-pointer underline-transparent text-xs p-2 text-gray-400"
            >Max</a
          >
        </tool-tip>

        <div class="w-4/12 text-right">
          <drop-down>
            <template v-slot:trigger>ERG <vue-feather type="chevron-down" size="16" /></template>
            <template v-slot:items>
              <div class="group">
                <a class="group-item narrow">te</a>
                <a class="group-item narrow">te</a>
                <a class="group-item narrow">te</a>
                <a class="group-item narrow">te</a>
              </div>
            </template>
          </drop-down>
        </div>
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
