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
// - handle address derivation loading state
// - handle copy address

const errorMsg = ref("");

const isLedger = computed(() => wallet.type === WalletType.Ledger);
const addresses = computed(() => wallet.filteredAddresses.slice().reverse());
const avoidingReuse = computed(() => wallet.settings.avoidAddressReuse);
const hideBalances = computed(() => app.settings.hideBalances);

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
          <button class="inline ml-2 text-muted-foreground hover:text-foreground transition-colors">
            <CopyIcon class="h-3 w-3" />
          </button>
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
            <button class="flex gap-2 items-center" @click="setDefaultAddress(address)">
              <CircleCheckIcon
                v-if="wallet.settings.defaultChangeIndex === address.index"
                class="w-4 h-auto"
              />
              <CircleIcon v-else class="w-4 h-auto" />
              <span class="whitespace-nowrap font-mono">{{
                format.string.shorten(address.script, 10)
              }}</span>
            </button>

            <button class="text-muted-foreground hover:text-foreground transition-colors">
              <CopyIcon class="h-4 w-4" />
            </button>
            <button class="text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLinkIcon class="h-4 w-4" />
            </button>
            <button class="text-muted-foreground hover:text-foreground transition-colors">
              <QrCodeIcon class="h-4 w-4" />
            </button>

            <!-- Verify this address on your Ledger device -->
            <button
              v-if="isLedger"
              class="text-muted-foreground hover:text-foreground transition-colors"
              @click="showOnLedger(address)"
            >
              <ShieldCheckIcon class="h-4 w-4" :size="14" />
            </button>
          </div>

          <div class="text-right text-xs">
            <span>{{ getFormattedErgBalance(address) }}</span>
            <span v-if="address.assets.length > 1" class="text-muted-foreground">
              +{{ address.assets.length - 1 }}</span
            >
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- <div class="hidden">
      <table class="table">
        <thead>
          <tr>
            <th>
              <div class="flex flex-row justify-start gap-2 align-middle">
                Address ({{ wallet.filteredAddresses.length
                }}<template v-if="hideUsed">/{{ wallet.addresses.length }}</template
                >)
                <tool-tip
                  :label="hideUsed ? 'Show all addresses' : 'Hide empty used addresses'"
                  tip-class="normal-case"
                >
                  <a class="inline-flex cursor-pointer" @click="toggleUsedAddressesFilter()">
                    <filter-x-icon v-if="hideUsed" :size="16" />
                    <filter-icon v-else :size="16" />
                  </a>
                </tool-tip>
              </div>
            </th>
            <th>
              <div class="flex flex-row justify-end gap-2 align-middle">
                <tool-tip
                  :label="hideBalances ? 'Show' : 'Hide'"
                  tip-class="normal-case"
                  class="align-middle"
                >
                  <a class="inline-flex cursor-pointer" @click="toggleHideBalance()">
                    <eye-off-icon v-if="hideBalances" :size="16" />
                    <eye-icon v-else :size="16" />
                  </a>
                </tool-tip>
                Balance
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in prevCount" :key="i">
              <td>
                <div class="skeleton inline-block h-3 w-2/3 rounded"></div>
              </td>
              <td class="text-right">
                <div class="skeleton inline-block h-3 w-1/3 rounded"></div>
              </td>
            </tr>
          </template>
          <tr v-for="address in reversedAddresses" v-else :key="address.script">
            <td class="font-mono">
              <div class="flex gap-2 text-gray-700">
                <a
                  :href="urlFor(address.script)"
                  :class="{ 'text-gray-400': isUsed(address) }"
                  target="_blank"
                  >{{ format.string.shorten(address.script, 10) }}</a
                >
                <tool-tip v-if="isLedger" label="Verify this address on <br /> your Ledger device">
                  <a class="cursor-pointer" @click="showOnLedger(address)">
                    <shield-check-icon class="inline" :size="14" />
                  </a>
                </tool-tip>

                <click-to-copy :content="address.script" :size="14" />

                <template v-if="!wallet.settings.avoidAddressReuse">
                  <span v-if="wallet.settings.defaultChangeIndex === address.index">
                    <check-circle-icon class="inline text-green-600" :size="14" />
                  </span>
                  <tool-tip v-else label="Set as default<br />address">
                    <a class="cursor-pointer" @click="updateDefaultChangeIndex(address.index)">
                      <circle-icon class="inline" :size="14" />
                    </a>
                  </tool-tip>
                </template>
              </div>
            </td>
            <td class="text-right">Σ {{ getFormattedErgBalance(address) }}</td>
          </tr>
        </tbody>
      </table>
    </div> -->
  </div>
</template>
