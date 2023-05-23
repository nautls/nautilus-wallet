<script setup lang="ts">
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
import store from "@/store";
import { BasicAssetInfo, BigNumberType, FeeSettings, StateAsset } from "@/types/internal";
import { decimalize } from "@/utils/bigNumbers";
import { bigNumberMinValue } from "@/validators";
import useVuelidate from "@vuelidate/core";
import { helpers } from "@vuelidate/validators";
import BigNumber from "bignumber.js";
import { groupBy, isEmpty, maxBy, sortBy } from "lodash";
import { computed, onMounted, PropType, reactive, watch } from "vue";
import { filters } from "@/utils/globalFilters";
import { areEqualBy } from "@fleet-sdk/common";

type FeeAsset = {
  tokenId: string;
  nanoErgsPerToken: BigNumberType;
  info?: BasicAssetInfo;
};

const bigMinErgFee = new BigNumber(SAFE_MIN_FEE_VALUE);
const bigMinBoxValue = new BigNumber(MIN_BOX_VALUE);

const props = defineProps({
  selected: { type: Object as PropType<FeeSettings>, required: true },
  includeMinAmountPerBox: { type: Number, default: 0 }
});

const emit = defineEmits<{ (event: "update:selected", feeState: FeeSettings): void }>();

const state = reactive({
  multiplier: 1,
  assets: [] as FeeAsset[],
  internalSelected: { tokenId: ERG_TOKEN_ID, nanoErgsPerToken: BigNumber(0) } as FeeAsset,
  cachedMinRequired: new BigNumber(0)
});

const conversionCurrency = computed(() => {
  if (state.internalSelected.tokenId === ERG_TOKEN_ID) {
    return store.state.settings.conversionCurrency;
  } else {
    return "ERG";
  }
});

const ergPrice = computed(() => {
  return store.state.ergPrice;
});

const minTokenFee = computed(() => {
  return getTokenUnitsFor(bigMinErgFee);
});

const nanoErgsFee = computed(() => {
  return bigMinErgFee.multipliedBy(state.multiplier);
});

const tokenUnitsFee = computed(() => {
  return minTokenFee.value.multipliedBy(state.multiplier);
});

const feeAmount = computed(() => {
  if (state.internalSelected.tokenId === ERG_TOKEN_ID) {
    return decimalize(nanoErgsFee.value, state.internalSelected.info?.decimals || 0);
  }

  return decimalize(tokenUnitsFee.value, state.internalSelected.info?.decimals || 0);
});

const price = computed(() => {
  if (state.internalSelected.tokenId === ERG_TOKEN_ID) {
    return decimalize(nanoErgsFee.value, ERG_DECIMALS).multipliedBy(ergPrice.value);
  }

  return decimalize(
    state.internalSelected.nanoErgsPerToken.multipliedBy(tokenUnitsFee.value),
    ERG_DECIMALS
  );
});

const nonNftAssets = computed((): StateAsset[] => {
  return store.getters[GETTERS.NON_NFT_BALANCE];
});

const unselected = computed((): FeeAsset[] => {
  return state.assets.filter((x) => x.tokenId !== state.internalSelected.tokenId);
});

const v$ = useVuelidate(
  computed(() => ({
    feeAmount: {
      minValue: helpers.withMessage(
        ({ $params }) =>
          `You need to pay a minimum fee of ${$params.min} ${props.selected.assetInfo?.name} to send this transaction`,
        bigNumberMinValue(state.cachedMinRequired)
      )
    }
  })),
  { feeAmount }
);

watch(
  () => props.selected,
  (newVal) => {
    if (newVal.tokenId == state.internalSelected.tokenId) {
      return;
    }

    const asset = state.assets.find((x) => x.tokenId === newVal.tokenId);
    if (asset) {
      state.internalSelected = asset;
    }
  }
);

watch(
  () => state.internalSelected,
  (newVal, oldVal) => {
    if (newVal.tokenId === oldVal.tokenId) {
      return;
    }

    if (state.multiplier != 1) {
      state.multiplier = 1;
    }

    recalculateMinRequired();
    emitSelectedUpdate();
  }
);

watch(
  () => feeAmount.value,
  () => {
    emitSelectedUpdate();
  }
);

watch(
  () => props.includeMinAmountPerBox,
  () => {
    recalculateMinRequired();
  }
);

watch(
  () => ({ walletId: store.state.currentWallet.id, assets: nonNftAssets.value }),
  (newVal, oldVal) => {
    if (areEqualBy(newVal.assets, oldVal.assets, (asset) => asset.tokenId)) {
      return;
    }

    loadAssets();
  }
);
onMounted(loadAssets);

