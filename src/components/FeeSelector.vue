<template>
  <div class="flex flex-row pt-4 group">
    <drop-down
      trigger-class="px-2 py-1 h-12 text-sm whitespace-nowrap text-left"
      root-class="flex-grow"
    >
      <template v-slot:trigger>
        <span class="flex-grow font-bold pl-1">Fee</span>
        <div
          class="text-right flex flex-col h-full"
          :class="ergPrice ? 'justify-between' : 'justify-center'"
        >
          <div class="items-center">
            <span>{{ fee }}</span>
          </div>
          <small v-if="ergPrice" class="text-gray-400"
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
            thumb-class="rounded-md"
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
        <asset-icon class="h-5 w-5 min-w-5" :token-id="internalSelected.tokenId" />
        <div class="whitespace-nowrap flex-grow text-gray-600">
          <template v-if="internalSelected.info?.name">{{
            $filters.compactString(internalSelected.info.name, 10)
          }}</template>
          <template v-else>{{ $filters.compactString(internalSelected.tokenId, 10) }}</template>
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
import {
  SAFE_MIN_FEE_VALUE,
  ERG_TOKEN_ID,
  ERG_DECIMALS,
  BABEL_FEE_TEMPLATE
} from "@/constants/ergo";
import { GETTERS } from "@/constants/store/getters";
import { BasicAssetInfo, BigNumberType, FeeSettings, StateAsset } from "@/types/internal";
import { decimalize } from "@/utils/bigNumbers";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { isEmpty, maxBy, sortBy } from "lodash";
import { defineComponent, PropType } from "vue";

type FeeAsset = {
  tokenId: string;
  nanoergsPerToken: BigNumberType;
  info?: BasicAssetInfo;
};

export default defineComponent({
  name: "FeeSelector",
  props: {
    selected: { type: Object as PropType<FeeSettings>, required: true }
  },
  emits: ["update:selected"],
  async created() {
    const erg: FeeAsset = {
      tokenId: ERG_TOKEN_ID,
      nanoergsPerToken: new BigNumber(1),
      info: this.$store.state.assetInfo[ERG_TOKEN_ID]
    };
    this.assets = [erg];
    this.select(erg);

    const addresses = this.nonNftAssets
      .filter((x) => x.tokenId !== ERG_TOKEN_ID)
      .map((x) => addressFromErgoTree(BABEL_FEE_TEMPLATE.replace("[$tokenId]", x.tokenId)));
    let assets = (await explorerService.getUnspentBoxes(addresses))
      .filter((x) => !isEmpty(x.data))
      .map((x): FeeAsset => {
        const tokenId = x.data[0].ergoTree.slice(16, 16 + 64);

        return {
          tokenId,
          info: this.$store.state.assetInfo[tokenId],
          nanoergsPerToken: maxBy(
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
      while (this.internalSelected.nanoergsPerToken.multipliedBy(minTokenUnits) <= this.minErgFee) {
        minTokenUnits++;
      }

      return minTokenUnits;
    },
    fee(): BigNumberType {
      if (this.internalSelected.tokenId === ERG_TOKEN_ID) {
        return decimalize(
          this.minErgFee.multipliedBy(this.multiplier),
          this.internalSelected.info?.decimals || 0
        );
      }

      return decimalize(
        new BigNumber(this.minTokenUnits).multipliedBy(this.multiplier),
        this.internalSelected.info?.decimals || 0
      );
    },
    price() {
      if (this.internalSelected.tokenId === ERG_TOKEN_ID) {
        return decimalize(this.minErgFee, ERG_DECIMALS)
          .multipliedBy(this.multiplier)
          .multipliedBy(this.ergPrice);
      }

      return decimalize(
        this.internalSelected.nanoergsPerToken.multipliedBy(this.minTokenUnits),
        ERG_DECIMALS
      )
        .multipliedBy(this.multiplier)
        .multipliedBy(this.ergPrice);
    },
    nonNftAssets(): StateAsset[] {
      return this.$store.getters[GETTERS.NON_NFT_BALANCE];
    },
    unselected() {
      return this.assets.filter((x) => x.tokenId !== this.internalSelected.tokenId);
    }
  },
  watch: {
    selected(newVal: FeeSettings) {
      if (newVal.tokenId == this.internalSelected.tokenId) {
        return;
      }

      const asset = this.assets.find((x) => x.tokenId === newVal.tokenId);
      if (asset) {
        this.internalSelected = asset;
      }
    },
    internalSelected(newVal: FeeAsset, oldVal: FeeAsset) {
      if (newVal.tokenId === oldVal.tokenId) {
        return;
      }

      this.emitSelectedUpdate();
    },
    fee() {
      this.emitSelectedUpdate();
    }
  },
  data: () => {
    return {
      multiplier: 1,
      assets: [] as FeeAsset[],
      internalSelected: { tokenId: ERG_TOKEN_ID } as FeeAsset
    };
  },
  methods: {
    select(asset: FeeAsset) {
      this.internalSelected = asset;
    },
    emitSelectedUpdate() {
      this.$emit("update:selected", {
        tokenId: this.internalSelected.tokenId,
        nanoergsPerToken: this.internalSelected.nanoergsPerToken,
        value: this.fee
      } as FeeSettings);
    }
  }
});
</script>
