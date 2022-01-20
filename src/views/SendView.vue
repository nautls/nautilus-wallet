<template>
  <div class="flex flex-col gap-5 h-full">
    <label>
      Receiver
      <input
        type="text"
        @blur="v$.recipient.$touch()"
        v-model.lazy="recipient"
        spellcheck="false"
        class="w-full control block"
      />
      <p class="input-error" v-if="v$.recipient.$error">{{ v$.recipient.$errors[0].$message }}</p>
    </label>
    <div class="flex-grow">
      <div class="flex flex-col gap-2">
        <asset-input
          :label="index === 0 ? 'Assets' : ''"
          v-for="(item, index) in selected"
          :key="item.asset.tokenId"
          v-model="item.amount"
          :asset="item.asset"
          :locked-amount="isErg(item.asset.tokenId) ? lockedErgAmount : undefined"
          :min-amount="isErg(item.asset.tokenId) ? minBoxValue : undefined"
          :disposable="!isErg(item.asset.tokenId)"
          @remove="remove(item.asset.tokenId)"
        />
        <p class="text-xs text-right">Fee: {{ suggestedFee }} ERG</p>
        <drop-down class="mt-3" :disabled="unselected.length === 0">
          <template v-slot:trigger>
            <div class="text-sm w-full uppercase py-1 pl-6 text-center font-bold">Add asset</div>
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
                  <img
                    :src="$filters.assetLogo(asset.tokenId)"
                    class="h-8 w-8 rounded-full"
                    :alt="asset.name"
                  />
                  <div class="flex-grow">
                    <template v-if="asset.name">{{
                      $filters.compactString(asset.name, 20, "end")
                    }}</template>
                    <template v-else>{{ $filters.compactString(asset.tokenId, 10) }}</template>
                  </div>
                  <div>{{ $filters.formatBigNumber(asset.confirmedAmount) }}</div>
                </div>
              </a>
            </div>
          </template>
        </drop-down>
      </div>
    </div>

    <div class="flex-shrink">
      <div>
        <label
          >Spending password
          <input
            @blur="v$.password.$touch()"
            v-model.lazy="password"
            type="password"
            class="w-full control block"
          />
          <p class="input-error" v-if="v$.password.$error">
            {{ v$.password.$errors[0].$message }}
          </p>
        </label>
      </div>
      <button class="btn w-full mt-5" @click="sendTx()">Confirm</button>
    </div>
    <loading-modal
      title="Signing"
      :message="singMessage"
      :state="singState"
      @close="singState = 'disabled'"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_DECIMALS, ERG_TOKEN_ID, FEE_VALUE, MIN_BOX_VALUE } from "@/constants/ergo";
import { SendTxCommandAsset, StateAsset, StateWallet, WalletType } from "@/types/internal";
import AssetInput from "@/components/AssetInput.vue";
import { differenceBy, find, isEmpty, remove } from "lodash";
import { ACTIONS } from "@/constants/store";
import BigNumber from "bignumber.js";
import { setDecimals } from "@/utils/bigNumbers";
import { required, helpers } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { validErgoAddress } from "@/validators";
import { PasswordError, TxSignError } from "@/types/errors";
import LoadingModal from "@/components/LoadingModal.vue";
import { TRANSACTION_URL } from "@/constants/explorer";
import { mapState } from "vuex";

