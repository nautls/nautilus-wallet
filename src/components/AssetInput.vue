<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { BigNumber } from "bignumber.js";
import { TrashIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { StateAssetSummary } from "@/stores/walletStore";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { useNumericMask } from "@/composables/useNumericMask";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { cn } from "@/lib/utils";
import { bigNumberMaxValue, bigNumberMinValue } from "@/validators";
import AssetIcon from "./AssetIcon.vue";
import { Button } from "./ui/button";

interface Props {
  disposable?: boolean;
  asset: StateAssetSummary;
  modelValue?: BigNumber;
  reservedAmount?: BigNumber;
  minAmount?: BigNumber;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: "",
  disposable: false,
  modelValue: () => bn(0),
  reservedAmount: undefined,
  minAmount: undefined,
  class: undefined
});

const emit = defineEmits(["remove", "update:modelValue"]);

const inputEl = useTemplateRef("value-input");

const internalValue = useNumericMask(inputEl, {
  numeralDecimalScale: props.asset.metadata?.decimals ?? 0
});

const app = useAppStore();
const assets = useAssetsStore();
const format = useFormat();

const hovered = ref(false);

onMounted(() => {
  if (props.asset.metadata?.decimals || props.asset.confirmedAmount.gt(1)) return;
  internalValue.value = props.asset.confirmedAmount;
});

const confirmedAmount = computed(() => props.asset.confirmedAmount);
const available = computed(() => {
  if (!props.reservedAmount) return confirmedAmount.value;

  return confirmedAmount.value.gte(props.reservedAmount)
    ? confirmedAmount.value.minus(props.reservedAmount)
    : confirmedAmount.value;
});

const ergPrice = computed(() => assets.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const price = computed(() => {
  if (!ergPrice.value || !tokenRate(props.asset.tokenId)) return null;
  if (!internalValue.value) return "0.00";
  return format.bn.format(internalValue.value.times(priceFor(props.asset.tokenId)), 2);
});

const minRequired = computed(() =>
  props.reservedAmount && props.minAmount
    ? props.reservedAmount.plus(props.minAmount)
    : props.minAmount || props.reservedAmount || bn(0)
);

const v$ = useVuelidate(
  {
    confirmedAmount: {
      minValue: helpers.withMessage(
        ({ $params }) =>
          `You need at least ${$params.min} ${props.asset.metadata?.name} to send this transaction`,
        bigNumberMinValue(minRequired.value)
      )
    },
    internalValue: {
      required: helpers.withMessage("Amount is required.", required),
      minValue: bigNumberMinValue(props.minAmount || bn(0)),
      maxValue: bigNumberMaxValue(available.value)
    }
  },
  { confirmedAmount, internalValue }
);

watch(internalValue, (value) => emit("update:modelValue", value));

watch(
  () => props.modelValue,
  (value) => (internalValue.value = value)
);

function setHover(val: boolean) {
  if (val === hovered.value) return;
  hovered.value = val;
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
  <div
    :class="
      cn(
        'flex w-full gap-1 flex-col  cursor-text rounded-md relative border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-within:outline-none focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )
    "
    @click.prevent.stop="setInputFocus()"
    @mouseover="setHover(true)"
    @mouseout="setHover(false)"
  >
    <button
      v-if="disposable"
      v-show="hovered"
      tabindex="-1"
      class="size-6 absolute -right-2 -top-2 cursor-pointer rounded-full bg-background ring-1 ring-input"
      @click.prevent.stop="emit('remove')"
    >
      <TrashIcon class="p-0.5 m-auto size-4" />
    </button>
    <div class="flex flex-row gap-2 text-sm">
      <input
        ref="value-input"
        class="outline-none flex-grow bg-transparent min-w-20"
        placeholder="0"
        @blur="v$.$touch()"
      />
      <div class="flex flex-row items-center gap-1 w-auto">
        <span v-if="asset.metadata?.name" class="flex-grow text-sm whitespace-nowrap">
          {{ format.string.shorten(asset.metadata?.name, 20) }}
        </span>
        <span v-else class="flex-grow">{{ format.string.shorten(asset.tokenId, 10) }}</span>
        <AssetIcon class="size-4" :token-id="asset.tokenId" :type="asset.metadata?.type" />
      </div>
    </div>
    <div class="flex flex-row gap-2 text-xs text-muted-foreground">
      <div class="flex-grow">
        <span v-if="price"
          >{{ price }} {{ format.string.uppercase(app.settings.conversionCurrency) }}</span
        >
        <span v-else>No conversion rate</span>
      </div>
      <Button
        tabindex="-1"
        variant="minimal"
        size="condensed"
        class="text-xs"
        @click="setMaxValue()"
        >Balance: {{ format.bn.format(confirmedAmount) }}</Button
      >
    </div>
  </div>
  <div v-if="v$.$error" class="-mt-1.5 px-2">
    {{ v$.$errors[0].$message }}
  </div>
</template>
