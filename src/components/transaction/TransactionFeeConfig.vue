<script setup lang="ts">
import { computed, HTMLAttributes, onMounted, ref, shallowRef, watch } from "vue";
import { extractTokenIdFromBabelContract, isValidBabelBox } from "@fleet-sdk/babel-fees-plugin";
import { areEqualBy, isEmpty } from "@fleet-sdk/common";
import { withMessage } from "@regle/rules";
import BigNumber from "bignumber.js";
import { groupBy, maxBy, sortBy } from "es-toolkit";
import { ChevronsUpDownIcon, Loader2Icon, SlidersHorizontalIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useWalletStore } from "@/stores/walletStore";
import { AssetIcon, AssetSelect } from "@/components/asset";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { fetchBabelBoxes, getNanoErgsPerTokenRate } from "@/chains/ergo/babelFees";
import { bn, decimalize } from "@/common/bigNumber";
import { cn } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
import { useChildRegle } from "@/composables/useValidationScope";
import { ERG_DECIMALS, ERG_TOKEN_ID, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { AssetInfo, FeeSettings } from "@/types/internal";
import { bigNumberMinValue, staticBigNumber } from "@/validators";

interface FeeAsset extends AssetInfo {
  nanoErgsPerToken: BigNumber;
  balance?: BigNumber;
}

interface Props {
  modelValue: FeeSettings;
  /** nanoERGs a token fee also pays for, on top of the miner fee, e.g. new boxes' value. */
  boxesValue?: BigNumber;
  disabled?: boolean;
  maxMultiplier?: number;
  class?: HTMLAttributes["class"];
  ergOnly?: boolean;
  expanded?: boolean;
}

const BN_MIN_ERG_FEE = bn(SAFE_MIN_FEE_VALUE);

const format = useFormat();
const appStore = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();
const { t } = useI18n();

const props = withDefaults(defineProps<Props>(), {
  boxesValue: () => bn(0),
  maxMultiplier: 10,
  class: undefined
});

const emit = defineEmits<{ (e: "update:modelValue", payload: FeeSettings): void }>();

const assets = shallowRef<FeeAsset[]>([]);
const intSelected = shallowRef<FeeAsset>({ tokenId: ERG_TOKEN_ID, nanoErgsPerToken: bn(0) });
const internalMultiplier = shallowRef([1]);
const cachedMinRequired = shallowRef(bn(0));
const loading = ref(false);

const ergPrice = computed(() => assetsStore.prices.get(ERG_TOKEN_ID)?.fiat || 0);
const minTokenFee = computed(() => getTokenUnitsFor(BN_MIN_ERG_FEE.plus(props.boxesValue)));
const nanoErgsFee = computed(() => BN_MIN_ERG_FEE.times(multiplier.value));
const tokenUnitsFee = computed(() => minTokenFee.value.times(multiplier.value));

const multiplier = computed<number>({
  get: () => internalMultiplier.value[0],
  set: (newVal) => (internalMultiplier.value = [newVal])
});

const conversionCurrency = computed(() => {
  return intSelected.value.tokenId === ERG_TOKEN_ID ? appStore.settings.conversionCurrency : "ERG";
});

const feeAmount = computed(() => {
  const value =
    intSelected.value.tokenId === ERG_TOKEN_ID ? nanoErgsFee.value : tokenUnitsFee.value;
  return decimalize(value, intSelected.value.metadata?.decimals ?? 0);
});

const price = computed(() => {
  const value =
    intSelected.value.tokenId === ERG_TOKEN_ID
      ? decimalize(nanoErgsFee.value, ERG_DECIMALS).times(ergPrice.value)
      : decimalize(intSelected.value.nanoErgsPerToken.times(tokenUnitsFee.value), ERG_DECIMALS);

  return value.decimalPlaces(5, BigNumber.ROUND_DOWN);
});

const { r$ } = useChildRegle(
  { feeAmount: staticBigNumber(feeAmount) },
  computed(() => ({
    feeAmount: {
      bigNumberMinValue: withMessage(
        bigNumberMinValue(cachedMinRequired.value),
        ({ $params: [min] }) =>
          t("transaction.send.minFeeError", {
            min: format.number.decimal(min),
            name: props.modelValue.assetInfo?.name
          })
      )
    }
  })),
  { autoDirty: false }
);

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal.tokenId == intSelected.value.tokenId) return;

    const asset = assets.value.find((x) => x.tokenId === newVal.tokenId);
    if (asset) intSelected.value = asset;
  }
);

watch(
  () => intSelected.value,
  (newVal, oldVal) => {
    if (newVal.tokenId === oldVal.tokenId) return;

    if (multiplier.value != 1) multiplier.value = 1;
    recalculateMinRequired();
    emitSelected();
  }
);

watch(() => feeAmount.value, emitSelected);
watch(() => props.boxesValue.toString(), recalculateMinRequired);

watch(
  () => ({ walletId: wallet.id, assets: wallet.nonArtworkBalance }),
  (newVal, oldVal) => {
    if (areEqualBy(newVal.assets, oldVal.assets, (asset) => asset.tokenId)) return;
    loadAssets();
  }
);

onMounted(loadAssets);

