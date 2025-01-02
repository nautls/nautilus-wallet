<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CircleCheckIcon,
  CircleIcon,
  CirclePlusIcon,
  CopyIcon,
  ExternalLinkIcon,
  QrCodeIcon,
  ShieldCheckIcon
} from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import ConfirmAddressOnDevice from "@/components/ConfirmAddressOnDevice.vue";
import QrCode from "@/components/QrCode.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bn } from "@/common/bigNumber";
import { openModal } from "@/common/componentUtils";
import { useFormat } from "@/composables";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState, StateAddress, WalletType } from "@/types/internal";

const app = useAppStore();
const wallet = useWalletStore();
const format = useFormat();

// todo:
// - handle address derivation error messages
// - fix new derived address not showing up
// - handle copy address

const errorMsg = ref("");

const isLedger = computed(() => wallet.type === WalletType.Ledger);
const addresses = computed(() => wallet.filteredAddresses.slice().reverse());
const avoidingReuse = computed(() => wallet.settings.avoidAddressReuse);

function setDefaultAddress(address: StateAddress) {
  if (wallet.settings.defaultChangeIndex === address.index) return;
  wallet.settings.defaultChangeIndex = address.index;
}

async function newAddress() {
  try {
    await wallet.deriveNewAddress();
  } catch (e) {
    errorMsg.value = (e as Error).message;
  }
}

function getFormattedErgBalance(address: StateAddress, decimals = 3): string | undefined {
  if (address.state === AddressState.Unused) return "Unused";
  let erg = address.assets?.find((a) => a.tokenId === ERG_TOKEN_ID)?.confirmedAmount;
  if (!erg) erg = bn(0);

  return `${format.bn.format(erg, decimals, 1_000)} ERG`;
}

function urlFor(address: string | undefined): string {
  return new URL(`/addresses/${address}`, app.settings.explorerUrl).toString();
}

function showOnLedger(address: StateAddress) {
  openModal(ConfirmAddressOnDevice, {
    props: { address: address.script, index: address.index }
  });
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4 text-sm">
    <Card class="p-4">
      <div class="flex flex-row gap-4 items-center">
        <div class="w-8/12">
          <h1 class="font-semibold leading-none tracking-tight mb-2">
            {{ avoidingReuse ? "Your current address" : "Your default address" }}
          </h1>
          <Link class="break-all" :href="urlFor(wallet.changeAddress?.script)" external>
            {{ wallet.changeAddress?.script }}
          </Link>
          <Button variant="minimal" size="condensed" class="size-3 ml-2 align-middle">
            <CopyIcon />
          </Button>
        </div>

        <QrCode
          :data="wallet.changeAddress?.script"
          class="h-auto flex-grow border rounded-lg object-fill p-2 bg-white"
        />
      </div>
    </Card>

    <!-- <div v-if="isLedger" class="rounded border border-yellow-300 bg-yellow-100 px-4 py-3 text-sm">
      <strong
        >Do not send more than 20 different tokens to a Ledger wallet in one transaction.</strong
      >
      Due to device's memory limitations, your funds may get stuck in your wallet.
    </div> -->

    <Tabs v-model="wallet.settings.addressFilter" class="pt-4">
      <div class="flex flex-row">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="unused">Unused</TabsTrigger>
        </TabsList>

        <div class="flex-grow"></div>
        <Button variant="ghost" size="icon" :disabled="errorMsg != ''" @click="newAddress"
          ><CirclePlusIcon
        /></Button>
      </div>
    </Tabs>

    <div class="flex flex-col gap-0">
      <TransitionGroup name="slide-up" appear>
        <div
          v-for="address in addresses"
          :key="address.script"
          class="rounded-md transition-colors hover:bg-accent hover:text-accent-foreground justify-between p-4 flex gap-2 items-center bg-transparent"
        >
          <div class="flex gap-2 items-center">
            <Button
              variant="minimal"
              size="condensed"
              class="flex gap-2 items-center [&_svg]:size-4"
              @click="setDefaultAddress(address)"
            >
              <CircleCheckIcon v-if="wallet.settings.defaultChangeIndex === address.index" />
              <CircleIcon v-else />
              <span class="whitespace-nowrap font-mono text-foreground">{{
                format.string.shorten(address.script, 10)
              }}</span>
            </Button>

            <Button variant="minimal" size="condensed" class="size-4">
              <CopyIcon />
            </Button>
            <Button variant="minimal" size="condensed" class="size-4">
              <ExternalLinkIcon />
            </Button>
            <Button variant="minimal" size="condensed" class="size-4">
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
      </TransitionGroup>
    </div>
  </div>
</template>
