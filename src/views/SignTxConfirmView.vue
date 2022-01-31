<template>
  <div class="flex flex-col h-full gap-5 text-center pt-2">
    <h1 class="text-xl m-auto">Tx confirm</h1>
    <div class="flex-grow overflow-auto border-gray-300 border-1 rounded"></div>
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

export default defineComponent({
  name: "SignTxConfirmView",
  created() {
    const message = find(rpcHandler.messages, (m) => m.function === "signTx");
    if (!message || !message.params) {
      return;
    }

    this.sessionId = message.sessionId;
    this.requestId = message.requestId;
    this.tx = Object.freeze(message.params[0]);
    console.log(this.tx);
  },
  data() {
    return {
      tx: Object.freeze({} as UnsignedTx),
      requestId: 0,
      sessionId: 0
    };
  },
  computed: {
    ...mapState({ wallets: "wallets" })
  },
  methods: {}
});
</script>
