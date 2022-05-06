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
          :reserved-amount="isErg(item.asset.tokenId) ? reservedErgAmount : undefined"
          :min-amount="isErg(item.asset.tokenId) ? minBoxValue : undefined"
          :disposable="!isErg(item.asset.tokenId)"
          @remove="remove(item.asset.tokenId)"
        />
        <drop-down :disabled="unselected.length === 0">
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
                  <asset-icon class="h-8 w-8" :token-id="asset.tokenId" :type="asset.info?.type" />
                  <div class="flex-grow">
                    <template v-if="asset.info?.name">{{
                      $filters.compactString(asset.info?.name, 26)
                    }}</template>
                    <template v-else>{{ $filters.compactString(asset.tokenId, 10) }}</template>
                  </div>
                  <div>{{ $filters.formatBigNumber(asset.confirmedAmount) }}</div>
                </div>
              </a>
            </div>
          </template>
        </drop-down>
        <div class="w-full">
          <div class="w-auto float-right">
            <drop-down discrete>
              <template v-slot:trigger>
                <div class="text-sm w-full text-right py-1 text-center">
                  <span>Fee: {{ fee }} ERG</span>
                </div>
                <vue-feather type="chevron-down" size="18" />
              </template>
              <template v-slot:items>
                <div class="group">
                  <o-slider
                    v-model="feeMultiplicator"
                    @click.prevent.stop
                    :min="1"
                    :max="5"
                    :tooltip="false"
                    fill-class="bg-blue-600 rounded-l"
                    root-class="p-4"
                    track-class="rounded-r"
                    thumb-class="rounded"
                  />
                </div>
              </template>
            </drop-down>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-shrink">
      <label v-if="!isLedger"
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
      <button class="btn w-full mt-4" @click="sendTx()">Confirm</button>
    </div>
    <ledger-signing-modal v-if="isLedger" :state="signState" @close="signState.state = 'unknown'" />
    <loading-modal
      v-else
      title="Signing"
      :message="signState.statusText"
      :state="signState.state"
      @close="signState.state = 'unknown'"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_DECIMALS, ERG_TOKEN_ID, FEE_VALUE, MIN_BOX_VALUE } from "@/constants/ergo";
import {
  SendTxCommand,
  SendTxCommandAsset,
  SigningState,
  StateAsset,
  WalletType
} from "@/types/internal";
import AssetInput from "@/components/AssetInput.vue";
import { differenceBy, find, isEmpty, remove } from "lodash";
import { ACTIONS } from "@/constants/store";
import BigNumber from "bignumber.js";
import { decimalize } from "@/utils/bigNumbers";
import { required, helpers, requiredUnless } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { validErgoAddress } from "@/validators";
import { PasswordError, TxSignError } from "@/types/errors";
import LoadingModal from "@/components/LoadingModal.vue";
import LedgerSigningModal from "@/components/LedgerSigningModal.vue";
import { TRANSACTION_URL } from "@/constants/explorer";
import { mapState } from "vuex";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { DeviceError } from "ledger-ergo-js";

export default defineComponent({
  name: "SendView",
  components: { AssetInput, LoadingModal, LedgerSigningModal },
  setup() {
    return { v$: useVuelidate() };
  },
  created() {
    if (this.$route.query.recipient) {
      this.recipient = this.$route.query.recipient as string;
    }
  },
  computed: {
    ...mapState({
      currentWallet: "currentWallet"
    }),
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
    hasChange(): boolean {
      if (!isEmpty(this.unselected)) {
        return true;
      }

      for (const asset of this.selected.filter((a) => a.asset.tokenId !== ERG_TOKEN_ID)) {
        if (!asset.amount || !asset.amount.isEqualTo(asset.asset.confirmedAmount)) {
          return true;
        }
      }

      return false;
    },
    reservedErgAmount(): BigNumber {
      const erg = find(this.selected, (a) => a.asset.tokenId === ERG_TOKEN_ID);
      if (!erg || erg.asset.confirmedAmount.isZero()) {
        return new BigNumber(0);
      }

      if (!this.changeValue) {
        return this.fee;
      }

      return this.fee.plus(this.changeValue);
    },
    fee(): BigNumber {
      return this.minFee.multipliedBy(this.feeMultiplicator);
    },
    changeValue(): BigNumber | undefined {
      if (!this.hasChange) {
        return;
      }

      return this.minBoxValue;
    },
    minBoxValue(): BigNumber {
      return decimalize(new BigNumber(MIN_BOX_VALUE), ERG_DECIMALS) || new BigNumber(0);
    }
  },
  watch: {
    currentWallet() {
      this.$router.push({ name: "assets-page" });
    },
    assets: {
      immediate: true,
      handler() {
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
      feeMultiplicator: 1,
      signState: {
        loading: false,
        connected: false,
        deviceModel: LedgerDeviceModelId.nanoS,
        screenText: "",
        statusText: "",
        state: "unknown",
        appId: 0
      } as SigningState,
      minFee: Object.freeze(decimalize(new BigNumber(FEE_VALUE), ERG_DECIMALS))
    };
  },
  validations() {
    return {
      recipient: {
        required: helpers.withMessage("Receiver address is required.", required),
        validErgoAddress
      },
      password: {
        required: helpers.withMessage(
          "A spending password is required for transaction signing.",
          requiredUnless(this.isLedger)
        )
      }
    };
  },
  methods: {
    async sendTx() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.signState.loading = true;
      this.signState.state = "loading";
      this.signState.statusText = "";
      const currentWalletId = this.$store.state.currentWallet.id;

      try {
        const txId = await this.$store.dispatch(ACTIONS.SEND_TX, {
          recipient: this.recipient,
          assets: this.selected,
          fee: this.fee,
          walletId: currentWalletId,
          password: this.password,
          callback: this.setStateCallback
        } as SendTxCommand);

        this.clear();

        this.signState.loading = false;
        this.signState.state = "success";
        this.signState.statusText = `Transaction submitted<br><a class='url' href='${this.urlForTransaction(
          txId
        )}' target='_blank'>View on Explorer</a>`;
      } catch (e) {
        this.signState.state = "error";
        this.signState.loading = false;
        this.signState.connected = false;
        console.error(e);

        if (e instanceof TxSignError) {
          this.signState.statusText = `Something went wrong in the signing processs.<br /><br /><code>${e.message}</code>`;
        } else if (e instanceof PasswordError) {
          this.signState.statusText = e.message;
        } else if (!(e instanceof DeviceError)) {
          this.signState.statusText = `Something went wrong in the signing process. Please try again later.<br /><br /><code>${
            (e as Error).message
          }</code>`;
        }
      }
    },
    setStateCallback(newState: SigningState) {
      this.signState = Object.assign(this.signState, newState);
    },
    clear(): void {
      this.selected = [];
      this.setErgAsSelected();
      this.recipient = "";
      this.password = "";
      this.v$.$reset();
    },
    setErgAsSelected(): void {
      const erg = find(this.assets, (a) => a.tokenId === ERG_TOKEN_ID);
      if (erg) {
        this.selected.push({ asset: erg, amount: undefined });
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
      remove(this.selected, (a) => a.asset.tokenId === tokenId);
      this.setMinBoxValue();
    },
    setMinBoxValue() {
      if (this.selected.length === 1) {
        return;
      }

      const erg = find(this.selected, (a) => this.isErg(a.asset.tokenId));
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
