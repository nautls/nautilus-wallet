<template>
  <div class="flex flex-row pt-4 group">
    <drop-down
      trigger-class="px-2 py-1 h-12 text-sm whitespace-nowrap text-left"
      root-class="flex-grow"
    >
      <template v-slot:trigger>
        <span class="flex-grow font-bold pl-1">Fee</span>
        <div class="text-right flex flex-col h-full">
          <span class="flex-grow">{{ fee }}</span>
          <small class="text-gray-400"
            >≈ {{ price }} {{ $filters.uppercase(conversionCurrency) }}</small
          >
        </div>
      </template>

      <template v-slot:items>
        <div class="group">
          <o-slider
            v-model="multiplier"
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
      :disabled="unselected.length === 0"
      list-class="max-h-37"
      trigger-class="px-2 py-1 h-12 min-w-35 whitespace-nowrap text-sm text-left"
    >
      <template v-slot:trigger>
        <asset-icon class="h-5 w-5 min-w-5" :token-id="selected.tokenId" />
        <div class="whitespace-nowrap flex-grow text-gray-600">
          <template v-if="selected.info?.name">{{
            $filters.compactString(selected.info.name, 10)
          }}</template>
          <template v-else>{{ $filters.compactString(selected.tokenId, 10) }}</template>
        </div>
        <vue-feather type="chevron-down" size="18" />
      </template>

      <template v-slot:items>
        <div class="group">
          <a
            @click="select(asset)"
            class="group-item narrow-y !px-2"
            v-for="asset in unselected"
            :key="asset.tokenId"
          >
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
import { addressFromErgoTree } from "@/api/ergo/addresses";
import { explorerService } from "@/api/explorer/explorerService";
import { SAFE_MIN_FEE_VALUE, ERG_TOKEN_ID, ERG_DECIMALS } from "@/constants/ergo";
import { GETTERS } from "@/constants/store/getters";
import { BasicAssetInfo, StateAsset } from "@/types/internal";
import { decimalize } from "@/utils/bigNumbers";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { isEmpty, maxBy, sortBy } from "lodash";
import { defineComponent } from "vue";
const babelFeeTemplate =
  "1008040404000e20[$tokenId]04000400040005000500d804d601e4c6a70408d602b2a599b1a5730000d603db6308a7d60499c1a7c17202eb027201d1ededededed93c27202c2a793e4c672020408720193e4c672020505e4c6a70505938cb2db63087202730100017302929c998cb2db63087202730300029591b1720373048cb27203730500027306e4c6a7050572049272047307";

type FeeAsset = {
  tokenId: string;
  pricePerToken: BigNumber | BigNumber.Instance;
  info?: BasicAssetInfo;
};

export default defineComponent({
  name: "FeeSelector",
  async created() {
    const erg: FeeAsset = {
      tokenId: ERG_TOKEN_ID,
      pricePerToken: new BigNumber(1),
      info: this.$store.state.assetInfo[ERG_TOKEN_ID]
    };
    this.assets = [erg];
    this.select(erg);

    const addresses = this.nonNftAssets
      .filter((x) => x.tokenId !== ERG_TOKEN_ID)
      .map((x) => addressFromErgoTree(babelFeeTemplate.replace("[$tokenId]", x.tokenId)));
    let assets = (await explorerService.getUnspentBoxes(addresses))
      .filter((x) => !isEmpty(x.data))
      .map((x): FeeAsset => {
        const tokenId = x.data[0].ergoTree.slice(16, 16 + 64);

        return {
          tokenId,
          info: this.$store.state.assetInfo[tokenId],
          pricePerToken: maxBy(
            x.data
              .filter((b) => b.additionalRegisters.R5)
              .map(
                (x) =>
                  new BigNumber(
                    wasmModule.SigmaRust.Constant.decode_from_base16(x.additionalRegisters.R5)
                      .to_i64()
                      .to_str()
                  )
              ),
            (p) => p.toNumber()
          )!
        };
      });

    this.assets = this.assets.concat(sortBy(assets, (x) => x.tokenId));
  },
  computed: {
    ergPrice(): number {
      return this.$store.state.ergPrice;
    },
    conversionCurrency(): string {
      return this.$store.state.settings.conversionCurrency;
    },
    minErgFee(): BigNumber {
      return new BigNumber(SAFE_MIN_FEE_VALUE);
    },
    minTokenUnits(): number {
      let minTokenUnits = 1;
      while (this.selected.pricePerToken.multipliedBy(minTokenUnits) <= this.minErgFee) {
        minTokenUnits++;
      }

      return minTokenUnits;
    },
    fee(): BigNumber {
      if (this.selected.tokenId === ERG_TOKEN_ID) {
        return decimalize(
          this.minErgFee.multipliedBy(this.multiplier),
          this.selected.info?.decimals || 0
        );
      }

      // console.log("rate", decimalize(price, ERG_DECIMALS).toString());
      return decimalize(
        new BigNumber(this.minTokenUnits).multipliedBy(this.multiplier),
        this.selected.info?.decimals || 0
      );
    },
    price() {
      if (this.selected.tokenId === ERG_TOKEN_ID) {
        return decimalize(this.minErgFee, ERG_DECIMALS)
          .multipliedBy(this.multiplier)
          .multipliedBy(this.ergPrice);
      }

      return decimalize(this.selected.pricePerToken.multipliedBy(this.minTokenUnits), ERG_DECIMALS)
        .multipliedBy(this.multiplier)
        .multipliedBy(this.ergPrice);
    },
    nonNftAssets(): StateAsset[] {
      return this.$store.getters[GETTERS.NON_NFT_BALANCE];
    },
    unselected() {
      return this.assets.filter((x) => x.tokenId !== this.selected.tokenId);
    }
  },
  data: () => {
    return {
      multiplier: 1,
      assets: [] as FeeAsset[],
      selected: { tokenId: ERG_TOKEN_ID } as FeeAsset
    };
  },
  methods: {
    select(asset: FeeAsset) {
      this.selected = asset;
    }
  }
});
</script>
