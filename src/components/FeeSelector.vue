<template>
  <div class="flex gap-2 flex-col">
    <div class="flex flex-row pt-4 group">
      <drop-down
        trigger-class="px-2 py-1 h-12 text-sm whitespace-nowrap text-left"
        list-class="max-h-50"
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
              @change="v$.$touch()"
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
          <asset-icon
            class="h-5 w-5 min-w-5"
            :token-id="internalSelected.tokenId"
            :type="internalSelected.info?.type"
          />
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
    <p class="input-error" v-if="v$.$error">
      {{ v$.$errors[0].$message }}
    </p>
  </div>
</template>

<script lang="ts">
import { addressFromErgoTree } from "@/api/ergo/addresses";
import {
  buildBabelContractFor,
  extractTokenIdFromBabelContract,
  getNanoErgsPerTokenRate,
  isValidBabelBox
} from "@/api/ergo/babelFees";
import { graphQLService } from "@/api/explorer/graphQlService";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { GETTERS } from "@/constants/store/getters";
import { BasicAssetInfo, BigNumberType, FeeSettings, StateAsset } from "@/types/internal";
import { decimalize, undecimalize } from "@/utils/bigNumbers";
import { bigNumberMinValue } from "@/validators";
import useVuelidate from "@vuelidate/core";
import { helpers } from "@vuelidate/validators";
import BigNumber from "bignumber.js";
import { groupBy, maxBy, sortBy } from "lodash";
import { defineComponent, PropType } from "vue";

type FeeAsset = {
  tokenId: string;
  nanoErgsPerToken: BigNumberType;
  info?: BasicAssetInfo;
};

const bigMinErgFee = new BigNumber(SAFE_MIN_FEE_VALUE);
const bigMinBoxValue = new BigNumber(MIN_BOX_VALUE);

