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
          <!-- parsedValue. -->
          <input
            ref="val-input"
            @blur="v$.$touch()"
            v-cleave="{
              numeral: true,
              numeralDecimalScale: asset.decimals,
              onValueChanged
            }"
            class="w-full outline-none"
            placeholder="Amount"
          />
        </div>
        <div class="w-5/12">
          <div class="flex flex-row text-right items-center gap-1">
            <span class="flex-grow" v-if="asset.name">{{
              $filters.compactString(asset.name, 10, "end")
            }}</span>
            <span class="flex-grow" v-else>{{ $filters.compactString(asset.tokenId, 10) }}</span>
            <img
              class="h-5 rounded-full object-scale-down w-5 inline-block flex-shrink"
              :src="$filters.assetLogo(asset.tokenId)"
            />
          </div>
        </div>
      </div>
      <div class="flex flex-row gap-2 -mb-1.5">
        <div class="flex-grow">
          <span class="text-xs text-gray-400" v-if="asset.price">≈ {{ price }} USD</span>
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
import { StateAsset } from "@/types/internal";
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
      if (!this.asset.price) {
        return "0.00";
      }
      return this.parsedValue?.multipliedBy(this.asset.price).toFormat(2) || "0.00";
    },
    minRequired(): BigNumber {
      if (this.reservedAmount && this.minAmount) {
        return this.reservedAmount.plus(this.minAmount);
      }

      return this.minAmount || this.reservedAmount || new BigNumber(0);
    }
  },
  mounted() {
    if (!this.asset.decimals && this.asset.confirmedAmount.isEqualTo(1)) {
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
      if (!value || value.isNaN() || this.parsedValue?.isEqualTo(value)) {
        return;
      }

      (this.$refs as any)["val-input"].cleave.setRawValue(value.toString());
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
            `You need at least ${$params.min} ${this.asset.name} to send this transaction`,
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
      (this.$refs as any)["val-input"].cleave.setRawValue(this.available.toString());
    },
    setInputFocus() {
      (this.$refs as any)["val-input"].focus();
    },
    onRemoveClicked() {
      this.$emit("remove");
    }
  }
});
</script>
