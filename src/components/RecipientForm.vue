<template>
  <div
    class="relative"
    @mouseover="toggleHover(true)"
    @mouseout="toggleHover(false)"
  >
    <label>
      Receiver

      <button
        v-if="disposable"
        v-show="hovered"
        @click.prevent.stop="signalRecipientRemove"
        tabindex="-1"
        class="inline-flex cursor-pointer border-1 border-gray-400 bg-gray-100 w-5.5 h-5.5 -top-2.5 -right-2.5 absolute rounded-full ring-2 ring-light-50"
      >
        <vue-feather type="trash" class="p-1" size="12" />
      </button>

      <input
        type="text"
        @blur="v$.recipientAddress.$touch()"
        v-model="recipientAddress"
        spellcheck="false"
        class="w-full control block"
      />
      <p class="input-error" v-if="v$.recipientAddress.$error">{{ v$.recipientAddress.$errors[0].$message }}</p>
    </label>
    <div>
      <div class="flex flex-col gap-2">
        <asset-input
          v-for="(item, index) in selected"
          :key="item.asset.tokenId"
          :label="index === 0 ? 'Assets' : ''"
          :asset="item.asset"
          :reserved-amount="getReserveAmountFor(item.asset.tokenId)"
          :min-amount="isErg(item.asset.tokenId) ? minBoxValue : undefined"
          :disposable="!isErg(item.asset.tokenId) || !(isErg(item.asset.tokenId) && isFeeInErg)"
          @remove="remove(item.asset.tokenId)"
          v-model="item.amount"
          @update:modelValue="signalUpdate"
        />
        <drop-down
          :disabled="unselected.length === 0"
          list-class="max-h-50"
          trigger-class="px-2 py-3 text-sm uppercase"
        >
          <template v-slot:trigger>
            <div class="flex-grow pl-6 text-center font-semibold">Add asset</div>
            <vue-feather type="chevron-down" size="18" />
          </template>
          <template v-slot:items>
            <div class="group">
              <a
                @click="add(asset)"
                class="group-item narrow"
                v-for="asset in unselected"
                :key="asset.tokenId"
              >
                <div class="flex flex-row items-center gap-2">
                  <asset-icon class="h-8 w-8" :token-id="asset.tokenId" :type="asset.info?.type" />
                  <div class="flex-grow">
                    <template v-if="asset.info?.name">{{
                      $filters.compactString(asset.info?.name, 26)
                    }}</template>
                    <template v-else>{{ $filters.compactString(asset.tokenId, 10) }}</template>
                    <p
                      v-if="devMode && !isErg(asset.tokenId)"
                      class="text-gray-400 text-xs font-mono"
                    >
                      {{ $filters.compactString(asset.tokenId, 16) }}
                    </p>
                  </div>
                  <div>{{ $filters.formatBigNumber(asset.confirmedAmount) }}</div>
                </div>
              </a>
            </div>
            <div class="group">
              <a @click="addAll()" class="group-item narrow">
                <div class="flex flex-row items-center gap-2">
                  <mdi-icon name="check-all" class="text-yellow-500 w-8 h-8" size="32" />
                  <div class="flex-grow">
                    Add all
                    <p class="text-gray-400 text-xs">
                      Use this option to include all your assets in the sending list.
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </template>
        </drop-down>
        <p class="input-error" v-if="v$.selected.$error">{{ v$.selected.$errors[0].$message }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { BigNumberType, FeeSettings, StateAsset, StateWallet, WalletType } from "@/types/internal";
import { differenceBy, find, isEmpty, remove } from "lodash";
import { decimalize, undecimalize } from "@/utils/bigNumbers";
import { required, helpers } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { validErgoAddress } from "@/validators";
import { UnsignedTx } from "@/types/connector";
import { TxAssetAmount } from "@/api/ergo/transaction/txBuilder";
import BigNumber from "bignumber.js";
import AssetInput from "@/components/AssetInput.vue";

const validations = {
  recipientAddress: {
    required: helpers.withMessage("Receiver address is required.", required),
    validErgoAddress
  },
  selected: {
    required: helpers.withMessage(
      "At least one asset should be selected in order to send a transaction.",
      required
    )
  }
};

export default defineComponent({
  name: "RecipientForm",
  components: { AssetInput },
  props: {
    modelValue: Object,
    disposable: {
      type: Boolean,
      default: true
    }
  },
  setup() {
    return {
      v$: useVuelidate()
    };
  },
  computed: {
    currentWallet(): StateWallet {
      return this.$store.state.currentWallet;
    },
    isLedger(): boolean {
      return this.currentWallet.type === WalletType.Ledger;
    },
    assets(): StateAsset[] {
      return this.$store.getters[GETTERS.BALANCE];
    },
    unselected(): StateAsset[] {
      return differenceBy(
        this.assets,
        this.selected.map((a) => a.asset),
        (a) => a.tokenId
      );
    },
    hasMinErgSelected(): boolean {
      const erg = this.selected.find((x) => this.isErg(x.asset.tokenId));
      if (!erg || !erg.amount || erg.amount.isZero()) {
        return false;
      }

      return undecimalize(erg.amount, ERG_DECIMALS).isGreaterThanOrEqualTo(MIN_BOX_VALUE);
    },
    hasChange(): boolean {
      if (!isEmpty(this.unselected)) {
        return true;
      }

      for (const item of this.selected.filter((a) => a.asset.tokenId !== ERG_TOKEN_ID)) {
        if (
          !item.amount ||
          (!this.isFeeAsset(item.asset.tokenId) &&
            !item.amount.isEqualTo(item.asset.confirmedAmount)) ||
          (this.isFeeAsset(item.asset.tokenId) &&
            !item.amount.isEqualTo(item.asset.confirmedAmount.minus(this.fee)))
        ) {
          return true;
        }
      }

      return false;
    },
    reservedFeeAssetAmount(): BigNumberType {
      const feeAsset = find(this.selected, (a) => a.asset.tokenId === this.feeSettings.tokenId);
      if (!feeAsset || feeAsset.asset.confirmedAmount.isZero()) {
        return new BigNumber(0);
      }

      if (!this.changeValue) {
        return this.fee;
      }

      if (this.feeSettings.tokenId === ERG_TOKEN_ID) {
        return this.fee.plus(this.changeValue);
      }

      return this.fee;
    },
    fee(): BigNumberType {
      return this.feeSettings.value;
    },
    isFeeInErg(): boolean {
      return this.isErg(this.feeSettings.tokenId);
    },
    changeValue(): BigNumberType | undefined {
      if (!this.hasChange) {
        return;
      }

      return this.minBoxValue;
    },
    minBoxValue(): BigNumberType {
      return decimalize(new BigNumber(MIN_BOX_VALUE), ERG_DECIMALS);
    },
    devMode(): boolean {
      return this.$store.state.settings.devMode;
    }
  },
  watch: {
    currentWallet() {
      this.$router.push({ name: "assets-page" });
    },
    assets: {
      immediate: true,
      handler() {
        if (!isEmpty(this.selected) || this.v$.$anyDirty) {
          return;
        }

        this.setErgAsSelected();
      }
    },
    ["feeSettings.tokenId"](newVal: string) {
      if (this.isErg(newVal)) {
        this.setErgAsSelected();
      }
    },
    ["selected.length"]() {
      this.v$.selected.$touch();
    },
    recipientAddress() {
      this.$emit("update:recipientAddress", this.recipientAddress);
    },
    selected: {
      deep: true,
      handler(newVal, oldVal) {
        this.$emit("update:selectedAssets", newVal, oldVal);
      }
    }
  },
  data() {
    return {
      selected: [] as TxAssetAmount[],
      transaction: undefined as Readonly<UnsignedTx> | undefined,
      feeSettings: {
        tokenId: ERG_TOKEN_ID,
        value: decimalize(new BigNumber(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
      } as FeeSettings,
      signModalActive: false,
      recipientAddress: "",
      password: "",
      stateMessage: "",
      state: "unknown",
      hovered: false
    };
  },
  validations() {
    return validations;
  },
  methods: {
    getReserveAmountFor(tokenId: string): BigNumberType | undefined {
      if (this.isFeeAsset(tokenId)) {
        return this.reservedFeeAssetAmount;
      } else if (this.isErg(tokenId) && this.hasChange) {
        return this.changeValue;
      }
    },
    signalUpdate() {
      this.$emit("update:recipientData", {
        address: this.recipientAddress,
        selectedAssets: this.selected
      });
    },
    signalRecipientRemove() {
      this.$emit("removeRecipient", "removeRecipient");
    },
    clear(): void {
      this.selected = [];
      this.setErgAsSelected();
      this.recipientAddress = "";
      this.password = "";
      this.transaction = undefined;
      this.v$.$reset();
    },
    setErgAsSelected(): void {
      if (!this.isFeeInErg && !isEmpty(this.selected)) {
        return;
      }

      const selected = find(this.selected, (a) => a.asset.tokenId === ERG_TOKEN_ID);
      if (selected) {
        return;
      }

      const erg = find(this.assets, (a) => a.tokenId === ERG_TOKEN_ID);
      if (erg) {
        this.selected.unshift({ asset: erg, amount: undefined });
      }
    },
    urlForTransaction(txId: string): string {
      return new URL(`/transactions/${txId}`, this.$store.state.settings.explorerUrl).toString();
    },
    add(asset: StateAsset) {
      this.removeDisposableSelections();
      this.selected.push({ asset });

      if (this.feeSettings.tokenId == ERG_TOKEN_ID) {
        this.setMinBoxValue();
      }
    },
    addAll() {
      this.unselected.forEach((unselected) => {
        this.selected.push({ asset: unselected });
      });

      this.setMinBoxValue();
    },
    remove(tokenId: string) {
      remove(this.selected, (a) => a.asset.tokenId === tokenId);
      this.setMinBoxValue();
    },
    setMinBoxValue() {
      if (this.selected.length === 1) {
        return;
      }

      const erg = find(this.selected, (a) => this.isFeeAsset(a.asset.tokenId));
      if (!erg) {
        return;
      }

      if (!erg.amount || erg.amount.isLessThan(this.minBoxValue)) {
        erg.amount = new BigNumber(this.minBoxValue);
      }
    },
    removeDisposableSelections() {
      if (this.feeSettings.tokenId === ERG_TOKEN_ID) {
        return;
      }

      const first = this.selected[0];
      if (!first) {
        return;
      }

      if (!first.amount || first.amount.isZero()) {
        this.remove(first.asset.tokenId);
      }
    },
    isFeeAsset(tokenId: string): boolean {
      return tokenId === this.feeSettings.tokenId;
    },
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    },
    toggleHover(val: boolean) {
      if (val === this.hovered) {
        return;
      }
      this.hovered = val;
    }
  }
});
</script>