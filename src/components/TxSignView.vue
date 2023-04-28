<template>
  <div
    class="shadow-scroll text-sm flex-grow flex flex-col gap-4 leading-relaxed overflow-auto px-4 -mx-4 py-1"
  >
    <tx-sign-summary
      v-if="tx"
      :tx="tx"
      :ownAddresses="addresses.map((a) => a.script)"
    ></tx-sign-summary>

    <tx-box-details v-if="tx?.burning" :assets="tx?.burning" type="danger">
      <p>Burning</p>
      <template v-slot:subheader
        ><span>
          The assets listed below will be lost. Only continue if you know exactly what are you
          doing.
        </span></template
      >
    </tx-box-details>

    <!--    <address-deltas v-if="tx !== undefined" :tx="tx" :addresses="addresses" />-->

    <tx-box-details
      v-for="(output, index) in tx?.sending"
      :assets="output.assets"
      :babel-swap="output.isBabelBoxSwap"
      :key="index"
      :type="output.isIntrawallet ? 'info' : 'default'"
    >
      <p>
        {{ mountTitleForOutput(output) }}
      </p>

      <template v-slot:subheader v-if="!output.isBabelBoxSwap">
        <div class="font-mono text-sm break-all flex flex-col gap-2">
          <p>
            {{ $filters.compactString(output.receiver, 60) }}
            <click-to-copy :content="output.receiver" size="11" />
          </p>
          <p v-if="isLedger && isP2S(output)">
            <span class="font-semibold font-sans">Script Hash:</span>
            {{ $filters.compactString(output.scriptHash, 20) }}
          </p>
        </div>
      </template>
    </tx-box-details>

    <tx-box-details v-if="tx?.fee" :assets="tx.fee.assets">
      <p>Network fee</p>
    </tx-box-details>

    <div v-if="devMode && tx" class="block bg-gray-700 shadow-sm rounded py-2 px-2">
      <vue-json-pretty
        class="!font-mono text-xs text-white"
        :highlight-selected-node="false"
        :show-double-quotes="false"
        :show-length="true"
        :collapse-path="/(extension|tokens|assets|additionalRegisters)$/"
        :show-line="false"
        :deep="1"
        :data="tx?.rawTx"
      ></vue-json-pretty>
    </div>
  </div>

  <div>
    <label
      v-if="tx?.burning"
      class="inline-flex items-center font-normal cursor-pointer bg-red-100 border-1 border-red-300 mb-2 py-1 px-3 rounded w-full"
    >
      <input class="checkbox" type="checkbox" v-model="burnAgreement" />
      <span class="text-red-900">I understand that I'm burning my token(s).</span>
    </label>

    <template v-if="!isLedger">
      <p v-if="isReadonly" class="text-sm text-center">
        <vue-feather type="alert-triangle" class="text-yellow-500 align-middle" size="20" />
        <span class="align-middle"> This wallet cannot sign transactions.</span>
      </p>
      <div class="text-left" v-else>
        <form @submit.prevent="sign()" :disabled="!canSign || isMnemonicSigning">
          <input
            placeholder="Spending password"
            type="password"
            @blur="v$.password.$touch()"
            :disabled="!canSign || isMnemonicSigning"
            v-model="password"
            class="w-full control block"
          />
          <p class="input-error" v-if="v$.password.$error">
            {{ v$.password.$errors[0].$message }}
          </p>
        </form>
      </div>
    </template>
  </div>

  <div class="flex flex-row gap-4" v-if="!isLedger || (isLedger && !signState.loading)">
    <button class="btn outlined w-full" @click="cancel()" :disabled="isMnemonicSigning">
      Cancel
    </button>

    <button class="btn w-full" @click="sign()" :disabled="!canSign">
      <loading-indicator v-if="isMnemonicSigning" type="circular" class="h-4 w-4 align-middle" />
      <span v-else>Sign</span>
    </button>
  </div>

  <div class="-mt-4" v-if="isLedger">
    <ledger-device
      v-show="signState.loading"
      :bottom-text="signState.statusText"
      :state="signState.state"
      :loading="signState.loading"
      :connected="signState.connected"
      :app-id="signState.appId"
      :compact="true"
      :screen-text="signState.screenText"
    />
  </div>

  <loading-modal
    v-else
    title="Signing"
    :message="signState.statusText"
    :state="signState.state"
    @close="signState.state = 'unknown'"
  />
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { mapState } from "vuex";
import { ErgoTx, UnsignedTx } from "@/types/connector";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import {
  SigningState,
  SignTxCommand,
  StateAddress,
  StateAssetInfo,
  WalletType
} from "@/types/internal";
import { ACTIONS } from "@/constants/store";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { PasswordError } from "@/types/errors";
import LoadingModal from "@/components/LoadingModal.vue";
import TxBoxDetails from "./TxBoxDetails.vue";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { OutputInterpreter } from "@/api/ergo/transaction/interpreter/outputInterpreter";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import { AddressType } from "@fleet-sdk/core";
import AddressDeltas from "@/components/AddressDeltas.vue";
import TxSignSummary from "@/components/TxSignSummary.vue";

