<template>
  <div class="flex flex-col h-full text-sm gap-4 pt-2">
    <h1 class="text-xl m-auto text-center pb-8">Authentication</h1>

    <dapp-plate :favicon="favicon" />
    <p class="text-center">
      <span class="font-semibold">{{ origin }}</span> wants to make sure the following address
      belongs to you.
    </p>
    <div
      class="text-left font-mono border-1 px-3 py-2 text-sm break-all rounded bg-gray-100 border-gray-300"
    >
      {{ address }}
    </div>
    <div class="flex-grow"></div>
    <p v-if="isReadonly || isLedger" class="text-sm text-center">
      <vue-feather type="alert-triangle" class="text-yellow-500 align-middle" size="20" />
      <span class="align-middle"> This wallet cannot sign messages.</span>
    </p>
    <div class="text-left" v-else>
      <form @submit.prevent="authenticate()">
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
      </form>
    </div>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="cancel()">Cancel</button>
      <button class="btn w-full" :disabled="isReadonly || isLedger" @click="authenticate()">
        Authenticate
      </button>
    </div>

    <loading-modal
      title="Signing"
      :message="errorMessage"
      :state="errorMessage ? 'error' : 'unknown'"
      @close="errorMessage = ''"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, Ref } from "vue";
import { mapState } from "vuex";
import { rpcHandler } from "@/background/rpcHandler";
import { find } from "lodash";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import { ACTIONS } from "@/constants/store/actions";
import useVuelidate, { Validation, ValidationArgs } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { SignEip28MessageCommand, WalletType } from "@/types/internal";
import { SignError, SignErrorCode } from "@/types/connector";
import LoadingModal from "@/components/LoadingModal.vue";
import { PasswordError } from "@/types/errors";

export default defineComponent({
  name: "AuthView",
  components: { LoadingModal },
  setup() {
    return { v$: useVuelidate() as Ref<Validation<ValidationArgs<any>, unknown>> };
  },
  async created() {
    const message = find(rpcHandler.messages, (m) => m.function === "auth");
    if (!message || !message.params) {
      return;
    }

    this.sessionId = message.sessionId;
    this.requestId = message.requestId;
    this.origin = message.params[0];
    this.favicon = message.params[1];

    this.address = message.params[2];
    this.message = message.params[3];

    const connection = await connectedDAppsDbService.getByOrigin(this.origin);
    if (!connection) {
      window.close();
      return;
    }
    this.currentWalletId = connection.walletId;

    window.addEventListener("beforeunload", this.refuse);
  },
  data() {
    return {
      requestId: 0,
      sessionId: 0,
      currentWalletId: 0,
      origin: "",
      favicon: "",
      address: "",
      message: "",
      password: "",
      errorMessage: ""
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
    }
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
    }
  },
  methods: {
    async setWallet(loading: boolean, walletId: number) {
      if (loading || walletId === 0) {
        return;
      }
      this.$store.dispatch(ACTIONS.SET_CURRENT_WALLET, walletId);
    },
    async authenticate() {
      if (this.isReadonly || this.isLedger) {
        return;
      }

      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      try {
        const signResult = await this.$store.dispatch(ACTIONS.SIGN_EIP28_MESSAGE, {
          address: this.address,
          message: this.message,
          origin: this.origin,
          walletId: this.currentWalletId,
          password: this.password
        } as SignEip28MessageCommand);

        rpcHandler.sendMessage({
          type: "rpc/nautilus-response",
          function: "auth",
          sessionId: this.sessionId,
          requestId: this.requestId,
          return: { isSuccess: true, data: signResult }
        });

        window.removeEventListener("beforeunload", this.refuse);
        window.close();
      } catch (e) {
        console.error(e);
        if (e instanceof PasswordError) {
          this.errorMessage = e.message;
        } else {
          this.fail(typeof e === "string" ? e : (e as Error).message);
        }
      }
    },
    cancel() {
      this.refuse();
      window.close();
    },
    sendError(error: SignError) {
      window.removeEventListener("beforeunload", this.refuse);

      rpcHandler.sendMessage({
        type: "rpc/nautilus-response",
        function: "auth",
        sessionId: this.sessionId,
        requestId: this.requestId,
        return: {
          isSuccess: false,
          data: error
        }
      });
    },
    fail(info: string) {
      this.sendError({ code: SignErrorCode.ProofGeneration, info });
    },
    refuse() {
      this.sendError({ code: SignErrorCode.UserDeclined, info: "User rejected" });
    }
  }
});
</script>
