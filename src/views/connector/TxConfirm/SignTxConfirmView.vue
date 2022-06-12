<template>
  <div class="flex flex-col h-full gap-4">
    <dapp-plate :origin="origin" :favicon="favicon" compact />
    <h1 class="text-xl m-auto ext-center">Wants to sign a transaction</h1>
    <div class="text-sm flex-grow flex flex-col gap-4 leading-relaxed overflow-auto px-4 -mx-4">
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
        ><p>Transaction fee</p></tx-spending-details
      >
    </div>

    <div>
      <template v-if="!isLedger">
        <p v-if="isReadonly" class="text-sm text-center">
          <vue-feather type="alert-triangle" class="text-yellow-500 align-middle" size="20" />
          <span class="align-middle"> This wallet cannot sign transactions.</span>
        </p>
        <div class="text-left" v-else>
          <input
            placeholder="Spending password"
            type="password"
            @blur="v$.password.$touch()"
            v-model.lazy="password"
            class="w-full control block"
          />
          <p class="input-error" v-if="v$.password.$error">
            {{ v$.password.$errors[0].$message }}
          </p>
        </div>
      </template>

      <label
        v-if="tx?.burning"
        class="inline-block font-normal cursor-pointer bg-red-100 border-1 border-red-300 mt-2 py-2 px-3 rounded w-full"
      >
        <input class="checkbox" type="checkbox" v-model="burnAgreement" />
        <span class="align-middle text-red-900">I understand that I'm burning my token(s).</span>
      </label>
    </div>

    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="cancel()">Cancel</button>
      <button
        class="btn w-full"
        @click="sign()"
        :disabled="isReadonly || (tx?.burning && !burnAgreement)"
      >
        Confirm
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
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "vuex";
import { rpcHandler } from "@/background/rpcHandler";
import { find, isEmpty } from "lodash";
import { TxSignError, TxSignErrorCode, UnsignedTx } from "@/types/connector";
import DappPlate from "@/components/DappPlate.vue";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import {
  SigningState,
  SignTxFromConnectorCommand,
  StateAddress,
  StateAssetInfo,
  WalletType
} from "@/types/internal";
import { ACTIONS } from "@/constants/store";
import ToolTip from "@/components/ToolTip.vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import JSONBig from "json-bigint";
import { PasswordError } from "@/types/errors";
import LoadingModal from "@/components/LoadingModal.vue";
import LedgerSigningModal from "@/components/LedgerSigningModal.vue";
import TxSpendingDetails from "./Components/TxSpendingDetails.vue";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { MAINNET } from "@/constants/ergo";
import { OutputInterpreter } from "@/api/ergo/transaction/interpreter/outputInterpreter";

export default defineComponent({
  name: "SignTxConfirmView",
  components: {
    DappPlate,
    ToolTip,
    LoadingModal,
    LedgerSigningModal,
    TxSpendingDetails
  },
  setup() {
    return { v$: useVuelidate() };
  },
  async created() {
    const message = find(rpcHandler.messages, (m) => m.function === "signTx");
    if (!message || !message.params) {
      return;
    }

    this.sessionId = message.sessionId;
    this.requestId = message.requestId;
    this.origin = message.params[0];
    this.favicon = message.params[1];
    this.rawTx = Object.freeze(message.params[2]);

    const connection = await connectedDAppsDbService.getByOrigin(this.origin);
    if (!connection) {
      window.close();
      return;
    }

    this.currentWalletId = connection.walletId;
    window.addEventListener("beforeunload", this.onWindowClosing);
  },
  data() {
    return {
      rawTx: Object.freeze({} as UnsignedTx),
      burnAgreement: false,
      currentWalletId: 0,
      requestId: 0,
      sessionId: 0,
      password: "",
      origin: "",
      favicon: "",
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
  watch: {
    ["loading.wallets"]: {
      immediate: true,
      async handler(loading: boolean) {
        this.setWallet(loading, this.currentWalletId);
      }
    },
    currentWalletId: {
      immediate: true,
      async handler(walletId: number) {
        this.setWallet(this.loading.wallets, walletId);
      }
    },
    rawTx() {
      this.loadAssetInfo(
        this.rawTx.outputs
          .map((x) => x.assets)
          .flat()
          .map((x) => x.tokenId)
      );
    }
  },
  computed: {
    ...mapState({ wallets: "wallets", loading: "loading" }),
    isReadonly() {
      return this.$store.state.currentWallet.type === WalletType.ReadOnly;
    },
    isLedger() {
      return this.$store.state.currentWallet.type === WalletType.Ledger;
    },
    addresses(): StateAddress[] {
      return this.$store.state.currentAddresses;
    },
    assets(): StateAssetInfo {
      return this.$store.state.assetInfo;
    },
    tx(): TxInterpreter | undefined {
      if (this.addresses.length === 0) {
        return;
      }

      return new TxInterpreter(
        this.rawTx as UnsignedTx,
        this.addresses.map((a) => a.script),
        this.assets
      );
    }
  },
  methods: {
    async setWallet(loading: boolean, walletId: number) {
      if (loading || walletId === 0) {
        return;
      }
      this.$store.dispatch(ACTIONS.SET_CURRENT_WALLET, walletId);
    },
    async loadAssetInfo(tokenIds: string[]) {
      if (isEmpty(tokenIds)) {
        return;
      }

      this.$store.dispatch(ACTIONS.LOAD_ASSETS_INFO, tokenIds);
    },
    async sign() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.signState.loading = true;
      this.signState.state = "loading";
      this.signState.statusText = "";

      try {
        const signedTx = await this.$store.dispatch(ACTIONS.SIGN_TX_FROM_CONNECTOR, {
          tx: this.rawTx,
          walletId: this.currentWalletId,
          password: this.password,
          callback: this.setStateCallback
        } as SignTxFromConnectorCommand);

        rpcHandler.sendMessage({
          type: "rpc/nautilus-response",
          function: "signTx",
          sessionId: this.sessionId,
          requestId: this.requestId,
          return: {
            isSuccess: true,
            data: JSONBig.parse(signedTx)
          }
        });

        this.signState.loading = false;
        this.signState.state = "success";
        window.removeEventListener("beforeunload", this.onWindowClosing);
        window.close();
      } catch (e) {
        this.signState.loading = false;
        this.signState.state = "error";
        console.error(e);

        if (e instanceof PasswordError) {
          this.signState.statusText = e.message;
        } else {
          this.fail(typeof e === "string" ? e : (e as Error).message);
        }
      }
    },
    setStateCallback(newState: SigningState) {
      this.signState = Object.assign(this.signState, newState);
    },
    cancel() {
      this.refuse("User rejected");
      window.close();
    },
    refuse(info: string) {
      this.sendError({ code: TxSignErrorCode.UserDeclined, info });
    },
    fail(info: string) {
      this.sendError({ code: TxSignErrorCode.ProofGeneration, info });
      window.close();
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
    },
    sendError(error: TxSignError) {
      window.removeEventListener("beforeunload", this.onWindowClosing);

      rpcHandler.sendMessage({
        type: "rpc/nautilus-response",
        function: "signTx",
        sessionId: this.sessionId,
        requestId: this.requestId,
        return: {
          isSuccess: false,
          data: error
        }
      });
    },
    onWindowClosing() {
      this.refuse("unauthorized");
    }
  }
});
</script>