async function loadAssets() {
  loading.value = true;

  const erg: FeeAsset = {
    tokenId: ERG_TOKEN_ID,
    nanoErgsPerToken: bn(1),
    metadata: assetsStore.metadata.get(ERG_TOKEN_ID)
  };

  multiplier.value = 1;
  assets.value = [erg];
  intSelected.value = { tokenId: ERG_TOKEN_ID, nanoErgsPerToken: bn(0) };
  cachedMinRequired.value = bn(0);
  select(erg);

  if (props.ergOnly) {
    loading.value = false;
    return;
  }

  const tokenIds = wallet.nonArtworkBalance
    .filter((x) => x.tokenId !== ERG_TOKEN_ID)
    .map((x) => x.tokenId);

  if (isEmpty(tokenIds)) {
    loading.value = false;
    return;
  }

  const allBoxes = await fetchBabelBoxes(tokenIds);
  const groups = groupBy(allBoxes.filter(isValidBabelBox), (box) =>
    extractTokenIdFromBabelContract(box.ergoTree)
  );

  const newAssets = Object.keys(groups)
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

  assets.value = assets.value.concat(
    sortBy(
      newAssets.filter((x) => x.nanoErgsPerToken),
      [(x) => x.nanoErgsPerToken.toNumber()]
    )
  );

  loading.value = false;
}

function getTokenUnitsFor(nanoErgs: BigNumber): BigNumber {
  if (
    nanoErgs.isZero() ||
    !intSelected.value ||
    !intSelected.value.nanoErgsPerToken ||
    intSelected.value.nanoErgsPerToken.isZero()
  ) {
    return bn(0);
  }

  return nanoErgs.div(intSelected.value.nanoErgsPerToken).integerValue(BigNumber.ROUND_UP);
}

function recalculateMinRequired() {
  if (intSelected.value.tokenId === ERG_TOKEN_ID) {
    cachedMinRequired.value = decimalize(BN_MIN_ERG_FEE, ERG_DECIMALS);
    if (!r$.$dirty) multiplier.value = 1;
  } else {
    cachedMinRequired.value = decimalize(
      minTokenFee.value,
      intSelected.value.metadata?.decimals || 0
    );
  }
}

function select(asset: FeeAsset) {
  intSelected.value = asset;
}

function emitSelected() {
  emit("update:modelValue", {
    tokenId: intSelected.value.tokenId,
    nanoErgsPerToken: intSelected.value.nanoErgsPerToken,
    value: feeAmount.value,
    assetInfo: intSelected.value.metadata
  });
}
</script>

<template>
  <FormField :validation="r$">
    <div
      :class="
        cn(
          'flex w-full flex-col text-sm',
          disabled && 'pointer-events-none opacity-50',
          props.class
        )
      "
    >
      <div class="flex items-center gap-2">
        <div class="flex min-w-0 grow items-center gap-1">
          <span class="font-semibold" v-once>{{ t("common.fee") }}</span>

          <template v-if="expanded">
            <span class="truncate px-1 tabular-nums">{{ format.number.decimal(feeAmount) }}</span>
            <span v-if="ergPrice" class="text-muted-foreground truncate text-xs tabular-nums">
              {{ format.number.decimal(price) }} {{ format.string.uppercase(conversionCurrency) }}
            </span>
          </template>

          <Popover v-else>
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="data-[state=open]:bg-accent h-7 min-w-0 gap-1.5 px-2 font-normal tabular-nums"
              >
                <span class="sr-only">{{ t("transaction.send.adjustFee") }}</span>
                <span class="truncate">{{ format.number.decimal(feeAmount) }}</span>
                <SlidersHorizontalIcon class="text-muted-foreground size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" class="w-64 space-y-4 p-4">
              <div class="flex items-baseline justify-between gap-2 text-sm">
                <span class="truncate tabular-nums">
                  {{ format.number.decimal(feeAmount) }} {{ format.asset.name(intSelected) }}
                </span>
                <span
                  v-if="ergPrice"
                  class="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums"
                >
                  {{ format.number.decimal(price) }}
                  {{ format.string.uppercase(conversionCurrency) }}
                </span>
              </div>
              <Slider
                v-model="internalMultiplier"
                :max="props.maxMultiplier"
                :step="1"
                :min="1"
                class="pb-1"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div
          v-if="ergOnly"
          class="text-muted-foreground flex h-8 items-center gap-1.5 px-1 font-medium"
        >
          <AssetIcon class="size-4" :token-id="intSelected.tokenId" />
          {{ format.asset.name(intSelected) }}
        </div>
        <AssetSelect v-else v-model="intSelected" :assets="assets" selectable>
          <PopoverTrigger :disabled="loading">
            <Button :disabled="loading" variant="secondary" size="sm" class="disabled:opacity-100">
              <AssetIcon
                class="size-4"
                :token-id="intSelected.tokenId"
                :type="intSelected.metadata?.type"
              />
              {{ format.asset.name(intSelected) }}
              <Loader2Icon v-if="loading" class="size-4 animate-spin opacity-50" />
              <ChevronsUpDownIcon v-else class="size-4 opacity-50" />
            </Button>
          </PopoverTrigger>
        </AssetSelect>
      </div>

      <div v-if="expanded" class="px-1 pt-4 pb-2">
        <Slider v-model="internalMultiplier" :max="props.maxMultiplier" :step="1" :min="1" />
      </div>
    </div>
  </FormField>
</template>
