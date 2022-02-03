<template>
  <div class="flex flex-col h-full gap-4 text-center pt-2">
    <dapp-plate :origin="origin" :favicon="favicon" />

    <h1 class="text-xl m-auto">Wants to connect with Nautilus</h1>
    <div class="flex-grow overflow-auto border-gray-300 border-1 rounded">
      <label
        class="p-4 flex gap-4 items-center block cursor-pointer hover:bg-gray-100 active:bg-gray-300"
        :class="wallet.id === selected ? 'bg-gray-100 hover:bg-gray-200' : ''"
        v-for="wallet in wallets"
        :key="wallet.id"
      >
        <input :value="wallet.id" v-model="selected" type="radio" class="inline-block" />
        <wallet-item class="inline-block" :wallet="wallet" :key="wallet.id" />
      </label>
    </div>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="cancel()">Cancel</button>
      <button class="btn w-full" @click="connect()" :disabled="!selected">Connect</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "vuex";
import { rpcHandler } from "@/background/rpcHandler";
import { find, isEmpty } from "lodash";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";

export default defineComponent({
  name: "AuthView",
  created() {
    const message = find(rpcHandler.messages, (m) => m.function === "connect");
    if (!message || !message.params) {
      return;
    }

    this.sessionId = message.sessionId;
    this.requestId = message.requestId;
    this.origin = message.params[0];
    this.favicon = message.params[1];

    window.addEventListener("beforeunload", this.refuse);
  },
  data() {
    return {
      selected: 0,
      requestId: 0,
      sessionId: 0,
      origin: "",
      favicon: ""
    };
  },
  computed: {
    ...mapState({ wallets: "wallets" })
  },
  methods: {
    async connect() {
      await connectedDAppsDbService.put({
        origin: this.origin,
        walletId: this.selected,
        favicon: !isEmpty(this.favicon) ? this.favicon : undefined
      });

      rpcHandler.sendMessage({
        type: "rpc/nautilus-response",
        function: "connect",
        sessionId: this.sessionId,
        requestId: this.requestId,
        return: { isSuccess: true, data: { walletId: this.selected } }
      });
      window.removeEventListener("beforeunload", this.refuse);
      window.close();
    },
    cancel() {
      this.refuse();
      window.removeEventListener("beforeunload", this.refuse);
      window.close();
    },
    refuse() {
      rpcHandler.sendMessage({
        type: "rpc/nautilus-response",
        function: "connect",
        sessionId: this.sessionId,
        requestId: this.requestId,
        return: { isSuccess: true, data: { walletId: undefined } }
      });
    }
  }
});
</script>
