<template>
  <div class="flex flex-col gap-4 py-4">
    <div class="flex flex-row gap-4">
      <div class="w-8/12">
        <label
          ><span v-if="avoidingReuse">Your current address</span>
          <span v-else>Your default address</span></label
        >
        <div class="break-all rounded border border-gray-200 bg-gray-100 p-2 font-mono text-sm">
          <template v-if="loading">
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-1/2 rounded"></div>
          </template>
          <template v-else>
            <a :href="urlFor(wallet.changeAddress?.script)" target="_blank">
              {{ wallet.changeAddress?.script }}
            </a>
            <click-to-copy :content="wallet.changeAddress?.script" class="mx-2" />
          </template>
        </div>
      </div>
      <div class="w-4/12">
        <div v-if="loading" class="skeleton h-full w-full p-0.5"></div>
        <qr-code v-else :data="wallet.changeAddress?.script" class="h-full w-full p-0.5" />
      </div>
    </div>
    <div v-if="isLedger" class="rounded border border-yellow-300 bg-yellow-100 px-4 py-3 text-sm">
      <strong
        >Do not send more than 20 different tokens to a Ledger wallet in one transaction.</strong
      >
      Due to device's memory limitations, your funds may get stuck in your wallet.
    </div>
    <div>
      <button class="btn w-full" :disabled="loading || errorMsg != ''" @click="newAddress()">
        New address
      </button>
      <p v-if="errorMsg != ''" class="input-error">
        {{ errorMsg }}
      </p>
    </div>
    <div class="rounded border">
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
            <td class="text-right">
              <div
                v-if="hideBalances"
                class="skeleton inline-block h-5 w-2/4 animate-none rounded align-middle"
              ></div>
              <template v-else>
                <span class="float-left">Σ</span>
                <span> {{ ergBalanceFor(address) }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  CheckCircleIcon,
  CircleIcon,
  EyeIcon,
  EyeOffIcon,
  FilterIcon,
  FilterXIcon,
  ShieldCheckIcon
} from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { openModal } from "@/common/componentUtils";
import { useFormat, useQrCode } from "@/composables";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState, StateAddress, WalletType } from "@/types/internal";
import ConfirmAddressOnDevice from "../components/ConfirmAddressOnDevice.vue";

export default defineComponent({
  name: "ReceiveView",
  components: {
    qrCode: useQrCode({ border: 0 }),
    CheckCircleIcon,
    CircleIcon,
    FilterIcon,
    FilterXIcon,
    EyeIcon,
    EyeOffIcon,
    ShieldCheckIcon
  },
  setup() {
    return { app: useAppStore(), wallet: useWalletStore(), format: useFormat() };
  },
  data() {
    return {
      prevCount: 1,
      errorMsg: ""
    };
  },
  computed: {
    isLedger(): boolean {
      return this.wallet.type === WalletType.Ledger;
    },
    reversedAddresses(): StateAddress[] {
      return this.wallet.filteredAddresses.slice().reverse();
    },
    hideUsed(): boolean {
      return this.wallet.settings.hideUsedAddresses;
    },
    loading(): boolean {
      return this.wallet.addresses.length === 0 && this.wallet.loading;
    },
    avoidingReuse(): boolean {
      return this.wallet.settings.avoidAddressReuse;
    },
    hideBalances(): boolean {
      return this.app.settings.hideBalances;
    }
  },
  watch: {
    "wallet.addresses"(_, oldLen) {
      const length = oldLen || 1;
      if (length > 1) this.prevCount = length;
    }
  },
  methods: {
    updateDefaultChangeIndex(index: number) {
      this.wallet.settings.defaultChangeIndex = index;
    },
    toggleUsedAddressesFilter() {
      this.wallet.settings.hideUsedAddresses = !this.wallet.settings.hideUsedAddresses;
    },
    async newAddress() {
      try {
        await this.wallet.deriveNewAddress();
      } catch (e) {
        this.errorMsg = (e as Error).message;
      }
    },
    ergBalanceFor(address: StateAddress): string {
      return (
        address.assets?.find((a) => a.tokenId === ERG_TOKEN_ID)?.confirmedAmount.toFormat() || "0"
      );
    },
    isUsed(address: StateAddress): boolean {
      return address.state === AddressState.Used;
    },
    urlFor(address: string | undefined): string {
      return new URL(`/addresses/${address}`, this.app.settings.explorerUrl).toString();
    },
    toggleHideBalance(): void {
      this.app.settings.hideBalances = !this.app.settings.hideBalances;
    },
    showOnLedger(address: StateAddress) {
      openModal(ConfirmAddressOnDevice, {
        props: { address: address.script, index: address.index }
      });
    }
  }
});
</script>