export default defineComponent({
  name: "SendView",
  components: { AssetInput, LoadingModal },
  setup() {
    return { v$: useVuelidate() };
  },
  computed: {
    ...mapState({
      currentWallet: "currentWallet"
    }),
    assets(): StateAsset[] {
      return this.$store.getters[GETTERS.BALANCE];
    },
    unselected(): StateAsset[] {
      return differenceBy(
        this.assets,
        this.selected.map(a => a.asset),
        a => a.tokenId
      );
    },
    hasChange(): boolean {
      if (!isEmpty(this.unselected)) {
        return true;
      }

      for (const asset of this.selected.filter(a => a.asset.tokenId !== ERG_TOKEN_ID)) {
        if (!asset.amount || !asset.amount.isEqualTo(asset.asset.confirmedAmount)) {
          return true;
        }
      }

      return false;
    },
    lockedErgAmount(): BigNumber {
      const erg = find(this.selected, a => a.asset.tokenId === ERG_TOKEN_ID);
      if (!erg || erg.asset.confirmedAmount.isZero()) {
        return new BigNumber(0);
      }

      if (!this.changeValue) {
        return this.suggestedFee;
      }

      return this.suggestedFee.plus(this.changeValue);
    },
    suggestedFee(): BigNumber {
      return setDecimals(new BigNumber(FEE_VALUE), ERG_DECIMALS);
    },
    changeValue(): BigNumber | undefined {
      if (!this.hasChange) {
        return;
      }

      return this.minBoxValue;
    },
    minBoxValue(): BigNumber {
      return setDecimals(new BigNumber(MIN_BOX_VALUE), ERG_DECIMALS) || new BigNumber(0);
    }
  },
  watch: {
    currentWallet(wallet: StateWallet) {
      this.$router.push({ name: "assets-page" });
    },
    assets: {
      immediate: true,
      handler(t: any, d: any) {
        if (!isEmpty(this.selected)) {
          return;
        }

        this.setErgAsSelected();
      }
    }
  },
  data() {
    return {
      selected: [] as SendTxCommandAsset[],
      password: "",
      recipient: "",
      singState: "disabled",
      singMessage: ""
    };
  },
  validations() {
    return {
      recipient: {
        required: helpers.withMessage("Receiver address is required.", required),
        validErgoAddress
      },
      password: {
        required: helpers.withMessage("A password is required for transaction signing.", required)
      }
    };
  },
  methods: {
    async sendTx() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.singState = "loading";
      this.singMessage = "";
      const currentWalletId = this.$store.state.currentWallet.id;

      try {
        const txId = await this.$store.dispatch(ACTIONS.SEND_TX, {
          recipient: this.recipient,
          assets: this.selected,
          walletId: currentWalletId,
          password: this.password
        });

        this.clear();

        this.singState = "success";
        this.singMessage = `Transaction submitted<br><a href='${this.urlForTransaction(
          txId
        )}' target='_blank'>View on Explorer</a>`;
      } catch (e) {
        this.singState = "error";
        console.error(e);

        if (e instanceof TxSignError) {
          this.singMessage = `Something went wrong on signing processs.<br /><br /><code>${e.message}</code>`;
        } else if (e instanceof PasswordError) {
          this.singMessage = e.message;
        } else {
          this.singMessage = `Something went wrong on signing process. Please try again later.<br /><br /><code>${
            (e as Error).message
          }</code>`;
        }
      }
    },
    clear(): void {
      this.selected = [];
      this.setErgAsSelected();
      this.recipient = "";
      this.password = "";
      this.v$.$reset();
    },
    setErgAsSelected(): void {
      const erg = find(this.assets, a => a.tokenId === ERG_TOKEN_ID);
      if (erg) {
        this.selected.push({ asset: erg });
      }
    },
    urlForTransaction(txId: string): string {
      return `${TRANSACTION_URL}${txId}`;
    },
    add(asset: StateAsset) {
      this.selected.push({ asset });
      this.setMinBoxValue();
    },
    remove(tokenId: string) {
      remove(this.selected, a => a.asset.tokenId === tokenId);
      this.setMinBoxValue();
    },
    setMinBoxValue() {
      if (this.selected.length === 1) {
        return;
      }

      const erg = find(this.selected, a => this.isErg(a.asset.tokenId));
      if (!erg) {
        return;
      }

      if (!erg.amount || erg.amount.isLessThan(this.minBoxValue)) {
        erg.amount = new BigNumber(this.minBoxValue);
      }
    },
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    }
  }
});
</script>
