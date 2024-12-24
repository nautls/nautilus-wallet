<template>
  <label
    @click.prevent.stop="setInputFocus()"
    @mouseover="toggleHover(true)"
    @mouseout="toggleHover(false)"
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
            v-cleave="{
              numeral: true,
              numeralDecimalScale: asset.metadata?.decimals ?? 0,
              onValueChanged
            }"
            class="w-full outline-none"
            placeholder="Amount"
            @blur="v$.$touch()"
          />
        </div>
        <div class="w-5/12">
          <div class="flex flex-row items-center gap-1 text-right">
            <span v-if="asset.metadata?.name" class="flex-grow text-sm"
              ><tool-tip
                v-if="asset.metadata?.name.length > 10"
                tip-class="max-w-35"
                :label="asset.metadata?.name"
              >
                {{ format.string.shorten(asset.metadata?.name, 10) }}
              </tool-tip>
              <template v-else>
                {{ asset.metadata?.name }}
              </template></span
            >
            <span v-else class="flex-grow">{{ format.string.shorten(asset.tokenId, 10) }}</span>
            <asset-icon class="h-5 w-5" :token-id="asset.tokenId" :type="asset.metadata?.type" />
          </div>
        </div>
      </div>
      <div class="-mb-1.5 flex flex-row gap-2">
        <div class="flex-grow">
          <span v-if="ergPrice && rate(asset.tokenId)" class="text-xs text-gray-400"
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

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { isEmpty } from "@fleet-sdk/common";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { BigNumber } from "bignumber.js";
import { TrashIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { StateAssetSummary } from "@/stores/walletStore";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { bigNumberMaxValue, bigNumberMinValue } from "@/validators";

export default defineComponent({
  name: "AssetInput",
  components: {
    TrashIcon
  },
  props: {
    label: { type: String, required: false },
    disposable: { type: Boolean, default: false },
    asset: { type: Object as PropType<StateAssetSummary>, required: true },
    modelValue: { type: Object, required: false },
    reservedAmount: { type: Object as PropType<BigNumber>, required: false },
    minAmount: { type: Object as PropType<BigNumber>, required: false }
  },
  setup() {
    return {
      v$: useVuelidate(),
      app: useAppStore(),
      assets: useAssetsStore(),
      format: useFormat()
    };
  },
  data() {
    return {
      hovered: false,
      internalValue: ""
    };
  },
  computed: {
    conversionCurrency(): string {
      return this.app.settings.conversionCurrency;
    },
    confirmedAmount(): BigNumber {
      return this.asset.confirmedAmount;
    },
    available(): BigNumber {
      if (!this.reservedAmount) {
        return this.confirmedAmount;
      }

      if (this.confirmedAmount.isGreaterThanOrEqualTo(this.reservedAmount)) {
        return this.confirmedAmount.minus(this.reservedAmount);
      } else {
        return this.confirmedAmount;
      }
    },
    parsedValue(): BigNumber | undefined {
      return this.parseToBigNumber(this.internalValue);
    },
    price(): string {
      if (!this.parsedValue) {
        return "0.00";
      }

      return this.format.bn.format(
        this.parsedValue.multipliedBy(this.priceFor(this.asset.tokenId)),
        2
      );
    },
    minRequired(): BigNumber {
      if (this.reservedAmount && this.minAmount) {
        return this.reservedAmount.plus(this.minAmount);
      }

      return this.minAmount || this.reservedAmount || bn(0);
    },
    ergPrice(): number {
      return this.assets.prices.get(ERG_TOKEN_ID)?.fiat ?? 0;
    }
  },
  watch: {
    parsedValue(value: BigNumber | undefined) {
      if (!value && !isEmpty(this.internalValue)) {
        return;
      }

      this.$emit("update:modelValue", value);
    },
    modelValue(value: BigNumber) {
      const el = (this.$refs as any)["val-input"];
      if (!value || value.isNaN()) {
        el.cleave.setRawValue(undefined);
        return;
      } else if (this.parsedValue?.isEqualTo(value)) {
        return;
      }

      el.cleave.setRawValue(value.toString());
    }
  },
  mounted() {
    if (!this.asset.metadata?.decimals && this.asset.confirmedAmount.isEqualTo(1)) {
      this.$emit("update:modelValue", this.asset.confirmedAmount);
    }
  },
  validations() {
    return {
      confirmedAmount: {
        minValue: helpers.withMessage(
          ({ $params }) =>
            `You need at least ${$params.min} ${this.asset.metadata?.name} to send this transaction`,
          bigNumberMinValue(this.minRequired)
        )
      },
      parsedValue: {
        required: helpers.withMessage("Amount is required.", required),
        minValue: bigNumberMinValue(this.minAmount || bn(0)),
        maxValue: bigNumberMaxValue(this.available)
      }
    };
  },
  methods: {
    onValueChanged(e: { target: { value: string; rawValue: string } }) {
      this.internalValue = e.target.rawValue;
    },
    parseToBigNumber(val: string): BigNumber | undefined {
      if (isEmpty(val)) {
        return undefined;
      }

      const n = bn(val.replaceAll(",", ""));
      if (!n.isNaN()) {
        return n;
      }
    },
    toggleHover(val: boolean) {
      if (val === this.hovered) {
        return;
      }

      this.hovered = val;
    },
    setMaxValue() {
      (this.$refs as any)["val-input"].cleave.setRawValue(this.available.toString(10));
    },
    setInputFocus() {
      (this.$refs as any)["val-input"].focus();
    },
    onRemoveClicked() {
      this.$emit("remove");
    },
    priceFor(tokenId: string): BigNumber {
      const rate = this.rate(tokenId);
      if (!rate || !this.ergPrice) return bn(0);
      return bn(rate).multipliedBy(this.ergPrice);
    },
    rate(tokenId: string): number {
      return this.assets.prices.get(tokenId)?.erg ?? 0;
    }
  }
});
</script>
