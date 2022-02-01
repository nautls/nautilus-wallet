<template>
  <div class="flex flex-col h-full gap-4 text-center pt-2">
    <dapp-plate :origin="origin" :favicon="favicon" />
    <h1 class="text-xl m-auto">Wants to sign a transaction</h1>
    <div
      class="leading-relaxed text-sm flex-grow overflow-auto flex flex-col gap-4 border-gray-300 border-1 rounded text-left px-2 py-1"
    >
      <div class="divide-y divide-gray-300">
        <div class="flex flex-col gap-3" v-for="(output, index) in tx?.sending" :key="index">
          <div>
            <p class="font-semibold">Recipient</p>
            <p class="font-mono text-gray-600">
              {{ $filters.compactString($filters.getAddressFromErgoTree(output.ergoTree), 36) }}
            </p>
          </div>
          <div>
            <p class="font-semibold">Sending</p>
            <ul>
              <li v-for="token in output.assets">{{ token.tokenId }}</li>
            </ul>
          </div>
          <div>
            <p class="font-semibold">Minting</p>
          </div>
          <div>
            <p class="font-semibold">Burning</p>
          </div>
        </div>
      </div>

      <div class="text-right">
        <p class="font-semibold">Fee: 0.0011 ERG</p>
      </div>
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
import { TxInterpreter } from "@/api/ergo/transaction/txInterpreter";
import { StateAddress, StateAsset } from "@/types/internal";
import { GETTERS } from "@/constants/store";

export default defineComponent({
  name: "SignTxConfirmView",
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
      origin: "",
      favicon: ""
    };
  },
  watch: {
    ["addresses.length"](newLength: number) {
      if (newLength === 0) {
        return;
      }

      // console.log(
      //   new TxInterpreter(
      //     this.rawTx,
      //     this.addresses.map((a) => a.script)
      //   )
      // );

      console.log(this.rawTx);
    }
  },
  computed: {
    ...mapState({ wallets: "wallets" }),
    addresses(): StateAddress[] {
      return this.$store.state.currentAddresses;
    },
    assets(): StateAsset {
      return this.$store.getters[GETTERS.BALANCE];
    },
    tx(): TxInterpreter | undefined {
      if (this.addresses.length === 0) {
        return;
      }

      return new TxInterpreter(
        this.rawTx,
        this.addresses.map((a) => a.script)
      );
    }
  },
  methods: {
    // getTokenName(tokenId: string) {
    // }
  },
  components: { DappPlate }
});
</script>
