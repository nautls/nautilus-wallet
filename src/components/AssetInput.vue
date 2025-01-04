<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { isEmpty } from "@fleet-sdk/common";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { BigNumber } from "bignumber.js";
import Cleave from "cleave.js";
import { TrashIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { StateAssetSummary } from "@/stores/walletStore";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { bigNumberMaxValue, bigNumberMinValue } from "@/validators";
import AssetIcon from "./AssetIcon.vue";

interface Props {
  label?: string;
  disposable?: boolean;
  asset: StateAssetSummary;
  modelValue?: BigNumber;
  reservedAmount?: BigNumber;
  minAmount?: BigNumber;
}

const props = withDefaults(defineProps<Props>(), {
  label: "",
  disposable: false,
  modelValue: () => bn(0),
  reservedAmount: undefined,
  minAmount: undefined
});

const emit = defineEmits(["remove", "update:modelValue"]);

const inputEl = useTemplateRef<CleaveHTMLElement>("val-input");

const app = useAppStore();
const assets = useAssetsStore();
const format = useFormat();

const hovered = ref(false);
const internalValue = ref("");

onMounted(() => {
  if (!inputEl.value) return;

  inputEl.value.cleave = new Cleave(inputEl.value, {
    numeral: true,
    numeralDecimalScale: props.asset.metadata?.decimals ?? 0,
    onValueChanged
  });
});

onBeforeUnmount(() => {
  if (!inputEl.value?.cleave) return;
  inputEl.value.cleave.destroy();
});

onMounted(() => {
  if (props.asset.metadata?.decimals || props.asset.confirmedAmount.gt(1)) return;
  emit("update:modelValue", props.asset.confirmedAmount);
});

const conversionCurrency = computed(() => app.settings.conversionCurrency);
const confirmedAmount = computed(() => props.asset.confirmedAmount);
const available = computed(() => {
  if (!props.reservedAmount) return confirmedAmount.value;

  if (confirmedAmount.value.gte(props.reservedAmount)) {
    return confirmedAmount.value.minus(props.reservedAmount);
  } else {
    return confirmedAmount.value;
  }
});

const parsedValue = computed(() => {
  return parseToBigNumber(internalValue.value);
});

const price = computed(() => {
  if (!parsedValue.value) return "0.00";
  return format.bn.format(parsedValue.value.multipliedBy(priceFor(props.asset.tokenId)), 2);
});

const minRequired = computed(() => {
  if (props.reservedAmount && props.minAmount) {
    return props.reservedAmount.plus(props.minAmount);
  }

  return props.minAmount || props.reservedAmount || bn(0);
});

const ergPrice = computed(() => assets.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);

const v$ = useVuelidate(
  {
    confirmedAmount: {
      minValue: helpers.withMessage(
        ({ $params }) =>
          `You need at least ${$params.min} ${props.asset.metadata?.name} to send this transaction`,
        bigNumberMinValue(minRequired.value)
      )
    },
    parsedValue: {
      required: helpers.withMessage("Amount is required.", required),
      minValue: bigNumberMinValue(props.minAmount || bn(0)),
      maxValue: bigNumberMaxValue(available.value)
    }
  },
  { confirmedAmount, parsedValue }
);

watch(parsedValue, (value) => {
  if (!value && !isEmpty(internalValue.value)) return;
  emit("update:modelValue", value);
});

watch(
  () => props.modelValue,
  (value) => {
    if (!value || value.isNaN()) {
      inputEl.value?.cleave.setRawValue(""); // undefined
      return;
    } else if (parsedValue.value?.isEqualTo(value)) {
      return;
    }

    inputEl.value?.cleave.setRawValue(value.toString());
  }
);

function onValueChanged(e: { target: { value: string; rawValue: string } }) {
  internalValue.value = e.target.rawValue;
}

function parseToBigNumber(val: string): BigNumber | undefined {
  if (isEmpty(val)) return undefined;

  const n = bn(val.replaceAll(",", ""));
  if (!n.isNaN()) return n;
}

function setHover(val: boolean) {
  if (val === hovered.value) return;
  hovered.value = val;
}

function setMaxValue() {
  inputEl.value?.cleave.setRawValue(available.value.toString(10));
}

function setInputFocus() {
  inputEl.value?.focus();
}

function onRemoveClicked() {
  emit("remove");
}

function tokenRate(tokenId: string): number {
  return assets.prices.get(tokenId)?.erg ?? 0;
}

function priceFor(tokenId: string): BigNumber {
  const rate = tokenRate(tokenId);
  if (!rate || !ergPrice.value) return bn(0);

  return bn(rate).multipliedBy(ergPrice.value);
}
</script>

<template>
  <label
    @click.prevent.stop="setInputFocus()"
    @mouseover="setHover(true)"
    @mouseout="setHover(false)"
  >
    <span v-if="label && label !== ''">{{ label }}</span>
    <div class="asset-input relative">
      <button
        v-if="disposable"
        v-show="hovered"
        tabindex="-1"
        class="w-5.5 h-5.5 absolute -right-2.5 -top-2.5 inline-flex cursor-pointer rounded-full border border-gray-400 bg-gray-100 ring-2 ring-light-50"
        @click.prevent.stop="onRemoveClicked()"
      >
        <trash-icon class="p-1" :size="20" />
      </button>
      <div class="flex flex-row gap-2 text-base">
        <div class="w-7/12">
          <input
            ref="val-input"
            class="w-full outline-none"
            placeholder="Amount"
            @blur="v$.$touch()"
          />
        </div>
        <div class="w-5/12">
          <div class="flex flex-row items-center gap-1 text-right">
            <span v-if="asset.metadata?.name" class="flex-grow text-sm">
              <!-- <tool-tip
                v-if="asset.metadata?.name.length > 10"
                tip-class="max-w-35"
                :label="asset.metadata?.name"
              >
                {{ format.string.shorten(asset.metadata?.name, 10) }}
              </tool-tip> -->
              <!-- <template v-else> -->
              {{ asset.metadata?.name }}
              <!-- </template> -->
            </span>
            <span v-else class="flex-grow">{{ format.string.shorten(asset.tokenId, 10) }}</span>
            <asset-icon class="h-5 w-5" :token-id="asset.tokenId" :type="asset.metadata?.type" />
          </div>
        </div>
      </div>
      <div class="-mb-1.5 flex flex-row gap-2">
        <div class="flex-grow">
          <span v-if="ergPrice && tokenRate(asset.tokenId)" class="text-xs text-gray-400"
            >≈ {{ price }} {{ format.string.uppercase(conversionCurrency) }}</span
          >
          <span v-else class="text-xs text-gray-400">No conversion rate</span>
        </div>
        <div class="flex-grow text-right">
          <a
            class="underline-transparent cursor-pointer text-xs text-gray-400"
            @click="setMaxValue()"
            >Balance: {{ format.bn.format(confirmedAmount) }}</a
          >
        </div>
      </div>
    </div>
    <p v-if="v$.$error" class="input-error">
      {{ v$.$errors[0].$message }}
    </p>
  </label>
</template>
