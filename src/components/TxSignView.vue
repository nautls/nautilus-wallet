<template>
  <div
    class="shadow-scroll text-sm flex-grow flex flex-col gap-4 leading-relaxed overflow-auto px-4 -mx-4 py-1"
  >
    <tx-spending-details v-if="tx?.burning" :assets="tx?.burning" type="danger">
      <p>Burning</p>
      <template v-slot:subheader
        ><span>
          The assets listed below will be lost. Only continue if you know exactly what are you
          doing.
        </span></template
      >
    </tx-spending-details>

    <tx-spending-details
      v-for="(output, index) in tx?.sending"
      :assets="output.assets"
      :key="index"
      :type="output.isIntrawallet ? 'info' : 'normal'"
    >
      <p>
        {{ mountTitleForOutput(output) }}
      </p>

      <template v-slot:subheader>
        <p class="font-mono text-sm break-all">
          {{ $filters.compactString(output.receiver, 60) }}
          <click-to-copy :content="output.receiver" size="11" />
        </p>
      </template>
    </tx-spending-details>
    <tx-spending-details v-if="tx?.fee" :assets="tx?.fee?.assets"
      ><p>Network fee</p></tx-spending-details
    >

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

  <div class="flex flex-row gap-4">
    <button class="btn outlined w-full" @click="cancel()" :disabled="isMnemonicSigning">
      Cancel
    </button>

    <button class="btn w-full" @click="sign()" :disabled="!canSign">
      <loading-indicator v-if="isMnemonicSigning" type="circular" class="h-4 w-4 align-middle" />
      <span v-else>Sign</span>
    </button>
  </div>
  <ledger-signing-modal v-if="isLedger" :state="signState" @close="signState.state = 'unknown'" />
  <loading-modal
    v-else
    title="Signing"
    :message="signState.statusText"
    :state="signState.state"
    @close="signState.state = 'unknown'"
  />
</template>

<script lang="ts">
import { defineComponent, PropType, Ref } from "vue";
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
import { useVuelidate, Validation, ValidationArgs } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { PasswordError } from "@/types/errors";
import LoadingModal from "@/components/LoadingModal.vue";
import LedgerSigningModal from "@/components/LedgerSigningModal.vue";
import TxSpendingDetails from "./TxSpendingDetails.vue";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { MAINNET } from "@/constants/ergo";
import { OutputInterpreter } from "@/api/ergo/transaction/interpreter/outputInterpreter";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";

export default defineComponent({
  name: "TxSignView",
  components: {
    LoadingModal,
    LedgerSigningModal,
    TxSpendingDetails,
    VueJsonPretty
  },
  emits: ["success", "fail", "refused"],
  props: {
    transaction: { type: Object as PropType<Readonly<UnsignedTx>>, required: true },
    isModal: { type: Boolean, default: false }
  },
  setup() {
    return {
      v$: useVuelidate() as Ref<Validation<ValidationArgs<any>, unknown>>
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
          }, 300);
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
            }, 300);
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
      if (output.isIntrawallet) {
        return "Sending to your address";
      } else if (!this.isP2PK(output.receiver)) {
        return "Sending to contract";
      }

      return "Sending to external address";
    },
    isP2PK(address: string) {
      if (address.length !== 51) {
        return false;
      }

      if (MAINNET) {
        return address.startsWith("9");
      }

      return address.startsWith("3");
    }
  }
});
</script>