export default defineComponent({
  name: "TxSignView",
  components: {
    TxSignSummary,
    AddressDeltas,
    LoadingModal,
    TxBoxDetails,
    VueJsonPretty
  },
  emits: ["success", "fail", "refused"],
  props: {
    transaction: { type: Object as PropType<Readonly<UnsignedTx>>, required: true },
    inputsToSign: { type: Array<number>, required: false },
    isModal: { type: Boolean, default: false }
  },
  setup() {
    return {
      v$: useVuelidate()
    };
  },
  data() {
    return {
      burnAgreement: false,
      password: "",
      signState: {
        loading: false,
        connected: false,
        deviceModel: LedgerDeviceModelId.nanoS,
        screenText: "",
        statusText: "",
        state: "unknown",
        appId: 0
      } as SigningState
    };
  },
  validations() {
    return {
      password: {
        required: helpers.withMessage(
          "A spending password is required for transaction signing.",
          requiredUnless(this.isLedger)
        )
      }
    };
  },
  computed: {
    ...mapState({ wallets: "wallets", loading: "loading" }),
    isReadonly() {
      return this.$store.state.currentWallet.type === WalletType.ReadOnly;
    },
    isLedger() {
      return this.$store.state.currentWallet.type === WalletType.Ledger;
    },
    isMnemonicSigning() {
      return this.isModal && this.signState.loading && !this.isLedger;
    },
    currentWalletId() {
      return this.$store.state.currentWallet.id;
    },
    addresses(): StateAddress[] {
      return this.$store.state.currentAddresses;
    },
    assets(): StateAssetInfo {
      return this.$store.state.assetInfo;
    },
    canSign(): boolean {
      return (
        !this.isReadonly &&
        (this.tx?.burning === undefined || (this.tx?.burning !== undefined && this.burnAgreement))
      );
    },
    tx(): TxInterpreter | undefined {
      if (this.addresses.length === 0) {
        return;
      }

      return new TxInterpreter(
        this.transaction,
        this.addresses.map((a) => a.script),
        this.assets
      );
    },
    devMode() {
      return this.$store.state.settings.devMode;
    }
  },
  methods: {
    async sign() {
      if (!this.canSign) {
        return;
      }

      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.setState("loading", { loading: true, statusText: "" });

      try {
        const signedTx = await this.$store.dispatch(ACTIONS.SIGN_TX, {
          tx: this.transaction,
          inputsToSign: this.inputsToSign,
          walletId: this.currentWalletId,
          password: this.password,
          callback: this.setStateCallback
        } as SignTxCommand);

        if (!this.isModal || this.isMnemonicSigning) {
          this.setState("success", { loading: false });
          this.succeed(signedTx);
        } else {
          this.setState("unknown", { loading: false });

          // wait for loading modal animation to finish
          setTimeout(() => {
            this.succeed(signedTx);
          }, 100);
        }
      } catch (e) {
        this.setState("error", {
          loading: false,
          statusText: typeof e === "string" ? e : (e as Error).message
        });

        if (!(e instanceof PasswordError)) {
          console.error(e);

          if (!this.isModal || this.isMnemonicSigning) {
            this.fail(this.signState.statusText);
          } else {
            this.setState("unknown", { loading: false });

            // wait for loading modal animation to finish
            setTimeout(() => {
              this.fail(this.signState.statusText);
            }, 100);
          }
        }
      }
    },
    setState(
      state: "success" | "error" | "loading" | "unknown",
      newState: Omit<Partial<SigningState>, "state">
    ) {
      if (state === "error" || !this.isModal || (this.isModal && this.isLedger)) {
        this.signState.state = state;
      }

      this.signState = Object.assign(this.signState, newState);
    },
    setStateCallback(newState: SigningState) {
      this.signState = Object.assign(this.signState, newState);
    },
    cancel() {
      this.refuse("User rejected");
    },
    refuse(info: string) {
      this.$emit("refused", info);
    },
    fail(info: string) {
      this.$emit("fail", info);
    },
    succeed(signedTx: ErgoTx) {
      this.$emit("success", signedTx);
    },
    mountTitleForOutput(output: OutputInterpreter) {
      if (output.isBabelBoxSwap) {
        return "Babel Fee swap";
      } else if (output.isIntrawallet) {
        return "Sending to your address";
      } else if (output.receiverAddressType === AddressType.P2S) {
        return "Sending to contract";
      } else if (output.receiverAddressType === AddressType.P2SH) {
        return "Sending to script hash";
      }

      return "Sending to external address";
    },
    isP2S(output: OutputInterpreter) {
      return output.receiverAddressType === AddressType.P2S;
    }
  }
});
</script>
