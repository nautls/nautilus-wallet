<template>
  <div class="flex flex-col h-max gap-4 text-center">
    <div
      class="relative p-4 border-gray-300 border-1 rounded flex flex-col gap-2 items-center block cursor-default hover:bg-gray-100"
      v-for="(connection, i) in connections"
      :key="i"
    >
      <button
        tabindex="-1"
        @click="remove(connection.origin)"
        class="inline-flex cursor-pointer border-1 border-gray-400 bg-gray-100 w-5.5 h-5.5 -top-2.5 -right-2.5 absolute rounded-full ring-2 ring-light-50"
      >
        <vue-feather type="trash" class="p-1" size="12" />
      </button>
      <dapp-plate :origin="connection.origin" :favicon="connection.favicon" />
      <wallet-item class="block" :wallet="getWalletBy(connection.walletId)" :key="i" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "vuex";
import { find } from "lodash";
import { ACTIONS } from "@/constants/store";

export default defineComponent({
  name: "ConnectionsView",
  created() {
    this.$store.dispatch(ACTIONS.LOAD_CONNECTIONS);
  },
  computed: {
    ...mapState({ wallets: "wallets", connections: "connections" })
  },
  methods: {
    getWalletBy(walletId: number) {
      return find(this.wallets, (w) => w.id === walletId);
    },
    remove(origin: string) {
      this.$store.dispatch(ACTIONS.REMOVE_CONNECTION, origin);
    }
  }
});
</script>