async function loadAssets() {
  const erg: FeeAsset = {
    tokenId: ERG_TOKEN_ID,
    nanoErgsPerToken: new BigNumber(1),
    info: store.state.assetInfo[ERG_TOKEN_ID]
  };

  state.multiplier = 1;
  state.assets = [erg];
  state.internalSelected = { tokenId: ERG_TOKEN_ID, nanoErgsPerToken: BigNumber(0) };
  state.cachedMinRequired = new BigNumber(0);
  select(erg);

  const addresses = nonNftAssets.value
    .filter((x) => x.tokenId !== ERG_TOKEN_ID)
    .map((x) => addressFromErgoTree(buildBabelContractFor(x.tokenId)));

  if (isEmpty(addresses)) {
    return;
  }

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
        info: store.state.assetInfo[tokenId],
        nanoErgsPerToken: price || new BigNumber(0)
      };
    })
    .filter((asset) => !asset.nanoErgsPerToken.isZero());

  state.assets = state.assets.concat(
    sortBy(
      assets.filter((x) => x.nanoErgsPerToken),
      (x) => x.nanoErgsPerToken.toNumber()
    )
  );
}

function getTokenUnitsFor(nanoErgs: BigNumber): BigNumber {
  if (
    nanoErgs.isZero() ||
    !state.internalSelected ||
    !state.internalSelected.nanoErgsPerToken ||
    state.internalSelected.nanoErgsPerToken.isZero()
  ) {
    return new BigNumber(0);
  }

  return nanoErgs
    .dividedBy(state.internalSelected.nanoErgsPerToken)
    .integerValue(BigNumber.ROUND_UP);
}

function recalculateMinRequired() {
  if (state.internalSelected.tokenId === ERG_TOKEN_ID) {
    state.cachedMinRequired = decimalize(bigMinErgFee, ERG_DECIMALS);
    if (!v$.value.$dirty) {
      state.multiplier = 1;
    }
  } else {
    state.cachedMinRequired = decimalize(
      getTokenUnitsFor(
        bigMinErgFee.plus(bigMinBoxValue.multipliedBy(props.includeMinAmountPerBox))
      ),
      state.internalSelected.info?.decimals || 0
    );

    if (state.cachedMinRequired.isGreaterThan(feeAmount.value)) {
      const m = state.cachedMinRequired.dividedBy(feeAmount.value).integerValue(BigNumber.ROUND_UP);
      if (m.isGreaterThan(10)) {
        state.multiplier = 10;
      } else {
        state.multiplier = m.toNumber();
      }
    }
  }
}

function select(asset: FeeAsset) {
  state.internalSelected = asset;
}

function emitSelectedUpdate() {
  emit("update:selected", {
    tokenId: state.internalSelected.tokenId,
    nanoErgsPerToken: state.internalSelected.nanoErgsPerToken,
    value: feeAmount.value,
    assetInfo: state.internalSelected.info
  });
}
</script>

<template>
  <div class="flex gap-2 flex-col">
    <div class="flex flex-row pt-4 group">
      <drop-down
        trigger-class="px-2 py-1 h-12 text-sm whitespace-nowrap text-left"
        list-class="max-h-50"
        root-class="flex-grow"
      >
        <template v-slot:trigger>
          <span class="flex-grow font-semibold pl-1">Fee</span>
          <div
            class="text-right flex flex-col h-full"
            :class="ergPrice ? 'justify-between' : 'justify-center'"
          >
            <div class="items-center">
              <span>{{ feeAmount.toString() }}</span>
            </div>
            <small v-if="ergPrice" class="text-gray-400"
              >≈ {{ price.toString() }} {{ filters.uppercase(conversionCurrency) }}</small
            >
          </div>
        </template>

        <template v-slot:items>
          <div class="group">
            <o-slider
              v-model="state.multiplier"
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
            :token-id="state.internalSelected.tokenId"
            :type="state.internalSelected.info?.type"
          />
          <div class="whitespace-nowrap flex-grow text-gray-600">
            <template v-if="state.internalSelected.info?.name">{{
              filters.compactString(state.internalSelected.info.name, 10)
            }}</template>
            <template v-else>{{
              filters.compactString(state.internalSelected.tokenId, 10)
            }}</template>
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
                    filters.compactString(asset.info?.name, 10)
                  }}</template>
                  <template v-else>{{ filters.compactString(asset.tokenId, 10) }}</template>
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