export default defineComponent({
  name: "FeeSelector",
  props: {
    selected: { type: Object as PropType<FeeSettings>, required: true },
    includeMinAmountPerBox: { type: Number, default: 0 }
  },
  emits: ["update:selected"],
  setup() {
    return { v$: useVuelidate() };
  },
  async created() {
    const erg: FeeAsset = {
      tokenId: ERG_TOKEN_ID,
      nanoErgsPerToken: new BigNumber(1),
      info: this.$store.state.assetInfo[ERG_TOKEN_ID]
    };
    this.assets = [erg];
    this.select(erg);

    const addresses = this.nonNftAssets
      .filter((x) => x.tokenId !== ERG_TOKEN_ID)
      .map((x) => addressFromErgoTree(buildBabelContractFor(x.tokenId)));

    const allBoxes = await graphQLService.getUnspentBoxes(addresses);
    const groups = groupBy(
      allBoxes.filter((box) => isValidBabelBox(box)),
      (box) => extractTokenIdFromBabelContract(box.ergoTree)
    );

    const assets = Object.keys(groups)
      .map((tokenId) => {
        const price = maxBy(
          groups[tokenId].map((box) => getNanoErgsPerTokenRate(box)),
          (p) => p.toNumber()
        );

        return {
          tokenId,
          info: this.$store.state.assetInfo[tokenId],
          nanoErgsPerToken: price || new BigNumber(0)
        };
      })
      .filter((asset) => !asset.nanoErgsPerToken.isZero());

    this.assets = this.assets.concat(
      sortBy(
        assets.filter((x) => x.nanoErgsPerToken),
        (x) => x.nanoErgsPerToken.toNumber()
      )
    );
  },
  computed: {
    ergPrice(): number {
      return this.$store.state.ergPrice;
    },
    conversionCurrency(): string {
      if (this.internalSelected.tokenId === ERG_TOKEN_ID) {
        return this.$store.state.settings.conversionCurrency;
      } else {
        return "ERG";
      }
    },
    minTokenFee(): BigNumberType {
      return this.getTokenUnitsFor(bigMinErgFee);
    },
    nanoErgsFee(): BigNumber {
      return bigMinErgFee.multipliedBy(this.multiplier);
    },
    tokenUnitsFee(): BigNumber {
      return this.minTokenFee.multipliedBy(this.multiplier);
    },
    fee(): BigNumberType {
      if (this.internalSelected.tokenId === ERG_TOKEN_ID) {
        return decimalize(this.nanoErgsFee, this.internalSelected.info?.decimals || 0);
      }

      return decimalize(this.tokenUnitsFee, this.internalSelected.info?.decimals || 0);
    },
    price() {
      if (this.internalSelected.tokenId === ERG_TOKEN_ID) {
        return decimalize(this.nanoErgsFee, ERG_DECIMALS).multipliedBy(this.ergPrice);
      }

      return decimalize(
        this.internalSelected.nanoErgsPerToken.multipliedBy(this.tokenUnitsFee),
        ERG_DECIMALS
      );
    },
    nonNftAssets(): StateAsset[] {
      return this.$store.getters[GETTERS.NON_NFT_BALANCE];
    },
    unselected(): FeeAsset[] {
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

      this.v$.$reset();
      this.recalculateMinRequired();

      this.emitSelectedUpdate();
    },
    fee() {
      this.emitSelectedUpdate();
    },
    includeMinAmountPerBox() {
      this.recalculateMinRequired();
    }
  },
  data: () => {
    return {
      multiplier: 1,
      assets: [] as FeeAsset[],
      internalSelected: { tokenId: ERG_TOKEN_ID, nanoErgsPerToken: new BigNumber(0) } as FeeAsset,
      cachedMinRequired: new BigNumber(0)
    };
  },
  validations() {
    return {
      fee: {
        minValue: helpers.withMessage(
          ({ $params }) =>
            `You need to pay a minimum fee of ${$params.min} ${this.selected.assetInfo?.name} to send this transaction`,
          bigNumberMinValue(this.cachedMinRequired)
        )
      }
    };
  },
  methods: {
    getTokenUnitsFor(nanoErgs: BigNumber): BigNumber {
      if (
        nanoErgs.isZero() ||
        !this.internalSelected ||
        !this.internalSelected.nanoErgsPerToken ||
        this.internalSelected.nanoErgsPerToken.isZero()
      ) {
        return new BigNumber(0);
      }

      return nanoErgs
        .dividedBy(this.internalSelected.nanoErgsPerToken)
        .integerValue(BigNumber.ROUND_UP);
    },
    recalculateMinRequired() {
      if (this.internalSelected.tokenId === ERG_TOKEN_ID) {
        this.cachedMinRequired = decimalize(bigMinErgFee, ERG_DECIMALS);

        if (!this.v$.$dirty) {
          this.multiplier = 1;
        }
      } else {
        this.cachedMinRequired = decimalize(
          this.getTokenUnitsFor(
            bigMinErgFee.plus(bigMinBoxValue.multipliedBy(this.includeMinAmountPerBox))
          ),
          this.internalSelected.info?.decimals || 0
        );

        if (!this.v$.$dirty && this.cachedMinRequired.isGreaterThan(this.fee)) {
          const m = this.cachedMinRequired.dividedBy(this.fee).integerValue(BigNumber.ROUND_UP);
          if (m.isGreaterThan(10)) {
            this.multiplier = 10;
          } else {
            this.multiplier = m.toNumber();
          }
        }
      }
    },
    getNanoErgsFor(number: BigNumberType) {
      return undecimalize(number, this.internalSelected.info?.decimals).multipliedBy(
        this.internalSelected.nanoErgsPerToken
      );
    },
    select(asset: FeeAsset) {
      this.internalSelected = asset;
    },
    emitSelectedUpdate() {
      this.$emit("update:selected", {
        tokenId: this.internalSelected.tokenId,
        nanoergsPerToken: this.internalSelected.nanoErgsPerToken,
        value: this.fee,
        assetInfo: this.internalSelected.info
      } as FeeSettings);
    }
  }
});
</script>
