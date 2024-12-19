<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useEventListener } from "@vueuse/core";
import DappPlateHeader from "@/components/DappPlateHeader.vue";
import WalletItem from "@/components/WalletItem.vue";
import { AsyncRequest } from "@/extension/connector/rpc/asyncRequestQueue";
import { queue } from "@/extension/connector/rpc/uiRpcHandlers";
import { InternalRequest } from "@/extension/connector/rpc/protocol";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { IDbWallet } from "@/types/database";
import { walletsDbService } from "@/database/walletsDbService";

const selected = ref(0);
const request = ref<AsyncRequest>();
const wallets = ref<IDbWallet[]>([]);

const removeEventListener = useEventListener(window, "beforeunload", refuse);

onMounted(async () => {
  wallets.value = await walletsDbService.getAll();
  request.value = queue.pop(InternalRequest.Connect);
  if (!request.value) return;
});

async function connect() {
  if (!selected.value || !request.value) return;

  await saveConnection(selected.value, request.value);
  request.value.resolve(true);

  removeEventListener();
  window.close();
}

function cancel() {
  refuse();
  removeEventListener();
  window.close();
}

async function saveConnection(walletId: number, request: AsyncRequest) {
  const { origin, favicon } = request;
  await connectedDAppsDbService.put({ walletId, origin, favicon });
}

function refuse() {
  if (!request.value) return;
  request.value.resolve(false);
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 pt-2 text-center text-sm">
    <dapp-plate-header :origin="request?.origin" :favicon="request?.favicon">
      requests to connect with Nautilus
    </dapp-plate-header>

    <div class="flex-grow overflow-auto rounded border border-gray-300">
      <label
        v-for="wallet in wallets"
        :key="wallet.id"
        class="flex cursor-pointer items-center gap-4 p-4 hover:bg-gray-100 active:bg-gray-300"
        :class="wallet.id === selected ? 'bg-gray-100 hover:bg-gray-200' : ''"
      >
        <input v-model="selected" :value="wallet.id" type="radio" class="inline-block" />
        <wallet-item :key="wallet.id" class="inline-block" :wallet="wallet" />
      </label>
    </div>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="cancel()">Cancel</button>
      <button class="btn w-full" :disabled="!selected" @click="connect()">Connect</button>
    </div>
  </div>
</template>
