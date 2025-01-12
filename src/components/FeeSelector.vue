<script setup lang="ts">
import { computed, onMounted, PropType, reactive, watch } from "vue";
import { extractTokenIdFromBabelContract, isValidBabelBox } from "@fleet-sdk/babel-fees-plugin";
import { areEqualBy, isEmpty } from "@fleet-sdk/common";
import { useVuelidate } from "@vuelidate/core";
import { helpers } from "@vuelidate/validators";
import { BigNumber } from "bignumber.js";
import { groupBy, maxBy, sortBy } from "lodash-es";
import { ChevronsUpDown, InfoIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useWalletStore } from "@/stores/walletStore";
import { PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchBabelBoxes, getNanoErgsPerTokenRate } from "@/chains/ergo/babelFees";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { AssetInfo, FeeSettings } from "@/types/internal";
import { bigNumberMinValue } from "@/validators";
import AssetIcon from "./AssetIcon.vue";
import AssetSelector from "./AssetSelector.vue";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

interface FeeAsset extends AssetInfo {
  nanoErgsPerToken: BigNumber;
}

const format = useFormat();
const appStore = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();

const bigMinErgFee = bn(SAFE_MIN_FEE_VALUE);
const bigMinBoxValue = bn(MIN_BOX_VALUE);

const props = defineProps({
  selected: { type: Object as PropType<FeeSettings>, required: true },
  includeMinAmountPerBox: { type: Number, default: 0 }
});

const emit = defineEmits<{ (event: "update:selected", feeState: FeeSettings): void }>();

const state = reactive({
  multiplier: [1],
  assets: [] as FeeAsset[],
  internalSelected: { tokenId: ERG_TOKEN_ID, nanoErgsPerToken: bn(0) } as FeeAsset,
  cachedMinRequired: bn(0)
});

const multiplier = computed<number>({
  get: () => state.multiplier[0],
  set: (newVal) => {
    state.multiplier = [newVal];
  }
});

const conversionCurrency = computed(() => {
  return state.internalSelected.tokenId === ERG_TOKEN_ID
    ? appStore.settings.conversionCurrency
    : "ERG";
});

const ergPrice = computed(() => {
  return assetsStore.prices.get(ERG_TOKEN_ID)?.fiat || 0;
});

const minTokenFee = computed(() => {
  return getTokenUnitsFor(bigMinErgFee);
});

const nanoErgsFee = computed(() => {
  return bigMinErgFee.times(multiplier.value);
});

const tokenUnitsFee = computed(() => {
  return minTokenFee.value.times(multiplier.value);
});

const feeAmount = computed(() => {
  const value =
    state.internalSelected.tokenId === ERG_TOKEN_ID ? nanoErgsFee.value : tokenUnitsFee.value;
  return decimalize(value, state.internalSelected.metadata?.decimals || 0);
});

const price = computed(() => {
  if (state.internalSelected.tokenId === ERG_TOKEN_ID) {
    return decimalize(nanoErgsFee.value, ERG_DECIMALS).times(ergPrice.value);
  }

  return decimalize(
    state.internalSelected.nanoErgsPerToken.times(tokenUnitsFee.value),
    ERG_DECIMALS
  );
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
    if (newVal.tokenId === oldVal.tokenId) return;

    if (multiplier.value != 1) multiplier.value = 1;
    recalculateMinRequired();
    emitSelectedUpdate();
  }
);

watch(() => feeAmount.value, emitSelectedUpdate);

watch(() => props.includeMinAmountPerBox, recalculateMinRequired);

watch(
  () => ({ walletId: wallet.id, assets: wallet.nonArtworkBalance }),
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
    nanoErgsPerToken: bn(1),
    metadata: assetsStore.metadata.get(ERG_TOKEN_ID)
  };

  multiplier.value = 1;
  state.assets = [erg];
  state.internalSelected = { tokenId: ERG_TOKEN_ID, nanoErgsPerToken: bn(0) };
  state.cachedMinRequired = bn(0);
  select(erg);

  const tokenIds = wallet.nonArtworkBalance
    .filter((x) => x.tokenId !== ERG_TOKEN_ID)
    .map((x) => x.tokenId);
  if (isEmpty(tokenIds)) return;

  const allBoxes = await fetchBabelBoxes(tokenIds);
  const groups = groupBy(allBoxes.filter(isValidBabelBox), (box) =>
    extractTokenIdFromBabelContract(box.ergoTree)
  );

  const assets = Object.keys(groups)
    .map((tokenId): FeeAsset => {
      const price = maxBy(
        groups[tokenId].map((box) => getNanoErgsPerTokenRate(box)),
        (p) => p.toNumber()
      );

      return {
        tokenId,
        metadata: assetsStore.metadata.get(tokenId),
        nanoErgsPerToken: price || bn(0)
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
    return bn(0);
  }

  return nanoErgs.div(state.internalSelected.nanoErgsPerToken).integerValue(BigNumber.ROUND_UP);
}

function recalculateMinRequired() {
  if (state.internalSelected.tokenId === ERG_TOKEN_ID) {
    state.cachedMinRequired = decimalize(bigMinErgFee, ERG_DECIMALS);
    if (!v$.value.$dirty) multiplier.value = 1;
  } else {
    state.cachedMinRequired = decimalize(
      getTokenUnitsFor(bigMinErgFee.plus(bigMinBoxValue.times(props.includeMinAmountPerBox))),
      state.internalSelected.metadata?.decimals || 0
    );

    if (state.cachedMinRequired.isGreaterThan(feeAmount.value)) {
      const m = state.cachedMinRequired.dividedBy(feeAmount.value).integerValue(BigNumber.ROUND_UP);
      multiplier.value = m.isGreaterThan(10) ? 10 : m.toNumber();
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
    assetInfo: state.internalSelected.metadata
  });
}
</script>

<template>
  <div class="flex flex-col gap-2 text-sm">
    <div
      class="flex flex-col w-full gap-1 rounded-md relative border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div class="flex flex-grow gap-2">
        <div class="flex flex-row items-start gap-2 flex-grow">
          <div class="flex flex-row h-full items-center gap-1">
            <div class="font-bold">Fee</div>
            <div>{{ feeAmount.toString() }}</div>

            <TooltipProvider :delay-duration="100">
              <Tooltip>
                <TooltipTrigger as-child>
                  <InfoIcon class="size-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent class="text-center">
                  <div v-if="ergPrice">
                    {{ price.toString() }} {{ format.string.uppercase(conversionCurrency) }}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div>
          <AssetSelector v-model="state.internalSelected" :assets="state.assets" selectable>
            <PopoverTrigger>
              <Button variant="secondary">
                <asset-icon
                  class="size-4"
                  :token-id="state.internalSelected.tokenId"
                  :type="state.internalSelected.metadata?.type"
                />
                {{ format.asset.name(state.internalSelected) }}
                <ChevronsUpDown class="size-4 opacity-50 float-end" />
              </Button>
            </PopoverTrigger>
          </AssetSelector>
        </div>
      </div>
      <div class="pb-2 pt-3">
        <Slider v-model="state.multiplier" :max="10" :step="1" :min="1" />
      </div>
    </div>

    <div v-if="v$.$error" class="px-2 text-destructive text-xs">
      {{ v$.$errors[0].$message }}
    </div>
  </div>
</template>
