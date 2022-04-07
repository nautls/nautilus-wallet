<template>
  <label
    @click.prevent.stop="setInputFocus()"
    @mouseover="troggleHover(true)"
    @mouseout="troggleHover(false)"
  >
    <span v-if="label && label !== ''">{{ label }}</span>
    <div class="asset-input relative">
      <button
        v-if="disposable"
        v-show="hovered"
        @click.prevent.stop="onRemoveClicked()"
        tabindex="-1"
        class="inline-flex cursor-pointer border-1 border-gray-400 bg-gray-100 w-5.5 h-5.5 -top-2.5 -right-2.5 absolute rounded-full ring-2 ring-light-50"
      >
        <vue-feather type="trash" class="p-1" size="12" />
      </button>
      <div class="flex flex-row gap-2 text-base">
        <div class="w-7/12">
          <input
            ref="val-input"
            @blur="v$.$touch()"
            v-cleave="{
              numeral: true,
              numeralDecimalScale: asset.info?.decimals ?? 0,
              onValueChanged
            }"
            class="w-full outline-none"
            placeholder="Amount"
          />
        </div>
        <div class="w-5/12">
          <div class="flex flex-row text-right items-center gap-1">
            <span class="flex-grow text-sm" v-if="asset.info?.name"
              ><tool-tip
                v-if="asset.info?.name.length > 10"
                tip-class="max-w-35"
                :label="asset.info?.name"
              >
                {{ $filters.compactString(asset.info?.name, 10) }}
              </tool-tip>
              <template v-else>
                {{ asset.info?.name }}
              </template></span
            >
            <span class="flex-grow" v-else>{{ $filters.compactString(asset.tokenId, 10) }}</span>
            <asset-icon class="h-5 w-5" :token-id="asset.tokenId" :type="asset.info?.type" />
          </div>
        </div>
      </div>
      <div class="flex flex-row gap-2 -mb-1.5">
        <div class="flex-grow">
          <span class="text-xs text-gray-400" v-if="ergPrice && rate(asset.tokenId)"
            >≈ {{ price }} {{ $filters.uppercase(conversionCurrency) }}</span
          >
          <span class="text-xs text-gray-400" v-else>No conversion rate</span>
        </div>
        <div class="flex-grow text-right">
          <a
            @click="setMaxValue()"
            class="text-xs cursor-pointer underline-transparent text-gray-400"
            >Balance: {{ $filters.formatBigNumber(confirmedAmount) }}</a
          >
        </div>
      </div>
    </div>
    <p class="input-error" v-if="v$.$error">
      {{ v$.$errors[0].$message }}
    </p>
  </label>
</template>

<script lang="ts">
import { bigNumberMinValue, bigNumberMaxValue } from "@/validators";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import BigNumber from "bignumber.js";
import { isEmpty } from "lodash";
import { defineComponent } from "vue";

export default defineComponent({
  name: "AssetInput",
  props: {
    label: { type: String, required: false },
    disposable: { type: Boolean, defaul: false },
    asset: { type: Object, required: true },
    modelValue: { type: Object, required: false },
    reservedAmount: { type: BigNumber, required: false },
    minAmount: { type: BigNumber, required: false }
  },
  setup() {
    return { v$: useVuelidate() };
  },
  computed: {
    conversionCurrency(): string {
      return this.$store.state.settings.conversionCurrency;
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

      return this.$filters.formatBigNumber(
        this.parsedValue.multipliedBy(this.priceFor(this.asset.tokenId)),
        2
      );
    },
    minRequired(): BigNumber {
      if (this.reservedAmount && this.minAmount) {
        return this.reservedAmount.plus(this.minAmount);
      }

      return this.minAmount || this.reservedAmount || new BigNumber(0);
    },
    ergPrice(): number {
      return this.$store.state.ergPrice;
    }
  },
  mounted() {
    if (!this.asset.info?.decimals && this.asset.confirmedAmount.isEqualTo(1)) {
      this.$emit("update:modelValue", this.asset.confirmedAmount);
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
  data() {
    return {
      hovered: false,
      internalValue: ""
    };
  },
  validations() {
    return {
      confirmedAmount: {
        minValue: helpers.withMessage(
          ({ $params }: any) =>
            `You need at least ${$params.min} ${this.asset.info?.name} to send this transaction`,
          bigNumberMinValue(this.minRequired)
        )
      },
      parsedValue: {
        required: helpers.withMessage("Amount is required.", required),
        minValue: bigNumberMinValue(this.minAmount || new BigNumber(0)),
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

      const n = new BigNumber(val.replaceAll(",", ""));
      if (!n.isNaN()) {
        return n;
      }
    },
    troggleHover(val: boolean) {
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
      if (!rate || !this.ergPrice) {
        return new BigNumber(0);
      }

      return new BigNumber(rate).multipliedBy(this.ergPrice);
    },
    rate(tokenId: string): number {
      return this.$store.state.assetMarketRates[tokenId]?.erg ?? 0;
    }
  }
});
</script>
