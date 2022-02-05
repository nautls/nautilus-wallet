<template>
  <div class="flex flex-col h-full gap-4 text-center">
    <dapp-plate :origin="origin" :favicon="favicon" compact />
    <h1 class="text-xl m-auto">Wants to sign a transaction</h1>
    <div
      class="text-sm flex-grow flex flex-col gap-4 leading-relaxed overflow-auto border-gray-300 border-1 rounded text-left px-2 py-1"
    >
      <div class="flex flex-col gap-2" v-for="(output, index) in tx?.sending" :key="index">
        <div class="mb-1">
          <p class="font-semibold mb-1">Recipient</p>

          <p class="rounded font-mono bg-gray-200 text-sm py-1 px-2 break-all">
            {{ $filters.compactString(output.receiver, 60) }}
            <click-to-copy :content="output.receiver" size="12" />
            <span
              class="rounded bg-blue-200 mx-2 px-1 font-normal text-xs text-dark-200 uppercase font-sans"
              v-if="output.isIntrawallet"
              >Intrawallet</span
            >
          </p>
        </div>
        <div class="my-1">
          <p class="font-semibold mb-1">Assets</p>
          <ul class="px-1">
            <li v-for="asset in output.assets" class="py-1">
              <div class="flex flex-row items-center gap-2">
                <img
                  :src="$filters.assetLogo(asset.tokenId)"
                  class="h-8 w-8 rounded-full"
                  :alt="asset.name"
                />
                <div class="flex-grow items-center align-middle">
                  <span class="align-middle">
                    <template v-if="asset.name">{{
                      $filters.compactString(asset.name, 20, "end")
                    }}</template>
                    <template v-else>{{ $filters.compactString(asset.tokenId, 20) }}</template>
                  </span>
                  <tool-tip v-if="asset.isMinting" class="align-middle">
                    <template v-slot:label>
                      <div class="block w-38">
                        <span>This asset is being minted by this transaction.</span>
                        <div class="text-left pt-2">
                          <p v-if="asset.description">
                            <span class="font-bold">Description</span>:
                            {{ $filters.compactString(asset.description, 50, "end") }}
                          </p>
                          <p v-if="asset.decimals">
                            <span class="font-bold">Decimals</span>: {{ asset.decimals }}
                          </p>
                        </div>
                      </div>
                    </template>
                    <vue-feather type="git-commit" class="align-middle pl-2" />
                  </tool-tip>
                </div>
                <div>
                  {{ $filters.formatBigNumber(asset.amount) }}
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div v-if="tx?.fee && tx?.fee.assets[0]" class="text-right px-2 -mt-2 text-sm">
      <p>Fee: {{ $filters.formatBigNumber(tx.fee.assets[0].amount) }} ERG</p>
    </div>
    <div class="text-left" v-if="!isReadonly">
      <label
        >Spending password
        <input
          type="password"
          @blur="v$.password.$touch()"
          v-model.lazy="password"
          class="w-full control block"
        />
        <p class="input-error" v-if="v$.password.$error">
          {{ v$.password.$errors[0].$message }}
        </p>
      </label>
    </div>
    <p v-else>
      <vue-feather type="alert-triangle" class="text-yellow-500 align-middle" />
      <span class="align-middle"> This wallet cannot sign transactions.</span>
    </p>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="cancel()">Cancel</button>
      <button class="btn w-full" @click="sign()" :disabled="isReadonly">Confirm</button>
    </div>
    <loading-modal
      title="Signing"
      :message="signMessage"
      :state="signState"
      @close="signState = 'disabled'"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions, mapState } from "vuex";
import { rpcHandler } from "@/background/rpcHandler";
import { find } from "lodash";
import { TxSignError, TxSignErrorCode, UnsignedTx } from "@/types/connector";
import DappPlate from "@/components/DappPlate.vue";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import { SignTxFromConnectorCommand, StateAddress, StateAsset, WalletType } from "@/types/internal";
import { ACTIONS, GETTERS } from "@/constants/store";
import ToolTip from "@/components/ToolTip.vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import JSONBig from "json-bigint";
import { PasswordError } from "@/types/errors";

export default defineComponent({
  name: "SignTxConfirmView",
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

    window.addEventListener("beforeunload", this.onWindowClosing);
    this.setCurrentWallet(connection.walletId);
    this.currentWalletId = connection.walletId;
  },
  data() {
    return {
      rawTx: Object.freeze({} as UnsignedTx),
      currentWalletId: 0,
      requestId: 0,
      sessionId: 0,
      password: "",
      origin: "",
      favicon: "",
      signState: "disabled",
      signMessage: ""
    };
  },
  validations() {
    return {
      password: {
        required: helpers.withMessage("Spending password is required.", required)
      }
    };
  },
  watch: {
    ["addresses.length"](newLength: number) {
      if (newLength === 0) {
        return;
      }
    }
  },
  computed: {
    ...mapState({ wallets: "wallets" }),
    isReadonly() {
      return this.$store.state.currentWallet.type === WalletType.ReadOnly;
    },
    addresses(): StateAddress[] {
      return this.$store.state.currentAddresses;
    },
    assets(): StateAsset[] {
      return this.$store.getters[GETTERS.BALANCE];
    },
    tx(): TxInterpreter | undefined {
      if (this.addresses.length === 0) {
        return;
      }

      return new TxInterpreter(
        this.rawTx as UnsignedTx,
        this.addresses.map((a) => a.script),
        Object.assign(
          {},
          ...this.assets.map((a) => {
            return { [a.tokenId]: { name: a.name, decimals: a.decimals } };
          })
        )
      );
    }
  },
  methods: {
    ...mapActions({ setCurrentWallet: ACTIONS.SET_CURRENT_WALLET }),
    async sign() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.signState = "loading";
      this.signMessage = "";

      try {
        const signedTx = await this.$store.dispatch(ACTIONS.SIGN_TX_FROM_CONNECTOR, {
          tx: this.rawTx,
          walletId: this.currentWalletId,
          password: this.password
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

        window.removeEventListener("beforeunload", this.onWindowClosing);
        window.close();
      } catch (e) {
        (e as Error).message;
        this.signState = "error";
        console.error(e);

        if (e instanceof PasswordError) {
          this.signMessage = e.message;
        } else {
          this.fail(typeof e === "string" ? e : (e as Error).message);
        }
      }
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
  },
  components: { DappPlate, ToolTip }
});
</script>
