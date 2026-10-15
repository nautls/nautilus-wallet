<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { SearchIcon } from "@lucide/vue";
import { useEventListener } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
const search = ref("");

const filteredWallets = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return wallets.value;
  return wallets.value.filter((wallet) => wallet.name.toLowerCase().includes(term));
});

const canConnect = computed(
  () => !!selected.value && filteredWallets.value.some((wallet) => wallet.id === selected.value)
);

const { t } = useI18n();

const detachBeforeUnloadEvent = useEventListener(window, "beforeunload", refuse);

onMounted(async () => {
  wallets.value = await walletsDbService.getAll();
  request.value = queue.pop(InternalRequest.Connect);
  if (!request.value) return;
});

async function connect() {
  if (!canConnect.value || !request.value) return;

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

  <div class="relative">
    <SearchIcon
      class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
    />
    <Input v-model="search" class="pl-9" :placeholder="t('common.search')" type="search" />
  </div>

  <Card class="grow py-1">
    <ScrollArea class="h-full">
      <div class="mx-2 h-10">
        <p v-if="!filteredWallets.length" class="text-muted-foreground py-6 text-center text-sm">
          {{ t("header.menu.noWalletsFound") }}
        </p>
        <Button
          v-for="wallet in filteredWallets"
          :key="wallet.id"
          :class="selected === wallet.id && 'bg-accent'"
          variant="ghost"
          class="my-1 size-auto w-full gap-3 py-2"
          @click="selected = wallet.id"
        >
          <Checkbox :model-value="wallet.id === selected" />
          <WalletItem :wallet="wallet" />
        </Button>
      </div>
    </ScrollArea>
  </Card>

  <div class="flex flex-row gap-4">
    <Button class="w-full" variant="outline" @click="cancel">{{ t("common.cancel") }}</Button>
    <Button class="w-full" :disabled="!canConnect" @click="connect">{{
      t("connector.connect.connect")
    }}</Button>
  </div>
</template>
