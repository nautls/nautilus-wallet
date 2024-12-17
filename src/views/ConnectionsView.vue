<script setup lang="ts">
import { onMounted, ref } from "vue";
import { TrashIcon } from "lucide-vue-next";
import DappPlate from "@/components/DappPlate.vue";
import WalletItem from "@/components/WalletItem.vue";
import { IDbDAppConnection } from "@/types/database";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { useAppStore } from "@/stores/appStore";

const connections = ref<IDbDAppConnection[]>([]);
const app = useAppStore();

onMounted(loadConnections);

async function loadConnections() {
  connections.value = await connectedDAppsDbService.getAll();
}

function getWalletBy(walletId: number) {
  return app.wallets.find((w) => w.id === walletId);
}

async function remove(origin: string) {
  await connectedDAppsDbService.deleteByOrigin(origin);
  await loadConnections();
}
</script>

<template>
  <div class="flex flex-col h-max gap-4 text-center py-4">
    <h1 v-if="connections.length === 0" class="text-lg font-bold text-gray-500 pt-4">
      No connected dApps
    </h1>
    <template v-else>
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
          <trash-icon class="p-1" :size="20" />
        </button>
        <dapp-plate :origin="connection.origin" :favicon="connection.favicon" />
        <wallet-item :key="i" class="block" :wallet="getWalletBy(connection.walletId)!" />
      </div>
    </template>
  </div>
</template>
