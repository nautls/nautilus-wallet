<script setup lang="ts">
import { computed } from "vue";
import {
  CirclePlusIcon,
  ExternalLinkIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  TriangleAlertIcon
} from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { StateAddress, useWalletStore } from "@/stores/walletStore";
import { AddressQrCodeDialog } from "@/components/address";
// import ConfirmAddressOnDevice from "@/components/ConfirmAddressOnDevice.vue";
import QrCode from "@/components/QrCode.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import CopyButton from "@/components/ui/CopyButton.vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState, WalletType } from "@/types/internal";

const app = useAppStore();
const wallet = useWalletStore();
const format = useFormat();

const isLedger = computed(() => wallet.type === WalletType.Ledger);
const addresses = computed(() => wallet.filteredAddresses.slice().reverse());

const { open: openQrCodeDialog } = useProgrammaticDialog(AddressQrCodeDialog);
const { toast } = useToast();

function setDefaultAddress(address: StateAddress) {
  if (wallet.settings.defaultChangeIndex === address.index) return;
  wallet.settings.defaultChangeIndex = address.index;
}

async function newAddress() {
  try {
    await wallet.deriveNewAddress();
  } catch (e) {
    toast({
      title: "Address generation failed",
      description: (e as Error)?.message ?? "Unable to generate a new address."
    });
  }
}

function getFormattedErgBalance(address: StateAddress, decimals = 3): string | undefined {
  if (address.state === AddressState.Unused) return "Unused";
  let erg = address.assets?.find((a) => a.tokenId === ERG_TOKEN_ID)?.confirmedAmount;
  if (!erg) erg = bn(0);

  return `${format.bn.format(erg, decimals, 1_000)} ERG`;
}

function openExplorer(address: string | undefined) {
  const url = new URL(`/addresses/${address}`, app.settings.explorerUrl).toString();
  window.open(url, "_blank");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function showOnLedger(address: StateAddress) {
  // openModal(ConfirmAddressOnDevice, {
  //   props: { address: address.script, index: address.index }
  // });
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <Card class="p-6 text-sm">
      <div class="flex flex-row gap-4 items-center">
        <div class="w-8/12 xs:w-7/12">
          <h1 class="font-semibold leading-none tracking-tight mb-2">
            {{
              wallet.settings.avoidAddressReuse ? "Your current address" : "Your default address"
            }}
          </h1>
          <div class="break-all">
            {{ wallet.changeAddress?.script }}
            <CopyButton class="size-3 align-middle" :content="wallet.changeAddress?.script" />
          </div>
        </div>

        <QrCode :data="wallet.changeAddress?.script" />
      </div>
    </Card>

    <Alert v-if="isLedger" class="space-x-2">
      <TriangleAlertIcon />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        Avoid sending more than <strong>20 different tokens</strong> in a single transaction to a
        Ledger wallet. Limited device memory could cause your funds to become inaccessible.
      </AlertDescription>
    </Alert>

    <Tabs v-model="wallet.settings.addressFilter" class="pt-4">
      <div class="flex flex-row">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="unused">Unused</TabsTrigger>
        </TabsList>

        <div class="flex-grow"></div>
        <Button variant="ghost" size="icon" @click="newAddress"><CirclePlusIcon /></Button>
      </div>
    </Tabs>
  </div>

  <ScrollArea type="scroll">
    <Transition name="slide-up" appear>
      <div class="flex flex-col gap-0 px-4 pb-4">
        <div
          v-for="address in addresses"
          :key="address.script"
          class="rounded-md transition-colors hover:bg-accent hover:text-accent-foreground justify-between p-4 flex gap-2 items-center bg-transparent"
        >
          <div class="flex gap-2 items-center">
            <Button
              variant="minimal"
              size="condensed"
              class="flex gap-2 items-center"
              @click="setDefaultAddress(address)"
            >
              <Checkbox :checked="wallet.settings.defaultChangeIndex === address.index" />
              <span class="whitespace-nowrap font-mono text-foreground">{{
                format.string.shorten(address.script, 10)
              }}</span>
            </Button>

            <CopyButton :content="address.script" class="size-4" />
            <Button
              variant="minimal"
              size="condensed"
              class="size-4"
              @click="openExplorer(address.script)"
            >
              <ExternalLinkIcon />
            </Button>
            <Button
              variant="minimal"
              size="condensed"
              class="size-4"
              @click="openQrCodeDialog({ address })"
            >
              <QrCodeIcon />
            </Button>
            <!-- Verify this address on your Ledger device -->
            <Button
              v-if="isLedger"
              variant="minimal"
              size="condensed"
              class="size-4"
              @click="showOnLedger(address)"
            >
              <ShieldCheckIcon />
            </Button>
          </div>

          <div class="text-right text-xs">
            <Skeleton v-if="app.settings.hideBalances" class="h-4 w-20 animate-none" />
            <template v-else>
              <span>{{ getFormattedErgBalance(address) }}</span>
              <span v-if="address.assets.length > 1" class="text-muted-foreground">
                +{{ address.assets.length - 1 }}</span
              >
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </ScrollArea>
</template>
