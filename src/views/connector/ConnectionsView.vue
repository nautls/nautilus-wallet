<script setup lang="ts">
import { computed, onMounted } from "vue";
import { ACTIONS } from "@/constants/store";
import store from "@/store";
import DappPlate from "@/components/DappPlate.vue";

onMounted(() => store.dispatch(ACTIONS.LOAD_CONNECTIONS));

const connections = computed(() => store.state.connections);

function getWalletBy(walletId: number) {
  return store.state.wallets.find((w) => w.id === walletId);
}

function remove(origin: string) {
  store.dispatch(ACTIONS.REMOVE_CONNECTION, origin);
}
</script>

<template>
  <div class="flex flex-col h-max gap-4 text-center">
    <div
      v-for="(connection, i) in connections"
      :key="i"
      class="relative p-4 border-gray-300 border-1 rounded flex flex-col gap-2 items-center block cursor-default hover:bg-gray-100"
    >
      <button
        tabindex="-1"
        class="inline-flex cursor-pointer border-1 border-gray-400 bg-gray-100 w-5.5 h-5.5 -top-2.5 -right-2.5 absolute rounded-full ring-2 ring-light-50"
        @click="remove(connection.origin)"
      >
        <vue-feather type="trash" class="p-1" size="12" />
      </button>
      <dapp-plate :origin="connection.origin" :favicon="connection.favicon" />
      <wallet-item :key="i" class="block" :wallet="getWalletBy(connection.walletId)" />
    </div>
  </div>
</template>
