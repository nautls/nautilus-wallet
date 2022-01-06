<template>
  <label @mouseover="troggleHover(true)" @mouseout="troggleHover(false)">
    <span v-if="label && label !== ''">{{ label }}</span>
    <div class="asset-input flex flex-row gap-2 relative">
      <span
        v-if="disposable"
        :class="{ 'opacity-100': hovered }"
        class="inline-flex opacity-0 hover:opacity-100 cursor-pointer border-1 border-gray-400 bg-gray-200 w-5.5 h-5.5 -top-4.5 -right-0.5 absolute rounded-full ring-2 ring-white transform translate-x-1/3 translate-y-1/3"
      >
        <vue-feather type="trash" class="p-1" size="12" />
      </span>
      <div class="flex flex-col gap-2 flex-grow">
        <div class="flex flex-row gap-2 text-base">
          <div class="w-7/12">
            <input v-model="value" class="w-full outline-none" placeholder="Amount" />
          </div>
          <div class="w-5/12">
            <div class="flex flex-row text-right items-center gap-1">
              <span class="flex-grow" v-if="asset.name">{{
                $filters.compactString(asset.name, 10, "end")
              }}</span>
              <span class="flex-grow" v-else>{{ $filters.compactString(asset.tokenId, 10) }}</span>
              <img
                class="h-5 object-scale-down w-5 inline-block flex-shrink"
                :src="logoFor(asset.tokenId)"
              />
            </div>
          </div>
        </div>
        <div class="flex flex-row gap-2">
          <div class="flex-grow">
            <span class="text-xs text-gray-400" v-if="asset.price">≈ {{ price }} USD</span>
          </div>
          <div class="flex-grow text-right">
            <a
              @click="value = asset.confirmedAmount.toString()"
              class="text-xs cursor-pointer underline-transparent text-gray-400"
              >Balance: {{ $filters.formatBigNumber(asset.confirmedAmount) }}</a
            >
          </div>
        </div>
      </div>
      <!-- <div class="flex-shrink align-middle">
        <img :src="logoFor(asset.tokenId)" class="h-5 object-scale-down w-10" />
      </div> -->
    </div>
  </label>
</template>

<script lang="ts">
import { assetLogoMapper } from "@/mappers/assetLogoMapper";
import BigNumber from "bignumber.js";
import { defineComponent } from "vue";

export default defineComponent({
  name: "AssetInput",
  data() {
    return {
      value: 0,
      hovered: false
    };
  },
  computed: {
    price() {
      if (!this.value) {
        return "0.00";
      }
      return new BigNumber(this.value).multipliedBy(this.asset.price).toFormat(2);
    }
  },
  methods: {
    troggleHover(val: boolean) {
      if (val === this.hovered) {
        return;
      }

      this.hovered = val;
    },
    logoFor(tokenId: string): string {
      const assetLogo = assetLogoMapper[tokenId];
      return `/icons/assets/${assetLogo ?? "default.svg"}`;
    }
  },
  props: {
    label: { type: String, required: false },
    disposable: { type: Boolean, defaul: false },
    asset: { type: Object, required: true }
  }
});
</script>
