<template>
  <div class="flex flex-row pt-4 group">
    <drop-down trigger-class="p-2 text-sm whitespace-nowrap text-left" root-class="flex-grow">
      <template v-slot:trigger>
        <span class="flex-grow font-bold pl-1">Fee</span>
        <span>{{ fee }}</span>
      </template>

      <template v-slot:items>
        <div class="group">
          <o-slider
            v-model="feeMultiplier"
            @click.prevent.stop
            :min="1"
            :max="10"
            :tooltip="false"
            fill-class="bg-blue-600 rounded-l"
            root-class="p-4"
            track-class="rounded-r"
            thumb-class="rounded"
          />
        </div>
      </template>
    </drop-down>
    <drop-down
      list-class="max-h-37"
      trigger-class="p-2 min-w-35 whitespace-nowrap text-sm text-left"
    >
      <template v-slot:trigger>
        <asset-icon
          class="h-5 w-5 min-w-5"
          token-id="0000000000000000000000000000000000000000000000000000000000000000"
        />
        <div class="whitespace-nowrap flex-grow">ERG</div>
        <vue-feather type="chevron-down" size="18" />
      </template>

      <template v-slot:items>
        <div class="group">
          <a class="group-item narrow-y !px-2" v-for="asset in unselected" :key="asset.tokenId">
            <div class="flex flex-row items-center gap-2">
              <asset-icon
                class="h-5 w-5 min-w-5"
                :token-id="asset.tokenId"
                :type="asset.info?.type"
              />
              <div class="flex-grow">
                <template v-if="asset.info?.name">{{
                  $filters.compactString(asset.info?.name, 10)
                }}</template>
                <template v-else>{{ $filters.compactString(asset.tokenId, 10) }}</template>
              </div>
            </div>
          </a>
        </div>
      </template>
    </drop-down>
  </div>
</template>

<script lang="ts">
import { ERG_DECIMALS, FEE_VALUE } from "@/constants/ergo";
import { GETTERS } from "@/constants/store/getters";
import { StateAsset } from "@/types/internal";
import { decimalize } from "@/utils/bigNumbers";
import BigNumber from "bignumber.js";
import { defineComponent } from "vue";

export default defineComponent({
  name: "FeeSelector",
  computed: {
    minFee(): BigNumber {
      return decimalize(new BigNumber(FEE_VALUE), ERG_DECIMALS);
    },
    fee(): BigNumber {
      return this.minFee.multipliedBy(this.feeMultiplier);
    },
    unselected(): StateAsset[] {
      return this.$store.getters[GETTERS.NON_NFT_BALANCE] as StateAsset[];
    }
  },
  data: () => {
    return {
      feeMultiplier: 1
    };
  }
});
</script>
