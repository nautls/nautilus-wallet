<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import { WalletItem } from "@/components/wallet";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { walletsDbService } from "@/database/walletsDbService";
import RequestHeader from "@/extension/connector/components/RequestHeader.vue";
import { AsyncRequest } from "@/extension/connector/rpc/asyncRequestQueue";
import { InternalRequest } from "@/extension/connector/rpc/protocol";
import { queue } from "@/extension/connector/rpc/uiRpcHandlers";
import { IDbWallet, NotNullId } from "@/types/database";

const selected = ref(0);
const request = ref<AsyncRequest>();
const wallets = ref<NotNullId<IDbWallet>[]>([]);

const { t } = useI18n();

const detachBeforeUnloadEvent = useEventListener(window, "beforeunload", refuse);

onMounted(async () => {
  wallets.value = await walletsDbService.getAll();
  request.value = queue.pop(InternalRequest.Connect);
  if (!request.value) return;
});

async function connect() {
  if (!selected.value || !request.value) return;

  await saveConnection(selected.value, request.value);
  request.value.resolve(true);

  detachBeforeUnloadEvent();
  window.close();
}

function cancel() {
  refuse();
  detachBeforeUnloadEvent();
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
  <RequestHeader
    :origin="request?.origin"
    :favicon="request?.favicon"
    i18n-keypath="connector.connect.header"
  />

  <Card class="grow py-1">
    <ScrollArea class="h-full">
      <div class="mx-2 h-10">
        <Button
          v-for="wallet in wallets"
          :key="wallet.id"
          :class="selected === wallet.id && 'bg-accent'"
          variant="ghost"
          class="my-1 size-auto w-full gap-3 py-3"
          @click="selected = wallet.id"
        >
          <Checkbox :model-value="wallet.id === selected" />
          <WalletItem :wallet="wallet" />
        </Button>
      </div>
    </ScrollArea>
  </Card>

  <div class="flex flex-row gap-4">
    <Button class="w-full" variant="outline" @click="cancel">Cancel</Button>
    <Button class="w-full" :disabled="!selected" @click="connect">Connect</Button>
  </div>
</template>
