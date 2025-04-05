<script setup lang="ts">
import { computed, HTMLAttributes, onMounted, reactive, ref, useTemplateRef, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import BigNumber from "bignumber.js";
import { ArrowDownUpIcon, ArrowUpLeftIcon, TrashIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { AssetBalance } from "@/stores/walletStore";
import { AssetIcon } from "@/components/asset";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { bn } from "@/common/bigNumber";
import { cn } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
import { MaskOptions, useNumericMask } from "@/composables/useNumericMask";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { bigNumberMaxValue, bigNumberMinValue } from "@/validators";

interface Props {
  disposable?: boolean;
  disabled?: boolean;
  validate?: boolean;
  asset: AssetBalance;
  modelValue?: BigNumber;
  reservedAmount?: BigNumber;
  minAmount?: BigNumber;
  class?: HTMLAttributes["class"];
  inputClass?: HTMLAttributes["class"];
}

const MAX_ASSET_NAME_LEN = 16;
const MIN_FIAT_PRECISION = 4;
const MAX_FIAT_PRECISION = 8;

const props = withDefaults(defineProps<Props>(), {
  disposable: false,
  validate: true,
  modelValue: () => bn(0),
  reservedAmount: undefined,
  minAmount: undefined,
  class: undefined,
  inputClass: undefined
});

let basePrecision = props.asset.metadata?.decimals ?? 0;
let fiatPrecision = MIN_FIAT_PRECISION;

const emit = defineEmits(["remove", "update:modelValue"]);

const inputEl = useTemplateRef("value-input");
const maskOpt = reactive<MaskOptions>({ numeralDecimalScale: basePrecision });

const {
  value: internalValue,
  patchOptionsQuietly,
  patchOptions
} = useNumericMask(inputEl, maskOpt);

const app = useAppStore();
const assets = useAssetsStore();
const format = useFormat();
const { t } = useI18n();

const isHovered = ref(false);
const isDenom = ref(false);

onMounted(() => {
  if (props.asset.metadata?.decimals || !props.asset.balance.eq(1)) return;
  internalValue.value = props.asset.balance;
});

watch(
  () => props.asset,
  () => {
    basePrecision = props.asset.metadata?.decimals ?? 0;
    patchOptions({ numeralDecimalScale: basePrecision });
  }
);

const ergPrice = computed(() => assets.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const isConvertible = computed(() => ergPrice.value && tokenRate(props.asset.tokenId));

const denomValue = computed(() => convert(internalValue.value, isDenom.value ? "base" : "denom"));
const baseValue = computed(
  () =>
    (isDenom.value ? denomValue.value : internalValue.value)?.decimalPlaces(basePrecision) ?? bn(0)
);

const balance = computed(() => props.asset.balance);
const available = computed(() => {
  const av =
    props.reservedAmount && balance.value.gte(props.reservedAmount)
      ? balance.value.minus(props.reservedAmount)
      : balance.value;

  return convert(av, "auto");
});

function convert(value: BigNumber | undefined | null, to: "base" | "denom" | "auto"): BigNumber {
  if (!isConvertible.value || !value) return value ?? bn(0);
  if (to === "auto") return isDenom.value ? convert(value, "denom") : value;

  const assetPrice = priceFor(props.asset.tokenId);
  fiatPrecision = getPrecision(assetPrice);

  return to === "denom"
    ? value.times(assetPrice).decimalPlaces(fiatPrecision, BigNumber.ROUND_UP)
    : value.dividedBy(assetPrice);
}

function getPrecision(n: BigNumber) {
  const precision = getZerosAfterDecimal(n) + MIN_FIAT_PRECISION;
  return precision > MAX_FIAT_PRECISION ? MAX_FIAT_PRECISION : precision;
}

function getZerosAfterDecimal(n: BigNumber) {
  const bigNumberStr = n.toString();
  const decimalIndex = bigNumberStr.indexOf(".");
  if (decimalIndex === -1) return 0;

  let zeroCount = 0;
  for (let i = decimalIndex + 1; i < bigNumberStr.length; i++) {
    if (bigNumberStr[i] !== "0") break;
    zeroCount++;
  }

  return zeroCount;
}

const formattedDenom = computed(() =>
  format.bn.format(
    denomValue.value,
    isDenom.value ? (props.asset.metadata?.decimals ?? 0) : fiatPrecision
  )
);

const baseCurrencyName = computed(() =>
  isDenom.value
    ? format.string.uppercase(app.settings.conversionCurrency)
    : format.asset.name(props.asset, MAX_ASSET_NAME_LEN)
);

const denomCurrencyName = computed(() =>
  isDenom.value
    ? format.asset.name(props.asset, MAX_ASSET_NAME_LEN)
    : format.string.uppercase(app.settings.conversionCurrency)
);

const minRequired = computed(() =>
  props.reservedAmount && props.minAmount
    ? props.reservedAmount.plus(props.minAmount)
    : props.minAmount || props.reservedAmount || bn(0)
);

const v$ = useVuelidate(
  computed(() => ({
    balance: {
      minValue: helpers.withMessage(
        ({ $params }) =>
          t("validations.minNamedAsset", {
            min: $params.min,
            asset: baseCurrencyName.value
          }),
        bigNumberMinValue(convert(minRequired.value, "auto"))
      )
    },
    internalValue: {
      required: helpers.withMessage(t("validations.requiredAmount"), required),
      minValue: bigNumberMinValue(convert(props.minAmount, "auto") || bn(0)),
      maxValue: bigNumberMaxValue(available.value)
    }
  })),
  { balance: props.asset.balance, internalValue }
);

watch(internalValue, (newVal) => {
  emit(
    "update:modelValue",
    (isDenom.value ? denomValue.value : newVal)?.decimalPlaces(basePrecision)
  );
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (baseValue.value.eq(newVal)) return;
    internalValue.value = convert(newVal, "auto");
  }
);

function toggleDenominating() {
  const currentValue = internalValue.value;
  const isMaxAvailable = currentValue?.eq(available.value) ?? false;

  patchOptionsQuietly({
    numeralDecimalScale: isDenom.value ? basePrecision : fiatPrecision
  });

  isDenom.value = !isDenom.value;
  internalValue.value = isMaxAvailable
    ? available.value
    : convert(currentValue, isDenom.value ? "denom" : "base");
}

function setHover(val: boolean) {
  if (val === isHovered.value) return;
  isHovered.value = val;
}

function setMaxValue() {
  internalValue.value = available.value;
}

function setInputFocus() {
  inputEl.value?.focus();
}

function priceFor(tokenId: string): BigNumber {
  const rate = tokenRate(tokenId);
  if (!rate || !ergPrice.value) return bn(0);
  return bn(rate).multipliedBy(ergPrice.value);
}

function tokenRate(tokenId: string): number {
  return assets.prices.get(tokenId)?.erg ?? 0;
}
</script>

<template>
  <FormField :validation="props.validate ? v$ : undefined">
    <div
      :class="
        cn(
          'border-input placeholder:text-muted-foreground focus-within:ring-ring relative flex w-full cursor-text flex-col gap-1 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-within:ring-1 focus-within:outline-hidden',
          props.disabled && 'border-input/50 cursor-not-allowed focus-within:ring-0',
          props.class
        )
      "
      @click.prevent.stop="setInputFocus()"
      @mouseover="setHover(true)"
      @mouseout="setHover(false)"
    >
      <Button
        v-if="disposable && !props.disabled"
        v-show="isHovered"
        type="button"
        tabindex="-1"
        size="icon"
        variant="outline"
        class="bg-background ring-input absolute -top-2 -right-2 size-6 cursor-pointer rounded-full border-0 ring-1"
        @click.prevent.stop="emit('remove')"
      >
        <TrashIcon class="m-auto size-4 p-0.5" />
      </Button>

      <div class="flex flex-row gap-2 text-sm">
        <input
          ref="value-input"
          :disabled="props.disabled"
          :class="
            cn(
              'placeholder:text-muted-foreground w-full min-w-24 bg-transparent font-medium outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
              props.inputClass
            )
          "
          placeholder="0"
          @blur="v$.$touch()"
        />

        <div class="w-auto min-w-max select-none">
          <slot
            v-if="$slots.asset"
            name="asset"
            :base-currency-name="baseCurrencyName"
            :asset="asset"
          />
          <div
            v-else
            class="flex flex-row items-center gap-1"
            :class="props.disabled && 'opacity-50'"
          >
            <span class="grow text-sm font-medium whitespace-nowrap">
              {{ baseCurrencyName }}
            </span>
            <AssetIcon class="size-4" :token-id="asset.tokenId" :type="asset.metadata?.type" />
          </div>
        </div>
      </div>

      <div class="flex flex-row gap-2 select-none">
        <div class="text-muted-foreground flex grow flex-row items-center gap-1 text-xs">
          <Button
            v-if="isConvertible"
            :disabled="props.disabled"
            type="button"
            tabindex="-1"
            variant="minimal"
            size="condensed"
            class="gap-1 text-xs [&_svg]:size-3"
            @click="toggleDenominating"
          >
            <span>{{ formattedDenom }} {{ denomCurrencyName }}</span>
            <ArrowDownUpIcon class="size-3"
          /></Button>
          <span v-else :class="disabled && 'opacity-50'">{{
            t("assetInput.noConversionRate")
          }}</span>
        </div>

        <template v-if="props.asset.balance.isPositive()">
          <Skeleton v-if="app.settings.hideBalances" class="h-4 w-20 animate-none" />
          <Button
            v-else
            type="button"
            tabindex="-1"
            variant="minimal"
            :disabled="props.disabled"
            size="condensed"
            :class="
              cn(
                'gap-1 text-xs [&_svg]:size-3',
                props.disabled && 'pointer-events-none cursor-not-allowed'
              )
            "
            @click="setMaxValue()"
            ><ArrowUpLeftIcon /> {{ format.bn.format(available) }}</Button
          >
        </template>
      </div>
    </div>
  </FormField>
</template>
