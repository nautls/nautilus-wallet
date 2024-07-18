<template>
  <div class="flex flex-col gap-4 min-h-full">
    <label>
      Receiver
      <input
        v-model.lazy="recipient"
        type="text"
        spellcheck="false"
        class="w-full control block"
        @blur="v$.recipient.$touch()"
      />
      <p v-if="v$.recipient.$error" class="input-error">{{ v$.recipient.$errors[0].$message }}</p>
    </label>
    <div>
      <div class="flex flex-col gap-2">
        <asset-input
          v-for="(item, index) in selected"
          :key="item.asset.tokenId"
          v-model="item.amount"
          :label="index === 0 ? 'Assets' : ''"
          :asset="item.asset"
          :reserved-amount="getReserveAmountFor(item.asset.tokenId)"
          :min-amount="isErg(item.asset.tokenId) ? minBoxValue : undefined"
          :disposable="!isErg(item.asset.tokenId) || !(isErg(item.asset.tokenId) && isFeeInErg)"
          @remove="remove(item.asset.tokenId)"
        />
        <drop-down
          :disabled="unselected.length === 0"
          list-class="max-h-50"
          trigger-class="px-2 py-3 text-sm uppercase"
        >
          <template #trigger>
            <div class="flex-grow pl-6 text-center font-semibold">Add asset</div>
            <vue-feather type="chevron-down" size="18" />
          </template>
          <template #items>
            <div class="group">
              <a
                v-for="asset in unselected"
                :key="asset.tokenId"
                class="group-item narrow"
                @click="add(asset)"
              >
                <div class="flex flex-row items-center gap-2">
                  <asset-icon
                    class="h-8 w-8"
                    :token-id="asset.tokenId"
                    :type="asset.metadata?.type"
                  />
                  <div class="flex-grow">
                    <template v-if="asset.metadata?.name">{{
                      $filters.string.shorten(asset.metadata?.name, 26)
                    }}</template>
                    <template v-else>{{ $filters.string.shorten(asset.tokenId, 10) }}</template>
                    <p
                      v-if="devMode && !isErg(asset.tokenId)"
                      class="text-gray-400 text-xs font-mono"
                    >
                      {{ $filters.string.shorten(asset.tokenId, 16) }}
                    </p>
                  </div>
                  <div>{{ $filters.bn.format(asset.confirmedAmount) }}</div>
                </div>
              </a>
            </div>
            <div class="group">
              <a class="group-item narrow" @click="addAll()">
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
        <p v-if="v$.selected.$error" class="input-error">{{ v$.selected.$errors[0].$message }}</p>
      </div>
    </div>

    <div class="flex-grow"></div>

    <fee-selector v-model:selected="feeSettings" :include-min-amount-per-box="!hasChange ? 0 : 1" />
    <button class="btn w-full" @click="sendTx()">Confirm</button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { differenceBy, remove } from "lodash-es";
import { helpers, required } from "@vuelidate/validators";
import { isEmpty } from "@fleet-sdk/common";
import { useVuelidate } from "@vuelidate/core";
import { BigNumber } from "bignumber.js";
import { GETTERS } from "@/constants/store/getters";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { FeeSettings, StateAsset, StateWallet } from "@/types/internal";
import { bn, decimalize, undecimalize } from "@/common/bigNumber";
import { validErgoAddress } from "@/validators";
import { createP2PTransaction, TxAssetAmount } from "@/chains/ergo/transaction/txBuilder";
import AssetInput from "@/components/AssetInput.vue";
import FeeSelector from "@/components/FeeSelector.vue";
import { openTransactionSigningModal } from "@/common/componentUtils";
import { useAppStore } from "@/stores/appStore";

const validations = {
  recipient: {
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
  name: "SendView",
  components: { AssetInput, FeeSelector },
  setup() {
    return { app: useAppStore(), v$: useVuelidate() };
  },
  data() {
    return {
      selected: [] as TxAssetAmount[],
      feeSettings: {
        tokenId: ERG_TOKEN_ID,
        value: decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
      } as FeeSettings,
      password: "",
      recipient: ""
    };
  },
  computed: {
    currentWallet(): StateWallet {
      return this.$store.state.currentWallet;
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
    reservedFeeAssetAmount(): BigNumber {
      const feeAsset = this.selected.find((a) => a.asset.tokenId === this.feeSettings.tokenId);
      if (!feeAsset || feeAsset.asset.confirmedAmount.isZero()) return bn(0);
      if (!this.changeValue) return this.fee;
      if (this.feeSettings.tokenId === ERG_TOKEN_ID) return this.fee.plus(this.changeValue);
      return this.fee;
    },
    fee(): BigNumber {
      return this.feeSettings.value;
    },
    isFeeInErg(): boolean {
      return this.isErg(this.feeSettings.tokenId);
    },
    changeValue(): BigNumber | undefined {
      if (!this.hasChange) {
        return;
      }

      return this.minBoxValue;
    },
    minBoxValue(): BigNumber {
      return decimalize(bn(MIN_BOX_VALUE), ERG_DECIMALS);
    },
    devMode(): boolean {
      return this.app.settings.devMode;
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
    }
  },
  created() {
    if (this.$route.query.recipient && typeof this.$route.query.recipient === "string") {
      this.recipient = this.$route.query.recipient;
    }
  },
  validations() {
    return validations;
  },
  methods: {
    getReserveAmountFor(tokenId: string): BigNumber | undefined {
      if (this.isFeeAsset(tokenId)) {
        return this.reservedFeeAssetAmount;
      } else if (this.isErg(tokenId) && this.hasChange) {
        return this.changeValue;
      }
    },
    async sendTx() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      openTransactionSigningModal({
        onTransactionBuild: this.buildTransaction,
        onSuccess: this.clear
      });
    },
    async buildTransaction() {
      return await createP2PTransaction({
        recipientAddress: this.recipient,
        assets: this.selected,
        fee: this.feeSettings,
        walletType: this.currentWallet.type
      });
    },
    clear(): void {
      this.selected = [];
      this.setErgAsSelected();
      this.recipient = "";
      this.password = "";
      this.v$.$reset();
    },
    setErgAsSelected(): void {
      if (!this.isFeeInErg && !isEmpty(this.selected)) return;

      const selected = this.selected.find((a) => a.asset.tokenId === ERG_TOKEN_ID);
      if (selected) return;

      const erg = this.assets.find((a) => a.tokenId === ERG_TOKEN_ID);
      if (erg) {
        this.selected.unshift({ asset: erg, amount: undefined });
      }
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
      if (this.selected.length === 1) return;

      const erg = this.selected.find((a) => this.isFeeAsset(a.asset.tokenId));
      if (!erg) return;

      if (!erg.amount || erg.amount.isLessThan(this.minBoxValue)) {
        erg.amount = bn(this.minBoxValue);
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
    }
  }
});
</script>
