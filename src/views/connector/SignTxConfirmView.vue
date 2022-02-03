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
    <div class="text-left">
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
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full">Cancel</button>
      <button class="btn w-full">Confirm</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "vuex";
import { rpcHandler } from "@/background/rpcHandler";
import { find } from "lodash";
import { UnsignedTx } from "@/types/connector";
import DappPlate from "@/components/DappPlate.vue";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import { StateAddress, StateAsset } from "@/types/internal";
import { GETTERS } from "@/constants/store";
import ToolTip from "@/components/ToolTip.vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";

export default defineComponent({
  name: "SignTxConfirmView",
  setup() {
    return { v$: useVuelidate() };
  },
  created() {
    const message = find(rpcHandler.messages, (m) => m.function === "signTx");
    if (!message || !message.params) {
      return;
    }

    this.sessionId = message.sessionId;
    this.requestId = message.requestId;
    this.origin = message.params[0];
    this.favicon = message.params[1];
    this.rawTx = Object.freeze(message.params[2]);
  },
  data() {
    return {
      rawTx: Object.freeze({} as UnsignedTx),
      requestId: 0,
      sessionId: 0,
      password: "",
      origin: "",
      favicon: ""
    };
  },
  validations() {
    return {
      password: {
        required: helpers.withMessage(
          "A spending password is required for transaction signing.",
          required
        )
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
    // getTokenName(tokenId: string) {
    // }
  },
  components: { DappPlate, ToolTip }
});
</script>
