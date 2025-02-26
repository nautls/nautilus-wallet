<script setup lang="ts">
import { onMounted, ref } from "vue";
import { CableIcon, TrashIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import AppItem from "@/components/AppItem.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WalletItem } from "@/components/wallet";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { IDbDAppConnection } from "@/types/database";

const app = useAppStore();

const connections = ref<IDbDAppConnection[]>([]);
const loading = ref(true);

onMounted(loadConnections);

async function loadConnections() {
  loading.value = true;
  connections.value = await connectedDAppsDbService.getAll();
  loading.value = false;
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
  <div v-if="!loading" class="space-y-6">
    <div
      v-if="!connections.length"
      class="text-muted-foreground mt-10 flex flex-col items-center gap-4 text-center text-sm"
    >
      <CableIcon :size="48" class="stroke-[1.5px]" />
      You have no connected dApps yet.
    </div>

    <template v-else>
      <Card
        v-for="(connection, i) in connections"
        :key="i"
        class="relative flex flex-col gap-6 py-6"
      >
        <Button
          tabindex="-1"
          size="icon"
          variant="outline"
          class="bg-background ring-input absolute -top-2 -right-2 size-6 cursor-pointer rounded-full border-0 ring-1"
          @click="remove(connection.origin)"
        >
          <TrashIcon class="m-auto size-4 p-0.5" />
        </Button>

        <AppItem class="px-6" :origin="connection.origin" :favicon="connection.favicon" />
        <Separator class="my-4 w-full" :icon="CableIcon" />
        <WalletItem class="m-auto w-fit px-6" :wallet="getWalletBy(connection.walletId)!" />
      </Card>
    </template>
  </div>
</template>
